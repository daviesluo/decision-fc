import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CARD_SLOTS,
  decide as engineDecide,
  type AwardId,
  type CareerState,
  type Club,
  type TrophyId,
} from '@bg/engine';
import { WORLD } from '@bg/content';
import { useI18n } from '../lib/i18n';
import { useSettings } from '../lib/settings';
import { localizeParams } from '../lib/game';
import { DecisionPanel, type RevealState } from '../components/DecisionPanel';
import { PlayerHeader } from '../components/PlayerHeader';
import { CareerList } from '../components/CareerList';
import { HonoursShelf } from '../components/HonoursShelf';
import { CelebrationOverlay, RelegationOverlay } from '../components/CelebrationOverlay';
import { Screen } from '../components/ui';

/**
 * The main loop, laid out as three fixed bands that always fit one screen:
 *
 *   top     who you are right now
 *   middle  what happened + the whole career so far, by age
 *   bottom  the decision, under the thumb
 *
 * No choice resolves instantly on screen. A gamble runs a short roulette
 * across its two outcomes and locks the real one in; everything else simply
 * lights the chosen row for a beat. Either way the engine already knows the
 * answer — the UI is the one holding its breath.
 */
/** How long the screen sits on a choice before the result lands, in ms. */
const SETTLE_MS = 800;
/**
 * The beat a decision gets when a whole season is played behind it.
 *
 * Answering a card and having a season's appearances, goals, trophies and
 * injuries appear in the same instant reads as a spreadsheet updating, not as
 * a year of football happening. The engine has the answer immediately — the
 * wait is for the player, and it is the only thing that makes the numbers feel
 * earned rather than fetched.
 *
 * Only for the decisions that actually advance a season. A card that is just a
 * card keeps the short beat: nothing was simulated, so pausing would be
 * pretending.
 */
