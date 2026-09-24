/**
 * International football.
 *
 * Call-ups are gated on a threshold that scales with how strong the player's
 * country is — being the best player in a minor nation gets you capped at 68,
 * while the same rating in a major one gets you nothing. Playing in a weak
 * league raises the bar further, because selectors stop watching.
 */

import type { Country, League, Player, SeasonStats, TrophyId } from '../types.js';
import { chance, clamp, gaussian, remap, type Rng } from '../rng.js';
import { positionGroup } from '../model/attributes.js';
import { EMPTY_SEASON_STATS } from './statline.js';

/** Ability needed for a senior call-up, by country reputation. */
export function callUpThreshold(country: Country, leagueStrength: number): number {
  const base = remap(country.reputation, 10, 100, 60, 82);
  // "Out of sight" penalty: obscure leagues cost you caps.
  const visibilityPenalty = leagueStrength < 0.6 ? (0.6 - leagueStrength) * 10 : 0;
  return Math.round(base + visibilityPenalty);
}

export interface NationalContext {
  player: Player;
  country: Country;
  league: League;
  year: number;
  /** Suspended players are not selected. */
  suspended: boolean;
  /**
   * The club-versus-country card, resolved.
   *
   * Both of these existed as effects, were listed as consequences on the card,
   * and **were never read here** — the context they needed was not passed in.
   * So answering your country's call demoted you at your club and produced no
   * caps at all, and refusing it changed nothing. The card was two buttons over
   * a coin that was not being flipped.
   */
  forceCallUp?: boolean;
  skipCallUp?: boolean;
}

export interface NationalResult {
  calledUp: boolean;
  stats: SeasonStats | null;
  trophies: TrophyId[];
  /** True when a major tournament was played this year, won or not. */
  playedTournament: boolean;
}

/**
 * Continental championships and World Cups both run on four-year cycles.
 *
 * Exported because the club-versus-country card has to name the tournament it
 * is asking him to fly to. "Your country wants you for a major tournament" is
 * not a thing anybody says: it is the World Cup, or the Euros, or the Asian
 * Cup, and which one changes what the choice is worth.
 */
export function tournamentThisYear(year: number): 'world_cup' | 'continental_nations' | null {
  if (year % 4 === 2) return 'world_cup';          // 2026, 2030, 2034…
  if (year % 4 === 0) return 'continental_nations'; // 2028, 2032…
  return null;
}

export function simulateNationalTeam(rng: Rng, context: NationalContext): NationalResult {
  const { player, country, league } = context;
  const empty: NationalResult = { calledUp: false, stats: null, trophies: [], playedTournament: false };

  if (context.suspended || player.age < 17 || context.skipCallUp) return empty;

  const threshold = callUpThreshold(country, league.strength);
  // A forced call-up is the card's whole promise: he went. The roll is skipped,
  // not weighted, because "you defied your club to join up" cannot end in the
  // selector quietly leaving him out.
  if (!context.forceCallUp && player.overall + gaussian(rng, 0, 1.5) < threshold) return empty;

  const tournament = tournamentThisYear(context.year);
  const caps = tournament ? Math.round(6 + rng() * 6) : Math.round(3 + rng() * 5);
  const group = positionGroup(player.position);

  // Keepers do not score for their country — the "else" bucket used to lump
  // them in with defenders at 0.05, and a 3,200-career sweep found nearly every
  // capped goalkeeper with an international goal to his name. An assist off a
  // long kick happens once a career, not once a tournament.
  const goalRate = group === 'ATT' ? 0.36 : group === 'MID' ? 0.12 : group === 'GK' ? 0 : 0.05;
  const assistRate = group === 'GK' ? 0.015 : 0.12;
  const stats: SeasonStats = {
    ...EMPTY_SEASON_STATS,
    appearances: caps,
    goals: Math.round(caps * goalRate * (0.5 + player.attributes.shooting / 120) * (0.6 + rng())),
    assists: Math.round(caps * assistRate * (0.5 + player.attributes.passing / 120) * (0.6 + rng())),
    cleanSheets: group === 'GK' || group === 'DEF' ? Math.round(caps * 0.35) : 0,
    rating: Math.round(clamp(6.4 + (player.overall - threshold) * 0.05 + gaussian(rng, 0, 0.3), 4.5, 9.5) * 100) / 100,
  };

  const trophies: TrophyId[] = [];
  if (tournament) {
    // Winning odds are almost entirely about the nation, not the individual.
    const nationTerm = Math.pow(remap(country.reputation, 40, 100, 0, 1), 2.8);
    const base = tournament === 'world_cup' ? 0.34 : 0.42;
    const playerTerm = 1 + clamp((player.overall - threshold) / 40, 0, 0.4);
    if (chance(rng, clamp(nationTerm * base * playerTerm, 0, 0.55))) trophies.push(tournament);
  }

  return { calledUp: true, stats, trophies, playedTournament: tournament !== null };
}
