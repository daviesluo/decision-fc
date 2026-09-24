/**
 * Player development.
 *
 * The single most important thing about it: **development is age and talent,
 * not minutes.** A player improves on a two-year cycle drawn from his talent
 * profile; where he plays and how much barely enters into it. Minutes only
 * ever appear as a *penalty*, and only late: from the fourth cycle (age 24)
 * a player stuck on the bench rolls his cycle twice and takes the worse one.
 *
 * This is deliberately unlike a "minutes drive growth" model. The old version
 * did that, and it produced a seventeen-year-old who went on loan to a strong
 * league, started, and gained twenty points of ability in two seasons — an
 * arc no real footballer has ever had.
 */

import {
  ATTRIBUTE_KEYS,
  type Archetype,
  type AttributeKey,
  type Attributes,
  type DevelopmentCycle,
  type Player,
  type SquadRole,
} from '../types.js';
import { clamp, int, remap, type Rng } from '../rng.js';
import { POSITION_WEIGHTS, computeOverall, mapAttributes } from './attributes.js';

export type DevelopmentProfile = 'early' | 'normal' | 'late';

/** OVR change over a whole two-year cycle, by the age the cycle ends at. */
type CycleTable = Record<number, [min: number, max: number]>;

/*
 * **When a career peaks, measured rather than assumed.**
 *
 * The first version of these tables peaked a median career at *twenty-four* —
 * the cycle ending at 24 was the last strongly positive one for the profile
 * eight players in ten had, and everything after it was flat or down. Real
 * outfielders peak between about twenty-six and thirty, and plenty of them
 * later than that; a game that has a striker declining at twenty-five is not
 * describing football.
 *
 * So the positive years are pushed out. Nothing gained in total: the early
 * cycles give up roughly what the later ones take on, because the point is
 * *when* a career arrives, not how good it gets — that is the balance the
 * acceptance table holds, and peak OVR is checked against it after every change
 * to these numbers.
 *
 * The three profiles are also pulled further apart. They existed before and did
 * not do much: the median peak age was the same 24 for `normal` and the two
 * outliers were ten per cent of careers each, so almost every player had the
 * same arc. An early bloomer now tops out around twenty-six and a late one
 * around thirty, and they are common enough to meet.
 */
const PROFILE_TABLES: Record<DevelopmentProfile, CycleTable> = {
  early: {
    18: [5, 12], 20: [4, 12], 22: [3, 10], 24: [2, 9], 26: [1, 6],
    28: [-1, 2], 30: [-2, 0], 32: [-4, 0], 34: [-6, -1], 36: [-8, -2], 38: [-10, -3],
  },
  normal: {
    18: [2, 7], 20: [2, 9], 22: [2, 9], 24: [2, 9], 26: [2, 8],
    28: [1, 6], 30: [0, 3], 32: [-2, 0], 34: [-5, -1], 36: [-7, -2], 38: [-10, -3],
  },
  late: {
    18: [0, 5], 20: [1, 7], 22: [1, 8], 24: [2, 9], 26: [2, 9],
    28: [2, 8], 30: [1, 5], 32: [-1, 1], 34: [-4, 0], 36: [-7, -2], 38: [-10, -3],
  },
};

/** Goalkeepers develop on their own curve: later, flatter, longer. */
const GK_TABLE: CycleTable = {
  18: [2, 10], 20: [2, 10], 22: [2, 9], 24: [2, 8], 26: [1, 7],
  28: [1, 5], 30: [0, 0], 32: [-1, 0], 34: [-2, 0], 36: [-4, -1], 38: [-6, -2],
};

