import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CareerState } from '@bg/engine';
import { useI18n } from '../lib/i18n';
import { bestSeasonOf, INDEX, percentileFor, trophyName, type BoardKey, turningPoints } from '../lib/game';
import { flagLabel } from '../lib/flags';
import { renderShareCard } from '../lib/shareCard';
import { useCountUp } from '../lib/countUp';
import { useSettings } from '../lib/settings';
import { useLeaderboard, type BoardStanding } from '../lib/leaderboard';
import { isDailyRun } from '../lib/daily';
import { track } from '../lib/telemetry';
import { Crest } from '../components/Crest';
import { AWARD_ART, AwardMedal, trophyArt } from '../components/Trophy';
import { CareerList } from '../components/CareerList';
import { RatingChip } from '../components/rating';
import { Button, Meter, Screen, Sheet } from '../components/ui';
import { asset } from '../lib/assets';

/**
 * The retirement screen.
 *
 * Top: who you ended up being — peak rating, flag, number and position, the
 * last club, and how old you were. Middle: the whole career table, exactly as
 * it looked while you played it, then the closing panel with the four career
 * numbers, the silverware laid out, and the three global ranks. Bottom: two
 * buttons and nothing else — see the card, or go again.
 *
 * The score breakdown moved behind a tap on the legacy rank. It is for the
 * player who wants it, and this screen is for the screenshot.
 */
