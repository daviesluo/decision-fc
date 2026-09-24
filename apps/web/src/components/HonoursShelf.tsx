import type { AwardId, CareerState, TrophyId } from '@bg/engine';
import { useI18n } from '../lib/i18n';
import { AWARD_ART, AwardMedal, Trophy } from './Trophy';
import { asset } from '../lib/assets';

/**
 * What the career has won so far, on a shelf.
 *
 * A phone has no room for it: the screen is the career table and the decision,
 * and honours are already marked on the season they were won. A computer has a
 * whole column of space beside the card, and leaving it empty was the reason
 * the two-column layout looked unfinished — the eye needs something between the
 * player and the question, and "what you have won" is the thing a player
 * actually wants there.
 *
 * Grouped with a count rather than repeated, because four league titles is one
 * fact about a career and four identical cups in a row is wallpaper.
 */
export function HonoursShelf({ state }: { state: CareerState }) {
  const { t } = useI18n();

  const trophies = new Map<TrophyId, { count: number; clubId: string | null; leagueId: string | null }>();
  const awards = new Map<AwardId, number>();
  for (const season of state.seasons) {
    for (const trophy of season.trophies) {
      const held = trophies.get(trophy);
      trophies.set(trophy, {
        count: (held?.count ?? 0) + 1,
        clubId: held?.clubId ?? season.clubId,
        // The division the first one was won in — clubs move divisions, and the
        // static world index does not.
        leagueId: held?.leagueId ?? season.leagueId,
      });
    }
    for (const award of season.awards) awards.set(award, (awards.get(award) ?? 0) + 1);
  }

  const empty = trophies.size === 0 && awards.size === 0;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <div className="mb-2 text-[10px] tracking-[0.14em] text-white/35 uppercase">
        {t('career.honours')}
      </div>
      {empty ? (
        <p className="text-[12px] leading-snug text-white/35">{t('career.honoursEmpty')}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {[...trophies].map(([trophy, { count, clubId, leagueId }]) => (
            <span key={trophy} className="flex items-center gap-1" title={t(`trophies.${trophy}`)}>
              <Trophy
                trophy={trophy}
                clubId={clubId}
                countryId={state.player?.countryId ?? null}
                leagueId={leagueId}
                size={20}
              />
              {count > 1 ? <span className="num text-[12px] text-white/70">×{count}</span> : null}
            </span>
          ))}
          {/*
            The medal is for Team of the Season and nothing else.
            The Ballon d'Or, the Golden Boot and the Golden Glove have their own
            artwork and the summary screen already uses it; the shelf drew the
            same medal for all four, so a cabinet holding two different honours
            showed the same picture twice and neither of them was right.
          */}
          {[...awards].map(([award, count]) => (
            <span key={award} className="flex items-center gap-1" title={t(`awards.${award}`)}>
              {AWARD_ART[award] ? (
                <img src={asset(`trophies/${AWARD_ART[award]}`)} alt="" width={20} height={20} className="shrink-0" />
              ) : (
                <AwardMedal size={20} title={t(`awards.${award}`)} />
              )}
              {count > 1 ? <span className="num text-[12px] text-white/70">×{count}</span> : null}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