/**
 * How the player type bends the curve — *when* a career peaks, never how much
 * it is worth.
 *
 * The rows deliberately do **not** sum to zero, and that is the whole lesson
 * of tuning them: a point of ability at eighteen is worth far more than a
 * point at thirty, because early ability compounds. It buys a better club,
 * which buys wages, minutes and trophies, for the fifteen years that follow.
 * The first draft made the rows symmetric — +4 early against −4 late — and the
 * quick player retired with 36% more legacy and 44% more money than the
 * technical one. Fairness here is measured, not assumed.
 *
 * Calibrated over 420 careers per type across all twelve positions, taking
 * the first option every time. Retire-time legacy lands within 0.7% and gross
 * earnings within 1.7% across the three, while peak-ability-by-22 stays 2.5
 * points apart — which is the difference the player is actually choosing.
 * Re-run `tools/balance.ts` after touching these numbers.
 */
const ARCHETYPE_TILT: Record<Archetype, Record<number, number>> = {
  /*
   * The quick player's third late penalty is gone, and the reason is
   * `minutesGrowthMultiplier`.
   *
   * These rows were calibrated when development owed nothing to playing time,
   * so a point lost at thirty-two cost a point. It does not any more: losing
   * ability late costs the starting role, the role costs the next cycle's
   * gains, and the two compound downwards. The quick player wears that worst
   * because he is the one whose curve turns first — he fell from level with the
   * other two to 17% behind the physical player the moment minutes started
   * mattering, which is precisely the trap this table exists to prevent.
   *
   * Taking one point back at thirty-two is the smallest correction that does
   * it. The shape of the choice is untouched: he is still the better
   * twenty-two-year-old and still the first to decline.
   */
  pace:      { 18: 1, 20: 1, 22: 0, 24: 0, 26: 0, 28: -1, 30: -1 },
  technical: { 18: -1, 20: 0, 22: 0, 24: 0, 26: 0, 28: 1, 30: 1, 32: 1 },
  physical:  {},
};

/** Tolerates a player from before types existed: no type means no tilt. */
function tiltFor(archetype: Archetype | undefined, targetAge: number): number {
  return (archetype ? ARCHETYPE_TILT[archetype] : undefined)?.[targetAge] ?? 0;
}

/**
 * A quarter early, a quarter late, half in between.
 *
 * It was ten and ten, which made the two interesting arcs rare enough that a
 * player would rarely meet either — eight careers in ten were the same curve,
 * and "when does a footballer peak" had one answer. A quarter each is often
 * enough that two careers in a row can differ in a way the player notices,
 * which is the whole reason the profiles exist.
 */
export function rollDevelopmentProfile(rng: Rng): DevelopmentProfile {
  const roll = rng();
  return roll < 0.25 ? 'early' : roll < 0.5 ? 'late' : 'normal';
}

export type { DevelopmentCycle };

/** How fast athleticism erodes relative to technique, once decline sets in. */
const DECLINE_SHARE: Record<AttributeKey, number> = {
  pace: 0.38,
  physical: 0.3,
  dribbling: 0.16,
  defending: 0.08,
  shooting: 0.05,
  passing: 0.03,
};

/**
 * What a club's coaching is worth to a young player.
 *
 * `club.training` sat in the content pack from the first commit and **nothing
 * read it** — it weighted loan destinations and otherwise decorated the data.
 * That made the opening academy card a coin flip dressed as a decision: three
 * clubs, and the only real difference was the badge.
 *
 * Deliberately small, and deliberately young-only. A good academy is worth
 * about a point of extra development a year over a poor one across the first
 * few seasons, and nothing at all after 21 — which is what an academy is: a
 * head start, not a career. Anything bigger would make the opening card the
 * whole game, and where you *play* matters more than who coached you.
 */
export const COACHING_MAX_AGE = 21;

export function coachingMultiplier(training: number, age: number): number {
  if (age > COACHING_MAX_AGE) return 1;
  return remap(training, 50, 96, 0.93, 1.07);
}

