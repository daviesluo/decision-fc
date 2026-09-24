/**
 * Attribute weighting and overall rating.
 *
 * OVR is always derived, never stored as the source of truth. That is what
 * makes a position change meaningful: moving a winger to full-back re-weights
 * the same six numbers and the rating moves on its own, instead of the engine
 * applying an arbitrary penalty.
 */

import type { Archetype } from '../types.js';
import { ATTRIBUTE_KEYS, type AttributeKey, type Attributes, type Position, type PositionGroup } from '../types.js';
import { clamp } from '../rng.js';

/** Per-position attribute weights. Each row sums to 1. */
export const POSITION_WEIGHTS: Record<Position, Attributes> = {
  //        pace  shoot  pass  drib  def   phys
  GK:  { pace: 0.24, shooting: 0.20, passing: 0.12, dribbling: 0.14, defending: 0.20, physical: 0.10 },
  CB:  { pace: 0.16, shooting: 0.04, passing: 0.14, dribbling: 0.06, defending: 0.34, physical: 0.26 },
  LB:  { pace: 0.26, shooting: 0.06, passing: 0.18, dribbling: 0.14, defending: 0.24, physical: 0.12 },
  RB:  { pace: 0.26, shooting: 0.06, passing: 0.18, dribbling: 0.14, defending: 0.24, physical: 0.12 },
  CDM: { pace: 0.12, shooting: 0.08, passing: 0.24, dribbling: 0.10, defending: 0.28, physical: 0.18 },
  CM:  { pace: 0.12, shooting: 0.14, passing: 0.30, dribbling: 0.18, defending: 0.16, physical: 0.10 },
  CAM: { pace: 0.14, shooting: 0.22, passing: 0.28, dribbling: 0.24, defending: 0.04, physical: 0.08 },
  LM:  { pace: 0.24, shooting: 0.14, passing: 0.22, dribbling: 0.24, defending: 0.08, physical: 0.08 },
  RM:  { pace: 0.24, shooting: 0.14, passing: 0.22, dribbling: 0.24, defending: 0.08, physical: 0.08 },
  LW:  { pace: 0.26, shooting: 0.22, passing: 0.14, dribbling: 0.28, defending: 0.02, physical: 0.08 },
  RW:  { pace: 0.26, shooting: 0.22, passing: 0.14, dribbling: 0.28, defending: 0.02, physical: 0.08 },
  ST:  { pace: 0.22, shooting: 0.32, passing: 0.10, dribbling: 0.18, defending: 0.02, physical: 0.16 },
};

const GROUPS: Record<Position, PositionGroup> = {
  GK: 'GK',
  CB: 'DEF', LB: 'DEF', RB: 'DEF',
  CDM: 'MID', CM: 'MID', CAM: 'MID', LM: 'MID', RM: 'MID',
  LW: 'ATT', RW: 'ATT', ST: 'ATT',
};

export function positionGroup(position: Position): PositionGroup {
  return GROUPS[position];
}

export function isGoalkeeper(position: Position): boolean {
  return position === 'GK';
}

/** Weighted sum of the six attributes, rounded and clamped to the 40–99 band. */
export function computeOverall(attributes: Attributes, position: Position): number {
  const weights = POSITION_WEIGHTS[position];
  let total = 0;
  for (const key of ATTRIBUTE_KEYS) total += attributes[key] * weights[key];
  return clamp(Math.round(total), 40, 99);
}

/**
 * How well a player would rate in another position — used to show the true cost
 * of a positional switch before the player commits to one.
 */
export function overallAt(attributes: Attributes, position: Position): number {
  return computeOverall(attributes, position);
}

export function emptyAttributes(value = 0): Attributes {
  return {
    pace: value,
    shooting: value,
    passing: value,
    dribbling: value,
    defending: value,
    physical: value,
  };
}

export function mapAttributes(
  attributes: Attributes,
  fn: (value: number, key: AttributeKey) => number,
): Attributes {
  const out = emptyAttributes();
  for (const key of ATTRIBUTE_KEYS) out[key] = clamp(Math.round(fn(attributes[key], key)), 1, 99);
  return out;
}

/**
 * Attributes a starting 16-year-old gets, shaped by position so that a striker
 * begins with finishing and a centre-back with strength. The spread is wide
 * enough that two players on the same seed still feel different.
 */
export function startingAttributes(position: Position, roll: (min: number, max: number) => number): Attributes {
  const weights = POSITION_WEIGHTS[position];
  const attributes = emptyAttributes();
  for (const key of ATTRIBUTE_KEYS) {
    // Relevant attributes start higher; irrelevant ones stay low but not useless.
    const relevance = weights[key];
    const base = START_BASE + relevance * 90;
    attributes[key] = clamp(Math.round(base + roll(-7, 7)), 8, START_CAP);
  }
  return attributes;
}

