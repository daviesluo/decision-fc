import { useEffect } from 'react';
import type { AwardId, TrophyId } from '@bg/engine';
import { useI18n } from '../lib/i18n';
import { useSettings } from '../lib/settings';
import { INDEX, trophyName } from '../lib/game';
import { AWARD_ART, AwardMedal, Trophy } from './Trophy';
import { asset } from '../lib/assets';

const PARTICLE_COLORS = ['#facc15', '#fb923c', '#f8fafc', '#38bdf8'];

/**
 * The silverware moment: a burst of particles behind the trophy — 18 of them,
 * at 20° steps — up for under two seconds, dismissable with a tap. That beat is
 * half of why winning feels like winning.
 */
export function CelebrationOverlay({
  trophies,
  awards = [],
  clubId,
  countryId,
  onDone,
}: {
  trophies: TrophyId[];
  /** Individual awards share the moment: a Ballon d'Or is not a footnote. */
  awards?: AwardId[];
  /** Where it was won — the cup that was lifted has a real name. */
  clubId: string | null;
  countryId: string | null;
  onDone: () => void;
}) {
  const { t } = useI18n();
  /**
   * Reduced motion cuts the *movement*, not the moment.
   *
   * It used to skip this overlay entirely, so a player with the setting on won
   * the Champions League or the Ballon d'Or and got a new row in a table and
   * nothing else — which is precisely the thing the award celebration was built
   * to stop. The particles go, the pop goes, and the screen stays: no timer
   * either, because a still card that vanishes on its own is easy to miss.
   */
  const { reducedMotion } = useSettings();

  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setTimeout(onDone, 1800);
    return () => window.clearTimeout(id);
  }, [onDone, reducedMotion]);

  return (
    <button
      onClick={onDone}
      aria-label="dismiss"
      /* Named so a harness can tell that the screen is mid-celebration.
         It blurs everything behind it, which is right for the moment and
         useless in a still — the store screenshots caught one and shipped
         a blurred career table behind a golden boot. */
      data-celebration
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/25 backdrop-blur-[1px]"
    >
      <div className="relative flex items-center justify-center">
        <div className="absolute h-28 w-28 rounded-full bg-gold/20 blur-xl" />
        {(reducedMotion ? [] : Array.from({ length: 18 }, (_, i) => i)).map((i) => (
          <span
            key={i}
            className="burst-particle absolute h-1.5 w-1.5 rounded-full"
            style={
              {
                background: PARTICLE_COLORS[i % 4],
                '--burst-angle': `${i * 20}deg`,
                '--burst-distance': `${112 + (i % 3) * 24}px`,
                animationDelay: `${(i % 4) * 24}ms`,
              } as React.CSSProperties
            }
          />
        ))}
        {/* The cup actually lifted, not a generic one — the first trophy of
            the batch is the one the burst is celebrating. */}
        <span className={`${reducedMotion ? '' : 'animate-pop'} drop-shadow-[0_4px_16px_rgba(250,204,21,0.5)]`}>
          {trophies[0] ? (
            <Trophy trophy={trophies[0]} clubId={clubId} countryId={countryId} size={72} />
          ) : awards[0] && AWARD_ART[awards[0]] ? (
            <img src={asset(`trophies/${AWARD_ART[awards[0]]}`)} alt="" className="h-[72px] w-[72px] object-contain" />
          ) : (
            <AwardMedal size={72} />
          )}
        </span>
      </div>
      <div className={`${reducedMotion ? '' : 'animate-rise'} mt-4 flex flex-col items-center gap-1`}>
        {[...new Set(awards)].map((award) => (
          <span
            key={award}
            className="display flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-[13px] font-bold uppercase tracking-wide text-gold"
          >
            {AWARD_ART[award] ? (
              <img src={asset(`trophies/${AWARD_ART[award]}`)} alt="" className="h-[14px] w-[14px] object-contain" />
            ) : (
              <AwardMedal size={14} />
            )}
            {t(`awards.${award}`)}
          </span>
        ))}
        {[...new Set(trophies)].map((trophy) => (
          <span
            key={trophy}
            className="display flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-[13px] font-bold uppercase tracking-wide text-gold"
          >
            <Trophy trophy={trophy} clubId={clubId} countryId={countryId} size={14} />
            {trophyName(trophy, t, { clubId, countryId })}
          </span>
        ))}
      </div>
    </button>
  );
}

const DROP_COLORS = ['#f87171', '#ef4444', '#fca5a5', '#7f1d1d'];

/**
 * The other half of the reveal: going down.
 *
 * The trophy burst was built and its opposite was not, so a season that ended
 * in relegation landed as a small pill in a table row while a cup got a
 * full-screen moment. Loss aversion is not decoration here — it is half of why
 * the payoff loop works at all, and it is the only feedback that a season went
 * badly in a way the player had a hand in.
 *
 * Deliberately the inverse of the celebration rather than a muted copy: the
 * particles fall instead of bursting out, the colour is red, and there is **no
 * backdrop blur**, so it reads as the world coming into focus rather than the
 * game pausing to admire something.
 */
export function RelegationOverlay({
  clubId,
  onDone,
}: {
  clubId: string | null;
  onDone: () => void;
}) {
  const { t, clubShort } = useI18n();
  const { reducedMotion } = useSettings();
  const club = clubId ? clubOrNull(clubId) : null;

  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setTimeout(onDone, 1800);
    return () => window.clearTimeout(id);
  }, [onDone, reducedMotion]);

  return (
    <button
      onClick={onDone}
      aria-label="dismiss"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/30"
    >
      <div className="relative flex items-center justify-center">
        <div className="absolute h-28 w-28 rounded-full bg-loss/20 blur-xl" />
        {(reducedMotion ? [] : Array.from({ length: 18 }, (_, i) => i)).map((i) => (
          <span
            key={i}
            className="burst-particle absolute h-1.5 w-1.5 rounded-full"
            style={
              {
                background: DROP_COLORS[i % 4],
                // Bottom half only, and short: these fall, they do not fly.
                '--burst-angle': `${180 + i * 10}deg`,
                '--burst-distance': `${64 + (i % 3) * 18}px`,
                animationDelay: `${(i % 4) * 24}ms`,
              } as React.CSSProperties
            }
          />
        ))}
        <span className={reducedMotion ? undefined : 'animate-pop'}>
          <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden>
            <circle cx="36" cy="36" r="32" fill="#dc2626" />
            <path
              d="M36 18 L36 46 M24 36 L36 50 L48 36"
              fill="none"
              stroke="#fff"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
      <div className={`${reducedMotion ? '' : 'animate-rise'} mt-4 flex flex-col items-center gap-1`}>
        <span className="display rounded-full bg-loss/15 px-3 py-1 text-[13px] font-bold uppercase tracking-wide text-loss">
          {t('career.relegated')}
        </span>
        {club ? (
          <span className="text-[11.5px] text-white/45">{clubShort(club)}</span>
        ) : null}
      </div>
    </button>
  );
}

function clubOrNull(id: string) {
  try {
    return INDEX.club(id);
  } catch {
    return null;
  }
}