/**
 * How well he actually played, turned into how much he improves.
 *
 * Until this existed, development was age, talent and money, and the season a
 * player had was worth nothing to him beyond a row in the table. That is both
 * wrong about football and quietly wrong about this game: **tactical fit**
 * moves effective ability, effective ability moves the season rating, and the
 * rating reached nothing — so the one system the player is asked to weigh on
 * every offer card ended at the record and never touched the player.
 *
 * Deliberately the same size as coaching, ±7%: a good year at a club that
 * suits you is worth about as much as a good academy, and a bad one costs
 * about as much. It nudges a cycle; it does not rewrite the curve.
 *
 * Under ten appearances the rating is a handful of substitute cameos, and a
 * number drawn from four games is noise rather than a season — those get 1.
 */
export const FORM_GROWTH_MIN_APPEARANCES = 10;

export function formGrowthMultiplier(rating: number, appearances: number): number {
  if (appearances < FORM_GROWTH_MIN_APPEARANCES) return 1;
  /*
   * The top of the range is 8.2 rather than 8.0 and the ceiling 1.05 rather
   * than 1.07: the first version put peak OVR ≥90 at 7.05% against a 3–7%
   * band, because the players who rate highest are the ones already growing
   * fastest and the multiplier compounded with itself over twenty seasons.
   */
  return remap(rating, 6.2, 8.2, 0.93, 1.05);
}

export interface GrowthContext {
  role: SquadRole;
  /** Attribute the player is focusing training on, if any. */
  focus: AttributeKey | null;
  /** The cycle in progress, or null to start a fresh one. */
  cycle: DevelopmentCycle | null;
  /**
   * Paid coaching staff. Deliberately small — it nudges a cycle, it does not
   * rewrite the curve.
   */
  multiplier: number;
  /** Suspension wipes a season's development. */
  suspended: boolean;
}

export interface GrowthResult {
  attributes: Attributes;
  overall: number;
  /** Signed OVR change, for the season report. */
  delta: number;
  /** Cycle state to carry into the next season. */
  cycle: DevelopmentCycle;
}

/** Table lookup key: the even age the current cycle ends at. */
function targetAgeFor(age: number): number {
  return age % 2 === 0 ? age + 2 : age + 1;
}

/**
 * Is the curve still adding to him, or has it started taking points off?
 *
 * Read straight off the same table `rollCycle` draws from, so it moves with the
 * player rather than with a constant: an early bloomer is on the way down at
 * twenty-eight and a late one is still climbing at thirty. It exists for the
 * *copy* — "you develop faster this season" is a sentence about a boy, and it
 * appeared on a thirty-three-year-old taking his coaching badges. Past the
 * peak the same multiplier means something else and has to say so: what it buys
 * then is a slower decline.
 */
export function stillImproving(player: Player): boolean {
  const table = player.position === 'GK' ? GK_TABLE : PROFILE_TABLES[player.hidden.developmentProfile];
  const band = table[targetAgeFor(player.age)];
  return band !== undefined && band[1] > 0;
}

/**
 * How much of a development cycle's *gain* playing time actually delivers.
 *
 * **A player who is not playing does not improve, and until now that was only
 * true after his twenty-fourth birthday.** Below that, a sixteen-year-old who
 * signed for a giant and watched from the bench developed at exactly the rate
 * of one who played thirty-four games somewhere smaller. That is wrong about
 * football, and inside this game it was load-bearing in a way nobody had
 * measured: it is the single reason `ambitious` — chase the biggest badge on
 * every card, ignore the role that comes with it — was the best way to play.
 * Signing above your ceiling cost minutes, minutes cost nothing, and the badge
 * paid. It also made the loan ladder decorative: the whole point of a loan is
 * to get a boy minutes, and minutes bought him nothing he could not have had
 * on a bench.
 *
 * Graded rather than binary, because football is: a squad player gets some of
 * it, a man who is never picked gets very little.
 *
 * **Gains only.** Decline is left exactly as the curve drew it — this file has
 * already been bitten once by a multiplier that deepened a loss (85 to 68 in a
 * season), and the rule that came out of it is that nothing but the curve makes
 * a player worse.
 *
 * **Deterministic, and applied after the draw.** The old penalty took a second
 * random draw and kept the worse one, which means it consumed RNG; this does
 * not, so no other channel's stream moves. That is the same discipline
 * `tiltFor` below follows and it is what keeps a career replayable from
 * `seed + decisions`, which the leaderboard's anti-cheat depends on.
 */
