/**
 * Which numbers describe a season, by position.
 *
 * Goals and assists summarise a striker and slander everyone else. A
 * goalkeeper's season is saves and clean sheets; a centre-back's is duels and
 * interceptions; a deep midfielder's is passing and tackles. Picking the right
 * four is the difference between a defender's career reading as a career and
 * reading as a striker who could not score.
 *
 * Lives in the engine rather than the UI so every renderer agrees, and so the
 * share card and the season row can never disagree about what mattered.
 */

import type { Position, SeasonStats, StatKey } from '../types.js';
import { positionGroup } from '../model/attributes.js';

/** Stats shown in the compact four-slot line, in order. */
export function statLineFor(position: Position): StatKey[] {
  switch (position) {
    case 'GK':
      return ['appearances', 'cleanSheets', 'saves', 'goalsConceded'];
    case 'CB':
      return ['appearances', 'cleanSheets', 'aerialsWon', 'interceptions'];
    case 'LB':
    case 'RB':
      return ['appearances', 'cleanSheets', 'tackles', 'assists'];
    case 'CDM':
      return ['appearances', 'tackles', 'interceptions', 'passAccuracy'];
    case 'CM':
      return ['appearances', 'assists', 'keyPasses', 'passAccuracy'];
    case 'CAM':
      return ['appearances', 'goals', 'assists', 'keyPasses'];
    case 'LM':
    case 'RM':
    case 'LW':
    case 'RW':
      return ['appearances', 'goals', 'assists', 'dribblesCompleted'];
    case 'ST':
      return ['appearances', 'goals', 'assists', 'keyPasses'];
  }
}

/** The two headline numbers for the tightest spots, e.g. a season row. */
export function primaryStatsFor(position: Position): [StatKey, StatKey] {
  const group = positionGroup(position);
  if (group === 'GK') return ['cleanSheets', 'saves'];
  if (group === 'DEF') return ['cleanSheets', 'interceptions'];
  if (position === 'CDM' || position === 'CM') return ['assists', 'keyPasses'];
  return ['goals', 'assists'];
}

/** Percentages need a suffix; counts do not. */
export function isPercentage(key: StatKey): boolean {
  return key === 'passAccuracy';
}

/** Career totals need to sum counts but average percentages. */
export function isAveraged(key: StatKey): boolean {
  return key === 'passAccuracy';
}

export const EMPTY_SEASON_STATS: SeasonStats = {
  appearances: 0,
  goals: 0,
  assists: 0,
  cleanSheets: 0,
  rating: 0,
  saves: 0,
  goalsConceded: 0,
  tackles: 0,
  interceptions: 0,
  aerialsWon: 0,
  keyPasses: 0,
  passAccuracy: 0,
  dribblesCompleted: 0,
};