export function SummaryScreen({
  state,
  rankable,
  onReplay,
}: {
  state: CareerState;
  /** False when the game updated mid-career — see `SaveFile` in lib/game.ts. */
  rankable: boolean;
  onReplay: () => void;
}) {
  const { t, money, clubShort, country: countryName, locale } = useI18n();
  const [shareOpen, setShareOpen] = useState(false);
  const [turning, setTurning] = useState(false);
  const points = useMemo(() => turningPoints(state), [state]);
  /** Which board's explainer is open, if any. */
  const [explain, setExplain] = useState<BoardKey | null>(null);
  const live = useLeaderboard(rankable ? state : null);
  const report = state.retirement;
  const player = state.player;
  const countryId = player?.countryId ?? null;

  /** Every trophy and award won, most prestigious first, with its own art. */
  const honours = useMemo(() => {
    const rank: Record<string, number> = {
      world_cup: 0, continental_elite: 1, continental_nations: 2, league: 3,
      club_world_cup: 4, domestic_cup: 5, continental_secondary: 6,
    };
    const out = new Map<string, { art: string | null; label: string; count: number; sort: number }>();
    for (const season of state.seasons) {
      for (const trophy of season.trophies) {
        const context = { clubId: season.clubId, countryId };
        const label = trophyName(trophy, t, context);
        const existing = out.get(label);
        if (existing) existing.count += 1;
        else out.set(label, { art: trophyArt(trophy, context), label, count: 1, sort: rank[trophy] ?? 8 });
      }
      for (const award of season.awards) {
        const label = t(`awards.${award}`);
        const existing = out.get(label);
        if (existing) existing.count += 1;
        // Team of the Season is the one award with no image of its own; it
        // gets the drawn medal rather than a stand-in trophy shape.
        else out.set(label, { art: AWARD_ART[award] ?? null, label, count: 1, sort: award === 'ballon_dor' ? 9 : 10 });
      }
    }
    return [...out.values()].sort((a, b) => a.sort - b.sort);
  }, [state.seasons, countryId, t]);

  /**
   * The whole gallery stays on one row, so it tightens as the cabinet fills
   * rather than wrapping and pushing the rank cards off a one-screen page.
   */
  const honourSize =
    honours.length <= 6 ? 42 : honours.length <= 8 ? 34 : honours.length <= 10 ? 28 : honours.length <= 13 ? 22 : 18;

  /**
   * Career average match rating, weighted by appearances — the number a
   * playing career is actually judged on. A twelve-game 7.4 does not outweigh a
   * forty-game 6.8, and weighting is the only way to say that.
   */
  const careerRating = useMemo(() => {
    let apps = 0;
    let weighted = 0;
    for (const season of state.seasons) {
      apps += season.stats.appearances;
      weighted += season.stats.rating * season.stats.appearances;
    }
    return apps > 0 ? weighted / apps : 0;
  }, [state.seasons]);

  const totalTrophies = useMemo(
    () => state.seasons.reduce((sum, season) => sum + season.trophies.length, 0),
    [state.seasons],
  );
  // Goals conceded is a keeper's headline number but is not carried on
  // CareerTotals, so it is summed here rather than added to the engine.
  const conceded = useMemo(
    () => state.seasons.reduce((sum, season) => sum + season.stats.goalsConceded, 0),
    [state.seasons],
  );

  const { capsTotal, nationalGoals, nationalCleanSheets } = useMemo(() => {
    let caps = 0;
    let goals = 0;
    let cleanSheets = 0;
    for (const season of state.seasons) {
      if (!season.nationalStats) continue;
      caps += season.nationalStats.appearances;
      goals += season.nationalStats.goals;
      cleanSheets += season.nationalStats.cleanSheets;
    }
    return { capsTotal: caps, nationalGoals: goals, nationalCleanSheets: cleanSheets };
  }, [state.seasons]);

  const boards = useMemo(() => {
    if (!report) return [];
    const rows: { key: BoardKey; label: string; raw: number; display: string; live: BoardStanding | null }[] = [
      { key: 'legacy', label: t('summary.boards.legacy'), raw: report.legacyScore, display: String(report.legacyScore), live: live?.legacy ?? null },
      { key: 'wealth', label: t('summary.boards.wealth'), raw: state.totals.grossEarnings, display: money(state.totals.grossEarnings), live: live?.wealth ?? null },
      { key: 'value', label: t('summary.boards.value'), raw: state.totals.peakMarketValue, display: money(state.totals.peakMarketValue), live: live?.value ?? null },
    ];
    return rows.map((row) => {
      const estimate = percentileFor(row.key, row.raw);
      return {
        ...row,
        percent: row.live?.percent ?? estimate.percent,
        rank: row.live?.rank ?? estimate.rank,
      };
    });
  }, [report, state.totals, live, t, money]);

  /**
   * The daily challenge's standing, when this career was one.
   *
   * The server returns a same-seed board for every run — it has no opinion
   * about which seed today's is — so the decision about whether the player
   * earned a *challenge* board is made here, where the seed's shape and the
   * pace are both known. On a one-off seed this is a field of one and stays
   * hidden; on the daily it is the only board in the game where nobody can
   * blame the draw.
   */
  const dailyStanding = live?.sameWorld && isDailyRun(state.seed, state.pace) ? live.sameWorld : null;

  if (!report || !player) return null;

  const isGk = player.position === 'GK';
  const finalSeason = state.seasons[state.seasons.length - 1] ?? null;
  const lastClubId = finalSeason?.clubId ?? null;
  const lastClub = lastClubId ? INDEX.club(lastClubId) : null;
  const nation = (() => {
    try {
      return countryId ? INDEX.country(countryId) : null;
    } catch {
      return null;
    }
  })();

  /**
   * The season the career is remembered for. The definition lives in
   * `bestSeasonOf` so this header and the Turning points sheet can never name
   * two different years again — which they did, on the same screen.
   */
  const bestSeason = bestSeasonOf(state);
  const bestClub = bestSeason ? INDEX.club(bestSeason.clubId) : null;

  return (
    <>
      <Screen
        top={
          <div className="animate-rise flex items-center gap-3">
            {/* The highest he ever reached, not the number he retired on —
                which is usually a decade lower. Both were labelled "OVR", so
                the summary appeared to disagree with the last row of its own
                career table. */}
            <RatingChip overall={state.totals.peakOverall} size="lg" label={t('career.peakOverall')} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 text-[13px] leading-none">
                  {nation ? flagLabel(nation.iso, nation.id) : '—'}
                </span>
                <span className="num shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold">
                  #{player.shirtNumber}
                </span>
                <span className="display shrink-0 rounded-full bg-lime-500/15 px-1.5 py-0.5 text-[10px] font-bold text-lime-400">
                  {t(`positions.${player.position}`)}
                </span>
                <span className="truncate text-[11px] text-white/45">{player.lastName}</span>
              </div>
              <h1 className="display mt-0.5 truncate text-[24px] font-bold uppercase leading-none text-lime-400">
                {t(`endings.${report.endingId}.title`)}
              </h1>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] leading-none text-white/45">
                {lastClub ? <Crest club={lastClub} size={14} /> : null}
                <span className="truncate">{lastClub ? clubShort(lastClub) : '—'}</span>
                <span className="shrink-0 text-white/25">·</span>
                <span className="num shrink-0">
                  {/* The age of the final row of the career table, not the
                      retirement age one year past it — so the club, the age and
                      the value on this line are the same end-of-career point,
                      and match the last row the player just read. */}
                  {t('career.age')} {finalSeason?.age ?? player.age}
                </span>
                <span className="shrink-0 text-white/25">·</span>
                {/* His value at the end, beside his final club and age — not the
                    career-high, which is celebrated (and labelled) on the
                    "highest valuation" board below. A peak figure sitting
                    unlabelled next to current facts read as a live valuation
                    that disagreed with everything around it. */}
                <span className="num shrink-0">{money(player.marketValue)}</span>
              </div>
              {bestSeason ? (
                <div className="mt-1 flex items-center gap-1 truncate text-[10.5px] leading-none text-white/35">
                  <span className="shrink-0 text-gold">★</span>
                  <span className="truncate">
                    {/* Age, never a year. A career is read in ages here and
                        in the record table, and a calendar year would be the
                        one place the game dated itself. */}
                    {t('summary.bestSeason', {
                      club: bestClub ? clubShort(bestClub) : '—',
                      age: bestSeason.age,
                    })}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        }
        middle={
          <div className="flex h-full min-h-0 flex-col gap-2">
            {/* The career table keeps its own scrollbar so the closing panel
                below it is always on screen — the whole point of this page is
                that it is one screenshot, not a scroll. */}
            <div className="min-h-[86px] flex-1 overflow-hidden">
              <CareerList state={state} />
            </div>

            <div className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
              {/* The ending had a name and nothing else, which read as a
                  slogan rather than a judgement. Labelled and quoted, it is
                  obvious what it is and who is saying it. */}
              <div className="text-center">
                <div className="display text-[8px] font-bold uppercase tracking-[0.16em] text-white/35">
                  {t('summary.verdict')}
                </div>
                <p className="mt-1 text-[11.5px] italic leading-snug text-white/70">
                  “{t(`endings.${report.endingId}.body`)}”
                </p>
              </div>

              {/* How it happened, behind a tap. A twenty-season career is thirty
                  cards and listing them back is a log, not a story; this is the
                  three or four moments a player would name themselves. In a
                  sheet because this page is one screenshot and must not grow. */}
              {points.length > 1 ? (
                <button
                  onClick={() => setTurning(true)}
                  className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] py-1 text-[10.5px] font-semibold text-white/55"
                >
                  {t('summary.turningPoints')}
                  <span className="text-white/30">›</span>
                </button>
              ) : null}

              <div className="mt-2 grid grid-cols-5 gap-1 border-y border-white/8 py-2">
                <Total label={t('stats.appearances')} value={state.totals.appearances} />
                <Total
                  label={isGk ? t('stats.cleanSheets') : t('stats.goals')}
                  value={isGk ? state.totals.cleanSheets : state.totals.goals}
                />
                <Total
                  label={isGk ? t('stats.goalsConceded') : t('stats.assists')}
                  value={isGk ? conceded : state.totals.assists}
                />
                <Total label={t('career.trophies')} value={totalTrophies} />
                <Total label={t('summary.avgRating')} value={careerRating} decimals={2} />
              </div>

              {honours.length > 0 ? (
                <div className="mt-2 flex flex-nowrap items-end justify-center gap-x-1 overflow-hidden">
                  {honours.map((honour) => (
                    <span key={honour.label} className="relative shrink-0" title={honour.label}>
                      {honour.art ? (
                        <img
                          src={asset(`trophies/${honour.art}`)}
                          alt={honour.label}
                          style={{ height: honourSize, width: honourSize }}
                          className="select-none object-contain drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]"
                        />
                      ) : (
                        <AwardMedal size={honourSize} title={honour.label} />
                      )}
                      {honour.count > 1 ? (
                        <span className="num absolute -bottom-0.5 -right-1 flex min-w-[15px] items-center justify-center rounded-full border border-white/30 bg-black/80 px-0.5 text-[8.5px] font-bold leading-[14px]">
                          ×{honour.count}
                        </span>
                      ) : null}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-center text-[11.5px] text-white/35">{t('career.noTrophies')}</div>
              )}

              {/* Only the achievements board carries an (i). It is a score
                  assembled from eight weighted parts and is unreadable without
                  the rule; wealth and highest valuation are one number each,
                  already named by the label above them, and an explainer on
                  them was three icons where one was needed. */}
              {/* The daily board is a line of its own rather than a fourth
                  tile: the grid is three columns, and a fourth cell would sit
                  alone on a second row looking like a layout bug. It also is
                  not the same kind of number — the three tiles rank a career
                  against every career ever played, this one ranks it against
                  the people who were handed the identical world today. */}
              {dailyStanding ? (
                <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-gold/35 bg-gold/[0.08] px-2.5 py-[7px]">
                  <span className="display text-[8px] font-bold uppercase leading-none tracking-[0.1em] text-gold/75">
                    {t('summary.dailyBoard.label')}
                  </span>
                  <span className="num text-[12.5px] font-bold leading-none text-gold">
                    {dailyStanding.total > 1
                      ? t('summary.dailyBoard.standing', {
                          rank: dailyStanding.rank,
                          total: dailyStanding.total,
                        })
                      : t('summary.dailyBoard.alone')}
                  </span>
                </div>
              ) : null}

              <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                {boards.map((board) => {
                  const explained = board.key === 'legacy';
                  return (
                  <button
                    key={board.key}
                    onClick={explained ? () => setExplain(board.key) : undefined}
                    aria-disabled={explained ? undefined : true}
                    className={`relative rounded-xl border px-1.5 py-1.5 text-center ${
                      board.percent <= 5 ? 'border-gold/35 bg-gold/[0.08]' : 'border-white/10 bg-white/[0.03]'
                    }`}
                  >
                    {explained ? (
                      <span
                        aria-hidden
                        className="absolute right-1 top-1 flex h-[13px] w-[13px] items-center justify-center rounded-full border border-white/25 text-[8px] font-bold italic leading-none text-white/45"
                      >
                        i
                      </span>
                    ) : null}
                    {/* Two lines, not an ellipsis: "Highest valuation" is the
                        whole point of the card and cannot be cut to "Highest
                        valuati…". */}
                    <div
                      className={`display line-clamp-2 h-[18px] text-[8px] font-bold uppercase leading-[1.15] tracking-[0.1em] text-white/40 ${
                        explained ? 'pr-3' : ''
                      }`}
                    >
                      {board.label}
                    </div>
                    <div
                      className={`num mt-0.5 truncate text-[15px] font-bold leading-none ${
                        board.percent <= 5 ? 'text-gold' : ''
                      }`}
                    >
                      {board.display}
                    </div>
                    <div className="num mt-0.5 text-[9.5px] leading-none text-white/40">
                      {t('summary.percentile', { percent: board.percent })}
                    </div>
                  </button>
                  );
                })}
              </div>

              {/* The career still counted — it just cannot be verified, because
                  the rules moved while it was being played and the server's
                  replay of it would no longer reproduce these numbers. Saying so
                  is the whole point: silently posting nothing looks like the
                  leaderboard is broken. */}
              {rankable ? null : (
                <div className="mt-2 text-center text-[10px] leading-tight text-white/35">
                  {t('summary.unrankable')}
                </div>
              )}
            </div>
          </div>
        }
        bottom={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" size="sm" className="whitespace-nowrap" onClick={() => setShareOpen(true)}>
              {t('summary.viewSummary')}
            </Button>
            <Button size="sm" className="whitespace-nowrap" onClick={onReplay}>
              {t('summary.replay')}
            </Button>
          </div>
        }
      />

      <Sheet
        open={explain !== null}
        onClose={() => setExplain(null)}
        title={explain ? boards.find((b) => b.key === explain)?.label ?? '' : ''}
      >
        <p className="text-[12.5px] leading-relaxed text-white/60">
          {explain ? t(`summary.boardHints.${explain}`) : ''}
        </p>
        {/* Only the achievements score is a sum of parts worth itemising; the
            other two are one number each and the sentence above is all of it. */}
        <div className={`mt-3 space-y-2 ${explain === 'legacy' ? '' : 'hidden'}`}>
          {report.breakdown
            .filter((entry) => entry.value !== 0)
            .map((entry) => (
              <div key={entry.key}>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-[12px] text-white/55">{t(`summary.legacyKeys.${entry.key}`)}</span>
                  <span className={`num text-[13px] font-bold ${entry.value < 0 ? 'text-loss' : ''}`}>
                    {entry.value > 0 ? '+' : ''}
                    {entry.value}
                  </span>
                </div>
                <Meter
                  value={Math.abs(entry.value)}
                  max={Math.max(...report.breakdown.map((e) => Math.abs(e.value)), 1)}
                  height={4}
                  tone={entry.value < 0 ? 'loss' : 'lime'}
                />
              </div>
            ))}
        </div>
      </Sheet>

      <Sheet open={turning} onClose={() => setTurning(false)} title={t('summary.turningPoints')}>
        <div className="space-y-2">
          {points.map((point, i) => {
            const pointClub = point.clubId ? safeClubOf(point.clubId) : null;
            return (
              <div key={`${point.kind}-${i}`} className="flex items-start gap-2.5">
                <span className="num mt-0.5 w-7 shrink-0 rounded bg-white/10 text-center text-[11px] font-bold leading-[18px]">
                  {point.age}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="display text-[12px] font-bold uppercase tracking-wide text-white/80">
                    {t(`summary.turning.${point.kind}`)}
                  </div>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-white/55">
                    {t(
                      // A move that won nothing is still the move that changed
                      // the career, but saying "won 0 trophies there" is worse
                      // than saying nothing about silverware at all.
                      point.kind === 'move' && !point.detail.trophies
                        ? 'summary.turning.moveBodyNone'
                        : `summary.turning.${point.kind}Body`,
                      {
                        club: pointClub ? clubShort(pointClub) : '',
                        from: point.detail.from ? clubShort(safeClubOf(point.detail.from)!) : '',
                        rating: point.detail.rating?.toFixed(2) ?? '',
                        cost: String(point.detail.cost ?? 0),
                        trophies: String(point.detail.trophies ?? 0),
                      },
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Sheet>

      {shareOpen ? (
        <ShareSheet
          onClose={() => setShareOpen(false)}
          build={(showName) =>
            renderShareCard({
              endingTitle: t(`endings.${report.endingId}.title`),
              lastName: showName ? player.lastName : '',
              shirtNumber: player.shirtNumber,
              position: t(`positions.${player.position}`),
              countryName: countryId ? countryName(countryId) : '',
              flag: nation ? flagLabel(nation.iso, nation.id) : '',
              peakOverall: state.totals.peakOverall,
              seasons: t('summary.seasonsPlayed', { count: state.seasons.length }),
              clubName: lastClub ? clubShort(lastClub) : null,
              clubCrestUrl: lastClub ? asset(`crests/${lastClub.id}.png`) : null,
              totals: {
                apps: state.totals.appearances,
                goals: isGk ? state.totals.cleanSheets : state.totals.goals,
                assists: isGk ? conceded : state.totals.assists,
                trophies: totalTrophies,
              },
              totalsLabels: {
                apps: t('stats.appearances'),
                goals: isGk ? t('stats.cleanSheets') : t('stats.goals'),
                assists: isGk ? t('stats.goalsConceded') : t('stats.assists'),
                trophies: t('career.trophies'),
              },
              boards: boards.map((board) => ({
                label: board.label,
                value: board.display,
                percentile: t('summary.percentile', { percent: board.percent }),
              })),
              art: honours
                .filter((honour) => honour.art !== null)
                .map((honour) => ({ src: asset(`trophies/${honour.art}`), count: honour.count })),
              national:
                capsTotal > 0 && nation
                  ? {
                      flag: flagLabel(nation.iso, nation.id),
                      name: countryName(nation.id),
                      caps: capsTotal,
                      goals: isGk ? nationalCleanSheets : nationalGoals,
                    }
                  : null,
              rows: state.seasons.map((season) => {
                const club = INDEX.club(season.clubId);
                return {
                  age: season.age,
                  club: clubShort(club),
                  crestUrl: asset(`crests/${club.id}.png`),
                  accent: club.colors[0],
                  overall: season.overallEnd,
                  apps: season.stats.appearances,
                  goals: isGk ? season.stats.goalsConceded : season.stats.goals,
                  assists: isGk ? season.stats.cleanSheets : season.stats.assists,
                };
              }),
              footer: t('app.title'),
            })
          }
          fileName={`${player.lastName || 'career'}-${state.totals.peakOverall}.png`}
          locale={locale}
        />
      ) : null}
    </>
  );
}

function Total({ label, value, decimals = 0 }: { label: string; value: number; decimals?: number }) {
  const { reducedMotion } = useSettings();
  const shown = useCountUp(value, !reducedMotion, 900, 0, decimals);
  return (
    <div className="flex min-w-0 flex-col items-center">
      {/* Two lines rather than an ellipsis: at five columns "Clean sheets" no
          longer fits on one, and half a word is worse than a wrap. */}
      <span className="line-clamp-2 h-[18px] w-full text-center text-[8px] font-bold uppercase leading-[1.15] tracking-wide text-white/35">
        {label}
      </span>
      <span className="num mt-0.5 text-[18px] font-bold leading-none">{shown.toFixed(decimals)}</span>
    </div>
  );
}

/** WeChat's in-app browser, on both phones. */
function inWeChat(): boolean {
  return /MicroMessenger/i.test(navigator.userAgent);
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * The card itself: rendered once when the sheet opens, then saved, shared or
 * copied. Every path degrades — a browser with no `navigator.share` still gets
 * a download, and one with no clipboard image support still gets both.
 */
function ShareSheet({
  onClose,
  build,
  fileName,
  locale,
}: {
  onClose: () => void;
  build: (showName: boolean) => Promise<Blob | null>;
  fileName: string;
  locale: string;
}) {
  const { t } = useI18n();
  /**
   * The rendered card, and which version of it this is.
   *
   * `forName` is what removed a synchronous `setUrl(null)` from the effect
   * below. Clearing the old card that way worked, but it is a state update
   * inside an effect body — one extra render every time, and `react-hooks`
   * 7 rightly flags it. Carrying the toggle's value alongside the URL says the
   * same thing without a render: a card whose `forName` is not the current
   * toggle is the *previous* card, which is the definition of not ready.
   */
  const [card, setCard] = useState<{ url: string; forName: boolean } | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [note, setNote] = useState<string | null>(null);
  /**
   * The card is made to be posted, so whether a real name goes out on it is the
   * user's call and not ours. On by default — people type a surname because they
   * want to see it on the shirt — but one tap removes it, and the card is rebuilt
   * rather than covered up, so what is downloaded is what is shown.
   */
  const [showName, setShowName] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    void build(showName).then(async (result) => {
      if (cancelled || !result) return;
      setBlob(result);
      if (inWeChat()) {
        // WeChat's browser will not offer "save image" or "send to friend" on a
        // `blob:` source, and that long-press menu is how a card gets shared in
        // China — there is no `navigator.share` there either. A data URL costs
        // a base64 copy of the PNG in memory and is worth it.
        const data = await toDataUrl(result);
        if (cancelled) return;
        setCard({ url: data, forName: showName });
        return;
      }
      objectUrl = URL.createObjectURL(result);
      setCard({ url: objectUrl, forName: showName });
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // Rebuilt only when the name toggle flips: the career is finished, so
    // nothing else about the card can change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showName]);

  /** The card for the toggle as it stands now; anything else is the old one. */
  const url = card && card.forName === showName ? card.url : null;

  const download = useCallback(() => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
  }, [url, fileName]);

  const share = useCallback(async () => {
    if (!blob) return;
    // Counted on the attempt rather than the outcome: a share sheet that the
    // player opens and closes is still the player wanting to show somebody,
    // and the browser does not reliably say which of the two happened.
    track('share');
    const file = new File([blob], fileName, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setNote(t('summary.copied'));
    } catch {
      // A cancelled share throws too; only say something went wrong if there
      // is genuinely no path left, and always leave the download button there.
      setNote(t('summary.shareFailed'));
    }
  }, [blob, fileName, t]);

  return (
    <Sheet open onClose={onClose} title={t('summary.share')}>
      <div className="flex min-h-[280px] items-center justify-center rounded-xl bg-black/40 p-2">
        {url ? (
          <img
            src={url}
            alt=""
            className="max-h-[46vh] w-auto rounded-lg"
            // Long-press to save is how this is used on a phone.
            style={{ touchAction: 'manipulation' }}
          />
        ) : (
          <span className="animate-pulse text-[12.5px] text-white/45">{t('summary.rendering')}</span>
        )}
      </div>

      <button
        onClick={() => setShowName((on) => !on)}
        className="mt-2 flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left"
      >
        <span className="text-[12.5px] text-white/70">{t('summary.showName')}</span>
        <span
          className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${
            showName ? 'bg-lime-500' : 'bg-white/15'
          }`}
        >
          <span
            className={`absolute top-[3px] h-4 w-4 rounded-full bg-white transition-all ${
              showName ? 'left-[19px]' : 'left-[3px]'
            }`}
          />
        </span>
      </button>

      {note ? <div className="mt-2 text-center text-[11.5px] text-white/55">{note}</div> : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={download}>
          {t('summary.download')}
        </Button>
        <Button onClick={share}>{t('summary.shareImage')}</Button>
      </div>
      <p className="mt-2 text-center text-[10.5px] leading-snug text-white/30">
        {locale === 'zh' ? '长按图片也可以直接保存' : 'Long-press the image to save it too'}
      </p>
    </Sheet>
  );
}


function safeClubOf(id: string) {
  try {
    return INDEX.club(id);
  } catch {
    return null;
  }
}