const MINUTES_GROWTH: Record<SquadRole, number> = {
  star: 1,
  important: 1,
  regular: 1,
  squad: 0.93,
  impact_sub: 0.87,
  fringe: 0.8,
};

/**
 * Where it goes, and why not in the cycle draw.
 *
 * The first version scaled the cycle's drawn delta directly. That was wrong
 * twice over: a cycle covers two seasons and is rolled from the role held on
 * the day it starts, so one bad season set a boy's growth for two years even
 * if he played every game of the second; and at the sizes it needed to matter
 * there it swamped everything else, to the point where *refusing every step up*
 * became the best way to play the game. Measured: `unambitious` 1,395 legacy
 * against `shrewd` 1,232, which is a worse game than the one it was fixing.
 *
 * Here it is a season's own multiplier, alongside coaching, lifestyle and form,
 * capped with them at 0.5, and applied only to gains. Larger than its
 * neighbours' ±7% on purpose — not being picked is a bigger fact about a season
 * than an average academy — but a nudge to a cycle rather than a rewrite of the
 * curve, which is the rule this whole chain is written to.
 */
export function minutesGrowthMultiplier(role: SquadRole): number {
  return MINUTES_GROWTH[role];
}

/** Draw a whole cycle's OVR change and split it across the two seasons. */
function rollCycle(rng: Rng, player: Player): DevelopmentCycle {
  const targetAge = targetAgeFor(player.age);
  const table = player.position === 'GK' ? GK_TABLE : PROFILE_TABLES[player.hidden.developmentProfile];
  const band = table[targetAge] ?? [-10, -3];

  let delta = int(rng, band[0], band[1]);
  // Deterministic, and applied after the draw: the type never consumes RNG,
  // so adding it cannot shift any other channel's stream.
  delta += tiltFor(player.archetype, targetAge);

  const size = Math.abs(delta);
  if (size === 0) {
    return { targetAge, annualDeltas: [0, 0], nextPart: player.age % 2 === 0 ? 0 : 1 };
  }

  // Big swings land unevenly across the two seasons; small ones land at once.
  const first =
    size >= 4
      ? int(rng, Math.ceil(size * 0.25), Math.floor(size * 0.75)) * Math.sign(delta)
      : delta;
  return {
    targetAge,
    annualDeltas: [first, delta - first],
    nextPart: player.age % 2 === 0 ? 0 : 1,
  };
}

/**
 * The most overall a season may take off a player through the ageing curve.
 *
 * A real decline is a few points a year, not a cliff: a player was seen going
 * from 85 to 68 in a single season because a bad-form multiplier was dividing
 * an already-steep curve loss (see `developPlayer`). Capping the curve's own
 * contribution here, and the injury that stacks on it in `playSeason`, keeps
 * the worst season a believable step down rather than a collapse.
 */
const MAX_SEASON_DECLINE = 5;

/**
 * Advance a player one season. Returns new attributes rather than mutating,
 * so the caller can diff before and after for the progression chart.
 */