/**
 * Calibrated so a sixteen-year-old's rating comes out at a median of 50 — the
 * start the growth table is tuned from.
 *
 * This constant is worth more than it looks. Development is a table of age
 * bands (`model/growth.ts`): what a player gains has nothing to do with what he
 * already is, so a career's peak is very nearly *start + the sum of his
 * cycles*. Careers used to start at a median of 44, and every career was
 * therefore six points short for its entire length — a median peak of 75
 * against the ~80 the table is tuned for, and the big clubs, whose squad
 * standard runs to 88, permanently out of reach.
 *
 * Six points is not a difficulty setting, it is the difference between a game
 * about how far you can climb and one about how gracefully you settle.
 *
 * The spread is kept: p10 48, p90 53, so two players on one seed still feel
 * different. Change these only against a re-measured `pnpm balance`.
 */
const START_BASE = 32;
const START_CAP = 70;

/**
 * The three player types, as a redistribution of what a player already has.
 *
 * Each type moves points between attributes; **none of them is stronger than
 * the others at sixteen.** The rating a type starts on is held constant by
 * construction (see `applyArchetype`), so the choice is genuinely about the
 * shape of a career rather than a head start:
 *
 *  - `pace` is quick and direct. It suits counter-attacking and wing play, and
 *    it ages worst, because pace is the first thing a body loses.
 *  - `technical` keeps the ball. It suits possession and free roles, and it
 *    ages best, because passing barely decays at all.
 *  - `physical` wins duels and stays fit. It suits pressing and a low block,
 *    and it is the least spectacular of the three in front of goal.
 */
const ARCHETYPE_SHIFT: Record<Archetype, Partial<Record<AttributeKey, number>>> = {
  pace: { pace: 16, dribbling: 7, shooting: 2, passing: -8, physical: -9, defending: -8 },
  technical: { passing: 15, dribbling: 9, shooting: 3, pace: -13, physical: -10, defending: -4 },
  physical: { physical: 16, defending: 9, shooting: 1, pace: -8, dribbling: -10, passing: -8 },
};

/**
 * How far a single player's own shape wanders from his type.
 *
 * The shifts above are what the *type* means; this is what makes two of them
 * different people. A real card is lopsided — a winger reads 94 pace and 62
 * physical, not 71 and 66 — and the shifts were small enough that all three
 * types produced roughly the same flat hexagon. Widened, and then given a
 * per-player wobble on every attribute the type touches, so "quick" is a shape
 * rather than a preset.
 *
 * Applied *before* the rating is corrected back, so a lopsided player is still
 * worth exactly what an even one is at sixteen. The type is a shape, never a
 * head start.
 */
const ARCHETYPE_JITTER = 5;

/**
 * Apply a player type without changing what he is rated.
 *
 * The shift is applied, then the whole set is nudged back until the
 * position-weighted rating matches what it was — otherwise "quick" would
 * simply be the best choice for a winger and "technical" for a playmaker,
 * and the decision would be a trap rather than a choice.
 */
export function applyArchetype(
  attributes: Attributes,
  archetype: Archetype,
  position: Position,
  /** Per-player wobble on the type's own shape; omit for the plain preset. */
  roll: (min: number, max: number) => number = () => 0,
): Attributes {
  const before = computeOverall(attributes, position);
  const shift = ARCHETYPE_SHIFT[archetype];

  const shifted = mapAttributes(attributes, (value, key) => {
    const move = shift[key];
    if (move === undefined) return clamp(value, 8, 70);
    return clamp(value + move + roll(-ARCHETYPE_JITTER, ARCHETYPE_JITTER), 8, 70);
  });
  const after = computeOverall(shifted, position);

  // Spread the bulk of the correction by position relevance, so it lands where
  // the rating actually reads it and does not undo the shape we just created.
  const weights = POSITION_WEIGHTS[position];
  let leverage = 0;
  for (const key of ATTRIBUTE_KEYS) leverage += weights[key] * weights[key];

  const scale = leverage > 0 ? (before - after) / leverage : 0;
  const corrected = mapAttributes(shifted, (value, key) => clamp(value + scale * weights[key], 8, 70));

  // Rounding leaves the rating a point or two off, and "a point or two" is
  // exactly the size of edge that would make one type the right answer. Walk
  // the remainder off one attribute-point at a time until it is truly zero.
  return settleTo(corrected, position, before);
}

/** Nudge single attribute points until the rating lands exactly on `target`. */
function settleTo(attributes: Attributes, position: Position, target: number): Attributes {
  const weights = POSITION_WEIGHTS[position];
  // Most relevant first: fewest points moved, so the shape is disturbed least.
  const order = [...ATTRIBUTE_KEYS].sort((a, b) => weights[b] - weights[a]);
  const out = { ...attributes };

  // Each step moves the rating by at most one attribute's weight, so the loop
  // needs a few passes; the bound is a guard, not the expected cost.
  for (let step = 0; step < ATTRIBUTE_KEYS.length * 12; step += 1) {
    const gap = target - computeOverall(out, position);
    if (gap === 0) return out;
    const direction = Math.sign(gap);
    const key = order[step % order.length]!;
    const next = out[key] + direction;
    if (next < 8 || next > 70) continue;
    out[key] = next;
  }
  return out;
}
