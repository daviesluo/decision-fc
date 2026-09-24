import { useEffect, useRef } from 'react';
import type { CareerState, Position, SeasonRecord, SquadRole, StatKey } from '@bg/engine';
import { useI18n } from '../lib/i18n';
import { INDEX, trophyName } from '../lib/game';
import { flagLabel } from '../lib/flags';
import { useCountUp } from '../lib/countUp';
import { useSettings } from '../lib/settings';
import { Crest } from './Crest';
import { AWARD_ART, AwardMedal, Trophy } from './Trophy';
import { MatchRating, RatingChip } from './rating';
import { asset } from '../lib/assets';

/**
 * Header, season rows and the international line all share one column track,
 * written out in full so Tailwind's scanner can see it. A goalkeeper's last two
 * headings are longer words — conceded, clean sheets — so his table gets a
 * wider pair rather than an abbreviation.
 */
// The starts(sub) column is the widest of the stat columns on purpose: it holds
// two numbers and a header that has to read on one line ("Starts (sub)").
// The stat pair sits on 34px — sized for two-digit numbers under an
// abbreviated heading (career.cols) — because 42px columns sized for the words
// "INTERCEPTIONS" and "RATING" were still clipping them AND starving the club
// column: a 3,200-career sweep showed "Sunderla…" in English and "圣埃蒂安"
// squeezed in Chinese. The freed width goes to the club name.
// Sized by behaviour, not arithmetic: "STARTS (SUB)" clips at 56 and fits at
// 60 (measured across hundred-career sweeps), a two-digit stat needs no more
// than 26, and every pixel the fixed columns give back belongs to the club
// name — the one cell whose content the game cannot shorten.
const COLUMNS = 'grid-cols-[20px_minmax(0,1fr)_28px_60px_26px_26px_30px]';

/**
 * The two stats a season is judged on, by position — the ones that describe
 * that job rather than every job. Forwards and the attacking mid live on goals
 * and assists; the rest of the midfield on assists and interceptions; the back
 * line on clean sheets and tackles; the keeper on clean sheets and saves.
 *
 * Tackles and interceptions are one idea — winning the ball back — shown under
 * the name each position is read by: a centre-back tackles, a holding
 * midfielder intercepts. Every value is already in the season record, so this
 * only chooses which two to print.
 */
function statPairFor(position: Position): readonly [StatKey, StatKey] {
  if (position === 'GK') return ['cleanSheets', 'saves'];
  if (position === 'CB' || position === 'LB' || position === 'RB') return ['cleanSheets', 'tackles'];
  if (position === 'ST' || position === 'LW' || position === 'RW' || position === 'CAM') return ['goals', 'assists'];
  return ['assists', 'interceptions'];
}

/**
 * The career, one row per season, keyed by age — never by year. This is the
 * scoreboard the whole game plays onto: every age slot shows the club crest,
 * what was won, and the numbers that mattered. Loan spells carry a tab-in
 * arrow; the season being decided pulses at the bottom.
 */