export function developPlayer(rng: Rng, player: Player, context: GrowthContext): GrowthResult {
  const targetAge = targetAgeFor(player.age);
  const cycle =
    context.cycle && context.cycle.targetAge === targetAge
      ? context.cycle
      : rollCycle(rng, player);

  const raw = cycle.annualDeltas[cycle.nextPart] ?? 0;
  // Coaching speeds gains and softens decline; it never flips the sign — and a
  // bad multiplier must never *deepen* decline. The old `raw / multiplier` did
  // exactly that: a poor season's lifestyle/form/event multipliers compound
  // down to the 0.5 floor, and dividing a −7 curve loss by 0.5 doubled it to
  // −14. So decline is only ever softened, by coaching above 1, and a sub-1
  // multiplier slows gains while leaving the loss the curve actually drew.
  const multiplier = clamp(context.multiplier, 0.5, 1.6);
  const scaled = context.suspended
    ? 0
    : raw > 0
      ? raw * multiplier
      : raw / Math.max(multiplier, 1);
  // No single season strips more than a few points off a real player, however
  // the curve, form and coaching line up. Only loss is capped; gains stay
  // uncapped so the early-development arcs the tables were tuned for are
  // untouched. A lasting injury lands on top of this in `playSeason`, and the
  // two together are bounded there.
  const delta = Math.max(Math.round(scaled), -MAX_SEASON_DECLINE);

  const attributes = delta === 0 ? { ...player.attributes } : applyOverallDelta(rng, player, delta, context.focus);
  const overall = computeOverall(attributes, player.position);

  return {
    attributes,
    overall,
    delta: overall - player.overall,
    cycle: { ...cycle, nextPart: cycle.nextPart === 0 ? 1 : 0 },
  };
}

/**
 * Move OVR by exactly `delta` by spreading it across attributes.
 *
 * OVR is a weighted average, so a point added to an attribute moves the
 * rating by that attribute's weight. Solving for the scale factor makes the
 * result land on the intended number instead of drifting — which matters,
 * because the whole curve above is expressed in OVR points.
 */
function applyOverallDelta(rng: Rng, player: Player, delta: number, focus: AttributeKey | null): Attributes {
  const weights = POSITION_WEIGHTS[player.position];
  const shares: Record<AttributeKey, number> = { ...weights };

  if (delta > 0) {
    if (focus) {
      shares[focus] = shares[focus] * 2.4 + 0.25;
      for (const key of ATTRIBUTE_KEYS) if (key !== focus) shares[key] *= 0.8;
    }
    // Physical gains dry up well before technical ones.
    if (player.age > 26) {
      shares.pace *= 0.35;
      shares.physical *= 0.6;
    }
  } else {
    for (const key of ATTRIBUTE_KEYS) shares[key] = DECLINE_SHARE[key];
  }

  // A little jitter so two identical setups do not produce identical players.
  for (const key of ATTRIBUTE_KEYS) shares[key] *= 0.75 + rng() * 0.5;

  let total = 0;
  for (const key of ATTRIBUTE_KEYS) total += shares[key];
  if (total <= 0) return { ...player.attributes };

  let leverage = 0;
  for (const key of ATTRIBUTE_KEYS) leverage += weights[key] * (shares[key] / total);
  if (leverage <= 0) return { ...player.attributes };

  const scale = delta / leverage;
  return mapAttributes(player.attributes, (value, key) =>
    clamp(value + scale * (shares[key] / total), 1, 99),
  );
}

/**
 * What the player is allowed to know about his own ceiling. There is no
 * hidden potential number in this model — the talent profile is the ceiling —
 * so the range is projected from the profile's remaining upside.
 */
export function potentialRange(player: Player): [number, number] {
  const table = player.position === 'GK' ? GK_TABLE : PROFILE_TABLES[player.hidden.developmentProfile];
  let low = 0;
  let high = 0;
  for (let age = targetAgeFor(player.age); age <= 38; age += 2) {
    const band = table[age];
    if (!band) break;
    const tilt = tiltFor(player.archetype, age);
    low += Math.max(0, band[0] + tilt);
    high += Math.max(0, band[1] + tilt);
  }
  // Scouts hedge: the younger the player, the wider the guess.
  const certainty = clamp((player.age - 15) / 9, 0, 1);
  const spread = Math.round(6 * (1 - certainty));
  const floor = clamp(player.overall + Math.round(low * 0.6) - spread, player.overall, 99);
  const ceiling = clamp(player.overall + Math.round(high * 0.7) + spread, floor, 99);
  return [floor, ceiling];
}

/**
 * A rough ceiling estimate, for the parts of the world model that ask "how
 * good might this player become?" — scouting interest, academy offers.
 */
export function projectedCeiling(player: Player): number {
  return potentialRange(player)[1];
}
