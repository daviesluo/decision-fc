/**
 * Deterministic pseudo-random number generation.
 *
 * The whole engine is replayable: given the same seed and the same sequence of
 * player decisions, every career unfolds identically. That property is what
 * makes shareable seeds, server-verified leaderboards and snapshot tests
 * possible, so nothing in the engine may ever call `Math.random()` or read the
 * clock.
 *
 * Randomness is addressed by *channel* rather than drawn from a single moving
 * stream. `rngFor(seed, 'season:12:goals')` always yields the same generator,
 * so inserting a new random draw somewhere in the codebase does not shift every
 * later result — a property plain sequential PRNGs do not have, and the reason
 * balance changes here stay reviewable.
 */

/** A seeded generator. Calling it returns the next float in [0, 1). */
export type Rng = () => number;

/** FNV-1a 32-bit. Maps an arbitrary channel string to a stable seed. */
function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, and good enough for game randomness. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build the generator for one addressable channel of a career. */
export function rngFor(seed: string, channel: string): Rng {
  return mulberry32(hashString(`${seed}::${channel}`));
}

/** Uniform integer in [min, max], inclusive. */
export function int(rng: Rng, min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

/** Uniform float in [min, max). */
export function float(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** True with the given probability (0–1). */
export function chance(rng: Rng, probability: number): boolean {
  return rng() < probability;
}

/** Uniformly pick one element. Returns undefined only for an empty list. */
export function pick<T>(rng: Rng, items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(rng() * items.length)];
}

/** Weighted pick. Entries with weight <= 0 can never be selected. */
export function weightedPick<T>(
  rng: Rng,
  items: readonly T[],
  weightOf: (item: T) => number,
): T | undefined {
  let total = 0;
  for (const item of items) total += Math.max(0, weightOf(item));
  if (total <= 0) return undefined;

  let roll = rng() * total;
  for (const item of items) {
    roll -= Math.max(0, weightOf(item));
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}

/** Fisher–Yates, returning a new array. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/**
 * Approximately normal via the mean of four uniforms (Bates distribution).
 * Cheaper than Box–Muller and naturally bounded, which keeps outliers sane.
 */
export function gaussian(rng: Rng, mean: number, stdDev: number): number {
  const sum = rng() + rng() + rng() + rng();
  return mean + ((sum - 2) / 0.5774) * stdDev;
}

/** Draw from a Poisson distribution (Knuth). Used for goals and assists. */
export function poisson(rng: Rng, lambda: number): number {
  if (lambda <= 0) return 0;
  // Above ~30 the Knuth loop gets slow and the normal approximation is exact enough.
  if (lambda > 30) return Math.max(0, Math.round(gaussian(rng, lambda, Math.sqrt(lambda))));
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng();
  } while (p > limit);
  return k - 1;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Linear interpolation of `value` from one range onto another, clamped. */
export function remap(
  value: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number,
): number {
  if (fromMax === fromMin) return toMin;
  const t = clamp((value - fromMin) / (fromMax - fromMin), 0, 1);
  return toMin + t * (toMax - toMin);
}

/** Generate a fresh career seed from an external entropy source. */
export function makeSeed(entropy: number): string {
  return Math.abs(Math.floor(entropy)).toString(36).padStart(8, '0').slice(-10);
}
