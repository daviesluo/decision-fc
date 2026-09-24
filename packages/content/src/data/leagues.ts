import type { League } from '@bg/engine';

/**
 * League table.
 *
 * Scope is deliberately narrow: the big five with their second divisions, three
 * more first divisions in Europe, and four "spin-off" leagues that exist as
 * money or twilight moves. Everything outside that was cut. A transfer window
 * that offered Tottenham next to a Chinese second-division side was not giving
 * the player a choice, it was giving them a puzzle about which option was real.
 *
 * `market` is what keeps that from happening again — see `marketBand()` in the
 * engine. Core leagues trade with each other freely; spin-off leagues only
 * appear when the move makes sense as one, which is late-career or when Europe
 * has stopped calling.
 *
 * `strength` remains the most consequential number in the pack: it scales market
 * value, transfer fees, call-up thresholds, award odds, press coverage and
 * legacy points.
 *
 * `wageIndex` is the second number, and it is deliberately *not* `strength`.
 * What a league is worth on the pitch and what it pays are different things,
 * and England is the proof: the Premier League's broadcast deal puts an
 * ordinary mid-table side on wages that only a giant elsewhere can match, and
 * the Championship outpays several European top flights. Ligue 1 runs the other
 * way — strong football, modest money outside Paris. Tying wages to `strength`
 * alone made a La Liga move and a Premier League move financially
 * interchangeable, which no player has ever found to be true.
 *
 * It multiplies the wage and nothing else. Fees, market value, awards and
 * legacy stay on `strength`.
 *
 * The four continental first divisions were set far too low against England at
 * first — Real Madrid and Atlético were quoting a fraction of what a mid-table
 * Premier League club paid, which is not what a player at that level is
 * offered. England still leads, because the broadcast money is real and it is
 * why an ordinary English side outbids a good Spanish one, but the gap at the
 * top is now a step and not a chasm.
 */
export const LEAGUES: readonly League[] = [
  // ---- The big five, first tier ------------------------------------------
  { id: 'eng.1', countryId: 'eng', tier: 1, strength: 1.0, wageIndex: 1.55, continental: 'elite', market: 'core' },
  { id: 'esp.1', countryId: 'esp', tier: 1, strength: 0.97, wageIndex: 1.38, continental: 'elite', market: 'core' },
  { id: 'ita.1', countryId: 'ita', tier: 1, strength: 0.94, wageIndex: 1.28, continental: 'elite', market: 'core' },
  { id: 'ger.1', countryId: 'ger', tier: 1, strength: 0.94, wageIndex: 1.25, continental: 'elite', market: 'core' },
  // The ruling: within the big five England leads and the other four read
  // as one another's equals. Ligue 1 sat at 0.86 — far enough below the other
  // three to fall into a band of its own, which is why it was catching 23% of
  // big-five offers against Spain's 17%. At 0.91 the four cluster (England 28%,
  // the rest 17–19%) and it is still the lowest of them.
  { id: 'fra.1', countryId: 'fra', tier: 1, strength: 0.91, wageIndex: 0.95, continental: 'elite', market: 'core' },

  // ---- Strong European first divisions ------------------------------------
  { id: 'por.1', countryId: 'por', tier: 1, strength: 0.72, wageIndex: 0.55, continental: 'elite', market: 'core' },
  { id: 'ned.1', countryId: 'ned', tier: 1, strength: 0.70, wageIndex: 0.6, continental: 'elite', market: 'core' },
  { id: 'bel.1', countryId: 'bel', tier: 1, strength: 0.62, wageIndex: 0.5, continental: 'secondary', market: 'core' },

  // ---- The big five, second tier ------------------------------------------
  // These carry the youth game: the loan market and most academy intakes. Note
  // the Championship: fourth-tier football by strength, top-flight money by
  // wage index, which is exactly the trap it is in real life.
  { id: 'eng.2', countryId: 'eng', tier: 2, strength: 0.48, wageIndex: 1.15, continental: null, market: 'core' },
  { id: 'ita.2', countryId: 'ita', tier: 2, strength: 0.42, wageIndex: 0.5, continental: null, market: 'core' },
  { id: 'ger.2', countryId: 'ger', tier: 2, strength: 0.42, wageIndex: 0.6, continental: null, market: 'core' },
  { id: 'esp.2', countryId: 'esp', tier: 2, strength: 0.41, wageIndex: 0.5, continental: null, market: 'core' },
  // The same ruling one division down: the Championship leads and the other
  // four second tiers are each other's equals. Ligue 2 was 0.37, far enough
  // below the rest to sit in a band of its own.
  { id: 'fra.2', countryId: 'fra', tier: 2, strength: 0.41, wageIndex: 0.4, continental: null, market: 'core' },

  // ---- Spin-off leagues ---------------------------------------------------
  // Money, distance, or the last act. Never offered as an ordinary next step.
  // The Gulf's wage index is the highest in the pack and its strength is not:
  // that gap *is* the Saudi trap, stated in two numbers.
  { id: 'ksa.1', countryId: 'ksa', tier: 1, strength: 0.52, wageIndex: 1.9, continental: 'elite', market: 'spinoff' },
  { id: 'jpn.1', countryId: 'jpn', tier: 1, strength: 0.54, wageIndex: 0.55, continental: 'elite', market: 'spinoff' },
  { id: 'usa.1', countryId: 'usa', tier: 1, strength: 0.50, wageIndex: 0.85, continental: 'secondary', market: 'spinoff' },
  { id: 'chn.1', countryId: 'chn', tier: 1, strength: 0.42, wageIndex: 1.2, continental: 'elite', market: 'spinoff' },
];