export function CareerList({ state }: { state: CareerState }) {
  const { t } = useI18n();
  const endRef = useRef<HTMLDivElement>(null);
  const player = state.player;

  useEffect(() => {
    // The table follows the newest season, during play and on the summary
    // alike — the last years are the ones worth landing on.
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [state.seasons.length, state.pending?.id]);

  if (!player) return null;
  const [stat1, stat2] = statPairFor(player.position);
  const columns = COLUMNS;

  return (
    <div data-career-table className="flex h-full min-h-0 flex-col">
      {/* Column headings are words, not initials. "G" and "A" are conventions
          a football fan reads instantly and nobody else does, and their Chinese
          equivalents — 球, 助 — are not even that. The row is two lines tall and
          bottom-aligned so a long heading wraps instead of forcing an
          abbreviation back in. */}
      <div
        className={`mb-1 grid h-[18px] ${columns} items-end gap-[3px] px-1 text-[7.5px] font-bold uppercase leading-[1.05] text-white/30`}
      >
        <span>{t('career.age')}</span>
        <span>{t('career.club')}</span>
        <span className="text-center">{t('career.overall')}</span>
        <span className="whitespace-nowrap text-center">{t('career.apps')}</span>
        <span className="text-center">{t(`career.cols.${stat1}`)}</span>
        <span className="text-center">{t(`career.cols.${stat2}`)}</span>
        <span className="text-center">{t('career.rating')}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        {state.seasons.map((season, i) => (
          <SeasonRow
            key={season.index}
            record={season}
            stat1={stat1}
            stat2={stat2}
            columns={columns}
            countryId={player.countryId}
            // Only the season that just landed counts up; the ones already on
            // the table are history and must not re-animate on every render.
            fresh={i === state.seasons.length - 1}
          />
        ))}
        {state.pending ? <PendingRow age={player.age} /> : null}
        <div ref={endRef} />
      </div>
      <NationalTeamRow state={state} goalsColumn={stat1 === 'goals'} columns={columns} />
    </div>
  );
}

/**
 * The international career, pinned under the club rows — caps and goals for
 * your country are a separate line on any real career page, and they are the
 * line people are proudest of.
 */
function NationalTeamRow({ state, goalsColumn, columns }: { state: CareerState; goalsColumn: boolean; columns: string }) {
  const { t, country } = useI18n();
  const player = state.player;
  if (!player) return null;

  let caps = 0;
  let goals = 0;
  let apps = 0;
  const trophies: string[] = [];
  for (const season of state.seasons) {
    if (season.nationalStats) {
      caps += season.nationalStats.appearances;
      goals += season.nationalStats.goals;
      apps += season.nationalStats.appearances;
    }
    for (const trophy of season.trophies) {
      if (trophy === 'world_cup' || trophy === 'continental_nations') trophies.push(trophy);
    }
  }
  if (apps === 0) return null;

  return (
    <div className={`mt-1 grid shrink-0 ${columns} items-center gap-[3px] rounded-md border-t border-white/10 bg-white/[0.03] px-1 py-[3px]`}>
      <span className="text-center text-[11px] leading-none">{nationFlag(player.countryId)}</span>
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate text-[11px] font-semibold leading-none text-white/80">
          {country(player.countryId)}
        </span>
        {trophies.map((trophy, i) => (
          <Trophy
            key={i}
            trophy={trophy}
            countryId={player.countryId}
            size={11}
            title={trophyName(trophy, t, { countryId: player.countryId })}
          />
        ))}
      </span>
      <span className="text-center text-[8.5px] uppercase leading-none text-white/35">{t('career.caps')}</span>
      <span className="num text-center text-[10.5px] leading-none text-white/60">{caps}</span>
      {/* National goals only line up under a goals column; for the rest of the
          pitch the international line carries caps and its trophies, not a stat
          the national team never tracked for that role. */}
      <span className="num text-center text-[10.5px] leading-none text-white/60">{goalsColumn ? goals : '—'}</span>
      <span className="num text-center text-[10.5px] leading-none text-white/60">—</span>
      <span className="num text-center text-[10.5px] leading-none text-white/60">—</span>
    </div>
  );
}

/** The player's own flag, or a blank one if the content pack lost the row. */
function nationFlag(countryId: string): string {
  try {
    const country = INDEX.country(countryId);
    return flagLabel(country.iso, country.id);
  } catch {
    return '\u{1F3F3}\uFE0F';
  }
}

/**
 * How much of a season's appearances were starts, by the squad role he held
 * that year — a regular starter is almost all starts, an impact sub almost all
 * off the bench. Display-only and deterministic: it never touches the engine's
 * totals, it reads the one number they already produced the two ways a fan
 * expects, and the two always sum back to it.
 */
const START_SHARE: Record<SquadRole, number> = {
  star: 0.95,
  important: 0.9,
  regular: 0.85,
  squad: 0.6,
  impact_sub: 0.2,
  fringe: 0.35,
};

function SeasonRow({
  record,
  stat1,
  stat2,
  columns,
  countryId,
  fresh = false,
}: {
  record: SeasonRecord;
  stat1: StatKey;
  stat2: StatKey;
  columns: string;
  countryId: string;
  fresh?: boolean;
}) {
  const { t, clubShort } = useI18n();
  const { reducedMotion } = useSettings();
  const animate = fresh && !reducedMotion;
  const startsTotal = Math.round(record.stats.appearances * (START_SHARE[record.role] ?? 0.7));
  const subs = record.stats.appearances - startsTotal;
  const starts = useCountUp(startsTotal, animate);
  const first = useCountUp(record.stats[stat1], animate);
  const second = useCountUp(record.stats[stat2], animate);
  const club = INDEX.club(record.clubId);
  const [primary] = club.colors;

  const honors: { icon: React.ReactNode; label: string; tone: string }[] = [];
  // Going up and going down lead, because they are the two facts about a season
  // that change what the next one is — and the row only shows four icons, so a
  // season with silverware could push a promotion off the end and lose the one
  // thing that explains why the following rows are a division higher.
  if (record.promoted) honors.push({ icon: '▲', label: t('career.promoted'), tone: 'text-gain' });
  if (record.relegated) honors.push({ icon: '▼', label: t('career.relegated'), tone: 'text-loss' });
  for (const trophy of record.trophies) {
    const label = trophyName(trophy, t, { clubId: record.clubId, countryId });
    honors.push({
      icon: <Trophy trophy={trophy} clubId={record.clubId} countryId={countryId} leagueId={record.leagueId} size={11} />,
      label,
      tone: 'text-gold',
    });
  }
  // Each award wears its own face: the Ballon d'Or (and the Boots and Gloves)
  // have real artwork, so a season with one must not show the same drawn medal
  // as Team of the Season — a Ballon d'Or year used to look
  // identical to a best-XI year. The drawn medal stays only for awards with no
  // artwork, and never an emoji: 🏅 is a different picture on every phone.
  for (const award of record.awards) {
    honors.push({
      icon: AWARD_ART[award] ? (
        <img src={asset(`trophies/${AWARD_ART[award]}`)} alt="" width={11} height={11} className="shrink-0 object-contain" />
      ) : (
        <AwardMedal size={11} />
      ),
      label: t(`awards.${award}`),
      tone: 'text-gold',
    });
  }
  if (record.injuryWeeks > 8) {
    honors.push({
      icon: '✚',
      // The injury *and* how long it took. "Hamstring" alone does not explain
      // a season of nine appearances; "hamstring, out 21 weeks" does.
      label: `${t(`injuries.${record.injuryId ?? 'hamstring'}`)} · ${t('career.injured', { weeks: record.injuryWeeks })}`,
      tone: 'text-loss',
    });
  }
  /* A ban costs the whole season — the role is frozen at fringe, nothing
     develops, the national side cannot pick him — and the row said nothing
     about it. A reader saw six appearances at twenty-six with no reason given,
     which reads as the game losing a season rather than the player. Drawn
     rather than 🟥, for the same reason the medal is drawn. */
  if (record.suspended) {
    honors.push({
      icon: <span className="inline-block h-[11px] w-[8px] rounded-[1px] bg-loss align-[-1px]" />,
      label: t('career.suspended'),
      tone: 'text-loss',
    });
  }

  return (
    <div
      className={`grid ${columns} items-center gap-[3px] rounded-md px-1 py-[3px]`}
      style={{ background: `linear-gradient(90deg, ${primary}14, transparent 70%)` }}
    >
      <span
        className="num rounded-[5px] py-[2px] text-center text-[10.5px] font-bold leading-none"
        style={{ background: primary, color: contrastText(primary) }}
      >
        {record.age}
      </span>

      {/* 2px inside the cell, not 4: with a loan arrow, a crest and three
          honours all present, a five-hanzi club name (安德莱赫特) was losing
          the last few pixels to the gaps alone. */}
      <span className="flex min-w-0 items-center gap-[2px]">
        {record.onLoanFrom ? (
          <span className="shrink-0 text-[10px] leading-none text-white/40" title={t('career.onLoan')}>
            ↳
          </span>
        ) : null}
        <Crest club={club} size={15} />
        <span className="truncate text-[10.5px] font-semibold leading-none text-white/80">{clubShort(club)}</span>
        {honors.length > 0 ? (
          // Two icons and a "+n", full stop. Every wider cap lost the fight
          // with a long club name eventually — "Sunderla…", then a squeezed
          // 安德莱赫特, then "Real Madrid" beside a loan arrow — and the name
          // is what a row is found by. The count keeps the season's haul
          // honest, every icon still names itself on hover, and the honours
          // shelf on the summary shows the lot.
          <span className="flex shrink-0 items-center -space-x-0.5">
            {honors.slice(0, 2).map((honor, i) => (
              <span key={i} title={honor.label} className={`text-[9px] leading-none ${honor.tone}`}>
                {honor.icon}
              </span>
            ))}
            {honors.length > 2 ? (
              <span className="pl-1 text-[8px] text-white/40">+{honors.length - 2}</span>
            ) : null}
          </span>
        ) : null}
      </span>

      <RatingChip overall={record.overallEnd} />
      {/* The stat columns are plain numbers under named headers now — the
          per-cell icons went with the position-specific columns, since there is
          no glyph for a tackle or an interception that reads at nine pixels, and
          the heading already says what the number is. Starts carry the
          substitute appearances in brackets, the way a fan reads a season. */}
      <span className="num text-center text-[10.5px] leading-none text-white/60">
        {starts} ({subs})
      </span>
      <span className="num text-center text-[10.5px] leading-none text-white/60">{first}</span>
      <span className="num text-center text-[10.5px] leading-none text-white/60">{second}</span>
      {/* How he actually played, not just how much. A 6.4 season of forty
          appearances and a 7.3 season of forty are different careers — and a
          season he never got on the pitch for has no rating at all. */}
      {record.stats.appearances > 0 ? (
        <MatchRating rating={record.stats.rating} className="text-center text-[10.5px] font-semibold leading-none" />
      ) : (
        <span className="num text-center text-[10.5px] leading-none text-white/25">—</span>
      )}
    </div>
  );
}

function PendingRow({ age }: { age: number }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-[22px_minmax(0,1fr)] items-center gap-1 rounded-md bg-white/[0.05] px-1 py-[3px]">
      <span className="num animate-pulse rounded-[5px] bg-white/15 py-[2px] text-center text-[10.5px] font-bold leading-none text-white/70">
        {age}
      </span>
      <span className="animate-pulse truncate text-[11px] leading-none text-white/45">{t('career.choosing')}</span>
    </div>
  );
}

/** Black or white, whichever survives on the club colour. */
function contrastText(hex: string): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#0b1a12' : '#ffffff';
}
