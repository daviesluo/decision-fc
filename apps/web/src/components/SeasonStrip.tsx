import { isPercentage, statLineFor, type Position, type SeasonRecord } from '@bg/engine';
import { useI18n } from '../lib/i18n';
import { INDEX, localizeParams, trophyName } from '../lib/game';
import { Crest } from './Crest';
import { Trophy } from './Trophy';
import { Delta, Pill, SectionLabel } from './ui';

/**
 * What just happened, in one fixed-height block.
 *
 * Only the most recent season is shown in full. When several elapsed — quick
 * pace runs three at a time — the earlier ones collapse to a row of years, and
 * anything won along the way is still surfaced as a pill. The alternative was a
 * list that grows until the screen scrolls, which is the thing being fixed.
 *
 * The four numbers are chosen by position: a centre-back's season is clean
 * sheets and duels, not goals and assists.
 */
export function SeasonStrip({
  seasons,
  position,
  countryId,
  compact = false,
}: {
  seasons: readonly SeasonRecord[];
  position: Position;
  /** The player's nationality, which names the international trophies. */
  countryId: string;
  /**
   * Set when the decision below needs the vertical space — a four-option
   * transfer window does not leave room for the full block on a 667px screen.
   * Compact drops the crest row and the press line and keeps the numbers,
   * which is the part that cannot be clipped without looking broken.
   */
  compact?: boolean;
}) {
  const { t, clubShort } = useI18n();
  if (seasons.length === 0) return null;

  const latest = seasons[seasons.length - 1]!;
  const earlier = seasons.slice(0, -1);
  const club = INDEX.club(latest.clubId);
  const keys = statLineFor(position);

  // Anything won across the whole gap, not only in the season shown.
  const trophies = seasons.flatMap((s) =>
    s.trophies.map((trophy) => ({ trophy, clubId: s.clubId, leagueId: s.leagueId })),
  );
  const awards = seasons.flatMap((s) => s.awards);
  const headline = latest.headlines[0] ?? seasons.flatMap((s) => s.headlines)[0];

  if (compact) {
    return (
      <div className="animate-rise">
        <div className="mb-1.5 flex items-baseline gap-2">
          <span className="num shrink-0 text-[11px] font-bold text-white/45">
            {t('career.age')} {latest.age}
          </span>
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-white/45">
            {clubShort(club)} · {t(`roles.${latest.role}`)}
          </span>
          <span className="num shrink-0 text-[14px] font-bold">{latest.stats.rating.toFixed(2)}</span>
          <Delta value={latest.overallEnd - latest.overallStart} />
        </div>
        <div className="card grid grid-cols-4 gap-1 px-2 py-1.5">
          {keys.map((key) => (
            <div key={key} className="text-center">
              <div className="num text-[15px] font-bold leading-none">
                {latest.stats[key]}
                {isPercentage(key) ? <span className="text-[10px] text-white/40">%</span> : null}
              </div>
              <div className="mt-0.5 truncate text-[8.5px] font-semibold uppercase tracking-wide text-white/40">
                {t(`stats.${key}`)}
              </div>
            </div>
          ))}
        </div>
        {trophies.length > 0 || awards.length > 0 || latest.injuryId || latest.relegated || latest.promoted ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {trophies.map(({ trophy, clubId, leagueId }, i) => (
              <Pill key={`${trophy}-${i}`} tone="gold">
                <Trophy trophy={trophy} clubId={clubId} countryId={countryId} leagueId={leagueId} size={11} />
                {trophyName(trophy, t, { clubId, countryId })}
              </Pill>
            ))}
            {awards.map((award, i) => (
              <Pill key={`${award}-${i}`} tone="gold">★ {t(`awards.${award}`)}</Pill>
            ))}
            {latest.injuryId ? (
              <Pill tone="negative">{t(`injuries.${latest.injuryId}`)} · {latest.injuryWeeks}w</Pill>
            ) : null}
            {latest.relegated ? <Pill tone="negative">{t('career.relegated')}</Pill> : null}
            {latest.promoted ? <Pill tone="positive">{t('career.promoted')}</Pill> : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="animate-rise">
      <SectionLabel
        right={
          earlier.length > 0 ? (
            <span className="num shrink-0 text-[10px] text-white/30">
              +{earlier.length} {t('career.season')}
            </span>
          ) : null
        }
      >
        {t('career.age')} {latest.age}
      </SectionLabel>

      <div className="card px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <Crest club={club} size={30} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold leading-none">{clubShort(club)}</div>
            <div className="mt-1 text-[11px] leading-none text-white/45">{t(`roles.${latest.role}`)}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="num text-[19px] font-bold leading-none">{latest.stats.rating.toFixed(2)}</div>
            <div className="mt-0.5 leading-none">
              <Delta value={latest.overallEnd - latest.overallStart} />
            </div>
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-4 gap-1 border-t border-white/8 pt-2.5">
          {keys.map((key) => (
            <div key={key} className="text-center">
              <div className="num text-[17px] font-bold leading-none">
                {latest.stats[key]}
                {isPercentage(key) ? <span className="text-[11px] text-white/40">%</span> : null}
              </div>
              <div className="mt-1 truncate text-[9px] font-semibold uppercase tracking-wider text-white/40">
                {t(`stats.${key}`)}
              </div>
            </div>
          ))}
        </div>

        {trophies.length > 0 || awards.length > 0 || latest.injuryId ? (
          <div className="mt-2.5 flex flex-wrap gap-1 border-t border-white/8 pt-2.5">
            {trophies.map(({ trophy, clubId, leagueId }, i) => (
              <Pill key={`${trophy}-${i}`} tone="gold">
                <Trophy trophy={trophy} clubId={clubId} countryId={countryId} leagueId={leagueId} size={12} />
                {trophyName(trophy, t, { clubId, countryId })}
              </Pill>
            ))}
            {awards.map((award, i) => (
              <Pill key={`${award}-${i}`} tone="gold">
                ★ {t(`awards.${award}`)}
              </Pill>
            ))}
            {latest.injuryId ? (
              <Pill tone="negative">
                {t(`injuries.${latest.injuryId}`)} · {latest.injuryWeeks}w
              </Pill>
            ) : null}
            {latest.relegated ? <Pill tone="negative">{t('career.relegated')}</Pill> : null}
            {latest.promoted ? <Pill tone="positive">{t('career.promoted')}</Pill> : null}
          </div>
        ) : null}
      </div>

      {headline ? <HeadlineRow headline={headline} /> : null}
    </div>
  );
}

/** One line of press, attributed to the outlet that ran it. */
function HeadlineRow({ headline }: { headline: SeasonRecord['headlines'][number] }) {
  const { t, outlet, money, clubName } = useI18n();
  const params = localizeParams(headline.params, clubName, t);
  if (typeof params.fee === 'number') params.fee = money(params.fee);

  const accent =
    headline.tone === 'positive'
      ? 'border-l-gain'
      : headline.tone === 'negative'
        ? 'border-l-loss'
        : 'border-l-white/25';

  return (
    <div className={`mt-2 border-l-2 pl-2.5 ${accent}`}>
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/35">
        {outlet(headline.outletId)}
      </div>
      <div className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-white/70">
        {t(`headlines.${headline.key}`, params)}
      </div>
    </div>
  );
}