const SEASON_MS = 1400;
const ROULETTE_MS = 1000;
const LOCK_MS = 2300;
export function CareerScreen({
  state,
  club,
  onDecide,
  onQuit,
}: {
  state: CareerState;
  club: Club | null;
  onDecide: (optionId: string) => void;
  onQuit: () => void;
}) {
  const { t, clubName } = useI18n();
  const { reducedMotion } = useSettings();
  const [reveal, setReveal] = useState<RevealState | null>(null);
  const timers = useRef<number[]>([]);
  const result = state.lastResult;

  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id);
    },
    [],
  );

  const handleChoose = useCallback(
    (optionId: string) => {
      if (reveal) return;
      const pending = state.pending;
      const option = pending?.options.find((o) => o.id === optionId);
      if (!pending || !option) return;

      if (reducedMotion) {
        onDecide(optionId);
        return;
      }

      const commit = () => {
        setReveal(null);
        onDecide(optionId);
      };

      // The engine is pure: previewing the outcome now and committing the same
      // decision later produces the identical state. Done for every decision
      // rather than only for gambles, because the length of the beat depends on
      // whether a season was played, and only the next state knows that.
      const next = engineDecide(state, optionId, WORLD);
      const playedASeason = next.seasons.length > state.seasons.length;

      // Only a genuine gamble — two visible probabilities — earns the roulette.
      const isGamble = option.outcomes.filter((o) => o.probability !== undefined).length >= 2;
      if (!isGamble) {
        setReveal({ optionId, tone: 'neutral', phase: 'settle' });
        timers.current.push(window.setTimeout(commit, playedASeason ? SEASON_MS : SETTLE_MS));
        return;
      }

      const tone = next.lastResult?.tone ?? 'neutral';
      setReveal({ optionId, tone, phase: 'roulette' });
      timers.current.push(window.setTimeout(() => setReveal((r) => (r ? { ...r, phase: 'lock' } : r)), ROULETTE_MS));
      timers.current.push(window.setTimeout(commit, LOCK_MS));
    },
    [reveal, state, reducedMotion, onDecide],
  );

  // Celebrate silverware the moment its season lands. The club it was won at
  // travels with it, because that is what gives the cup its real name.
  const [celebrate, setCelebrate] = useState<{
    trophies: TrophyId[];
    awards: AwardId[];
    clubId: string | null;
  } | null>(null);
  /**
   * Going down gets its own moment, and it queues *behind* any silverware from
   * the same batch — a season that won a cup and was relegated (rare, but Wigan
   * did it) should show both, in that order, rather than one silently winning.
   */
  const [relegation, setRelegation] = useState<{ clubId: string | null } | null>(null);
  const seasonCount = state.seasons.length;
  const prevCount = useRef(seasonCount);
  useEffect(() => {
    if (seasonCount > prevCount.current) {
      const fresh = state.seasons.slice(prevCount.current);
      const won = fresh.flatMap((s) => s.trophies);
      // An individual award is as big a night as a trophy — the Ballon d'Or
      // used to land as a small star in a table row and nothing else.
      const awards = fresh.flatMap((s) => s.awards);
      // Shown whatever the motion setting says. Reduced motion changes how the
      // overlay behaves — no particles, no timer, tap to dismiss — inside the
      // component; it is not a reason to delete the moment a career turned on.
      if (won.length > 0 || awards.length > 0) {
        setCelebrate({
          trophies: won,
          awards,
          clubId: fresh.find((s) => s.trophies.length > 0 || s.awards.length > 0)?.clubId ?? null,
        });
      }
      const dropped = fresh.find((s) => s.relegated);
      if (dropped) setRelegation({ clubId: dropped.clubId });
    }
    prevCount.current = seasonCount;
  }, [seasonCount, state.seasons]);

  /**
   * Play the career from the number keys.
   *
   * The one interaction a desktop player expects that a phone player has no use
   * for, and the difference between clicking through twenty-five cards and
   * playing a career. The badge on each row (`DecisionPanel`) is what advertises
   * it, and it counts the same slots in the same order — the two have to be read
   * together.
   *
   * Deliberately narrow about when it listens. A key must not resolve a decision
   * that is already resolving, must not fire behind a celebration or a sheet
   * covering the options, and must not steal a digit from somebody typing a
   * surname on the identity screen — hence the input check, even though that
   * screen is not this one.
   */
  useEffect(() => {
    const pending = state.pending;
    if (!pending || reveal) return;
    const options = pending.options.slice(0, CARD_SLOTS);
    const overlay = celebrate !== null || relegation !== null;

    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
      // A sheet renders over the decision, so its options are not on screen to
      // be chosen. Read from the DOM rather than threading state through three
      // components: any sheet, opened from anywhere, closes the keyboard.
      if (document.querySelector('[data-sheet]')) return;

      /**
       * A celebration is a tap-to-dismiss card sitting over the decision, so
       * from the keyboard any key dismisses it and the *next* key chooses —
       * which is what pressing a key at a screen that is waiting for you means.
       *
       * Not merely for symmetry with the tap. With reduced motion the overlay
       * carries no timer on purpose (a still card that vanishes on its own is
       * easy to miss), so before this there was no way at all to get past a
       * trophy from the keyboard. Relegation is dismissed first because it
       * queues behind silverware and is therefore the one on top.
       */
      if (overlay) {
        event.preventDefault();
        if (celebrate) setCelebrate(null);
        else setRelegation(null);
        return;
      }

      const slot = Number(event.key);
      if (!Number.isInteger(slot) || slot < 1 || slot > options.length) return;
      event.preventDefault();
      handleChoose(options[slot - 1]!.id);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.pending, reveal, celebrate, relegation, handleChoose]);

  return (
    <>
      <Screen
        top={<PlayerHeader state={state} club={club} onQuit={onQuit} />}
        middle={
          /* Pinned to the top of the middle: the result line and the season
             detail hold a fixed place at the top rather than floating up and
             down as the decision and the table below them change height, which
             is what a player asked for. The career table takes the space that
             is left and scrolls inside itself, so nothing is clipped. */
          <div className="flex h-full flex-col justify-start gap-1.5 overflow-hidden">
            {/* The shelf only exists where there is room for it: on a wide
                window the career table has moved to its own column, and the
                space it left is what the player has actually won. */}
            <div className="mb-auto hidden shrink-0 pt-1 wide:block">
              <HonoursShelf state={state} />
            </div>
            {result ? (
              <div
                /* Named so a playtest can read what the game just said. The
                   result line is the game's prose, and prose is the one thing
                   a property check cannot judge — it has to be captured and
                   read. See `tools/playtest.mjs`. */
                data-result
                className={`animate-rise shrink-0 rounded-lg border-l-2 py-1 pl-2.5 text-[12px] leading-snug ${
                  result.tone === 'positive'
                    ? 'border-l-gain bg-gain/[0.07] text-gain'
                    : result.tone === 'negative'
                      ? 'border-l-loss bg-loss/[0.07] text-loss'
                      : 'border-l-white/25 bg-white/[0.04] text-white/70'
                }`}
              >
                {t(result.key, {
                  ...(club ? { club: clubName(club) } : {}),
                  ...localizeParams(result.params, clubName, t, {
                    clubId: club?.id ?? null,
                    countryId: state.player?.countryId ?? null,
                  }),
                })}
              </div>
            ) : null}

            {/* The per-season detail block used to sit here, above the table.
                It repeated what the table's newest row already says, and a
                player asked for the screen to carry less — so it is gone, and
                the career table has the middle to itself. */}

            {/* On a wide window this same table stands in the right-hand
                column instead — see the `side` slot below. One instance, moved
                by CSS, so the two can never disagree. */}
            <div className="min-h-0 flex-1 overflow-hidden wide:hidden">
              <CareerList state={state} />
            </div>
          </div>
        }
        side={
          <>
            <div className="mb-2 shrink-0 text-[11px] tracking-[0.14em] text-white/40 uppercase">
              {t('career.record')}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <CareerList state={state} />
            </div>
          </>
        }
        bottom={
          state.pending ? (
            <DecisionPanel
              state={state}
              decision={state.pending}
              currentClub={club}
              countryId={state.player?.countryId ?? null}
              onChoose={handleChoose}
              reveal={reveal}
            />
          ) : null
        }
      />

      {!celebrate && relegation ? (
        <RelegationOverlay clubId={relegation.clubId} onDone={() => setRelegation(null)} />
      ) : null}

      {celebrate ? (
        <CelebrationOverlay
          trophies={celebrate.trophies}
          awards={celebrate.awards}
          clubId={celebrate.clubId}
          countryId={state.player?.countryId ?? null}
          onDone={() => setCelebrate(null)}
        />
      ) : null}
    </>
  );
}
