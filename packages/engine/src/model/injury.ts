/**
 * Injuries.
 *
 * Severity is expressed in weeks out rather than a flat rating penalty. Weeks
 * feed appearances, appearances feed development, and development feeds the
 * rating — so a torn ACL costs a season of growth, which is the real damage,
 * instead of an arbitrary "-5 OVR".
 */

import { chance, clamp, int, weightedPick, type Rng } from '../rng.js';
import type { Player } from '../types.js';

export interface InjuryType {
  id: string;
  weight: number;
  /** Inclusive range of weeks out. */
  weeks: [number, number];
  /** Permanent attribute damage applied on top of the missed time. */
  lasting: number;
}

export const INJURY_TYPES: readonly InjuryType[] = [
  { id: 'hamstring',            weight: 24, weeks: [3, 7],   lasting: 0 },
  { id: 'ankle_sprain',         weight: 18, weeks: [2, 5],   lasting: 0 },
  { id: 'calf_tear',            weight: 12, weeks: [3, 6],   lasting: 0 },
  { id: 'meniscus',             weight: 11, weeks: [8, 16],  lasting: 1 },
  { id: 'metatarsal_fracture',  weight: 8,  weeks: [10, 18], lasting: 1 },
  { id: 'shoulder_dislocation', weight: 6,  weeks: [6, 12],  lasting: 0 },
  { id: 'disc_hernia',          weight: 5,  weeks: [12, 22], lasting: 2 },
  { id: 'acl',                  weight: 9,  weeks: [26, 40], lasting: 3 },
  { id: 'tibia_fibula',         weight: 4,  weeks: [24, 38], lasting: 4 },
  { id: 'achilles',             weight: 3,  weeks: [30, 46], lasting: 5 },
];

/**
 * Season injury risk. Age and injury-proneness dominate; hard training and a
 * heavy workload push it up, good medical staff pull it down.
 */
export function injuryRisk(player: Player, multiplier: number): number {
  const ageRisk =
    player.age <= 20 ? 0.10 :
    player.age <= 26 ? 0.13 :
    player.age <= 30 ? 0.18 :
    player.age <= 33 ? 0.26 : 0.34;
  const proneness = 0.6 + (player.hidden.injuryProneness / 100) * 1.1;
  return clamp(ageRisk * proneness * multiplier, 0, 0.75);
}

export interface InjuryOutcome {
  id: string;
  weeks: number;
  lasting: number;
}

/**
 * Whether a bad injury actually leaves something behind.
 *
 * `lasting` used to be certain: every cruciate cost exactly three rating points,
 * every Achilles exactly five. Real careers are not that tidy — plenty of
 * players come back from a serious injury and are the same player, and the ones
 * who do not are the story. Making it a roll keeps the drama and roughly halves
 * the expected damage, which is the point: this should shade a career, not
 * decide it.
 *
 * Odds ramp with severity — a torn meniscus leaves a mark about a quarter of the
 * time, an Achilles closer to two thirds. Older players recover less completely.
 */
function lastingOdds(lasting: number, age: number): number {
  if (lasting <= 0) return 0;
  const base = lasting / (lasting + 3);
  return clamp(base * (age >= 30 ? 1.25 : age <= 21 ? 0.75 : 1), 0, 0.8);
}

export function rollInjury(rng: Rng, player: Player): InjuryOutcome {
  const type = weightedPick(rng, INJURY_TYPES, (t) => t.weight) ?? INJURY_TYPES[0]!;
  const [min, max] = type.weeks;
  // Older players heal slower.
  const healing = player.age >= 31 ? 1.25 : player.age <= 21 ? 0.85 : 1;
  const weeks = clamp(Math.round(int(rng, min, max) * healing), 1, 48);
  const lasting = chance(rng, lastingOdds(type.lasting, player.age)) ? type.lasting : 0;
  return { id: type.id, weeks, lasting };
}
