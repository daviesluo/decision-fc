/**
 * How a career stops, and what it is worth when it does.
 *
 * Two things, both small, both self-contained, and both reached from several
 * places in the state machine: the roll that decides whether an ageing player
 * carries on, and the transition to the summary screen. Keeping them here means
 * `machine.ts` never has to hold the retirement arithmetic in view while doing
 * something else.
 */
import { chance, clamp, rngFor } from '../rng.js';
import type { CareerState, World } from '../types.js';
import { computeLegacy, resolveEnding } from './summary.js';

/** Nobody plays past this, whatever the numbers say. */
export const HARD_RETIREMENT_AGE = 41;

/**
 * The earliest a career is allowed to end.
 *
 * Nobody hangs up their boots at thirty-two because one season went badly.
 * Before this age a player who has run out of options drops a division or
 * takes the money abroad — the career gets worse, it does not stop.
 */
export const MIN_RETIREMENT_AGE = 35;

export function maybeRetire(state: CareerState, world: World): CareerState {
  const player = state.player!;
  if (player.age >= HARD_RETIREMENT_AGE) return finishCareer(state, world, 'retirement.age');

  if (player.age >= MIN_RETIREMENT_AGE) {
    const rng = rngFor(state.seed, `retire:${player.age}`);
    // Losing your place is what ends careers; age alone only finishes the job.
    const lastRole = state.seasons[state.seasons.length - 1]?.role ?? 'squad';
    const benchFactor = lastRole === 'fringe' ? 0.4 : lastRole === 'impact_sub' ? 0.22 : 0;
    const declineFactor = clamp((68 - player.overall) / 45, 0, 0.32);
    const ageFactor = clamp((player.age - 36) * 0.14, 0, 0.6);
    if (chance(rng, clamp(benchFactor + declineFactor + ageFactor, 0, 0.95))) {
      return finishCareer(state, world, 'retirement.decline');
    }
  }
  return state;
}

export function finishCareer(state: CareerState, world: World, reasonKey: string): CareerState {
  const legacy = computeLegacy(state, world);
  const endingId = resolveEnding(state, legacy.score, world, reasonKey);
  return {
    ...state,
    phase: 'summary',
    pending: null,
    retirement: {
      age: state.player?.age ?? 0,
      reasonKey,
      legacyScore: legacy.score,
      endingId,
      breakdown: legacy.breakdown,
    },
  };
}
