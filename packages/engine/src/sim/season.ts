/**
 * Season simulation: appearances, goals, assists, clean sheets and rating.
 *
 * This is a statistical model, not a match engine. It answers "what does a
 * season of this player, in this role, at this club, in this league look like?"
 * — which is the only question the career layer actually needs, and it runs in
 * microseconds so the balance tool can sweep a hundred thousand careers.
 */

import type { Club, League, Player, SeasonStats, SquadRole } from '../types.js';
import { clamp, float, gaussian, poisson, remap, type Rng } from '../rng.js';
import { appearanceRange } from '../model/role.js';
import { positionGroup } from '../model/attributes.js';

/** Matches in a full domestic season, plus cup and continental fixtures. */
const BASE_FIXTURES = 38;

/**
 * Expected goals per 90 for a league-average player at each position group.
 *
 * These are multiplied by finishing, by how far the player is above the league,
 * and by squad strength. Those three factors have to stay tightly bounded or
 * they compound: an early version peaked at 1.5 goals per game and produced
 * 870-goal careers, which is roughly double the best real career ever played
 * and instantly reads as fake.
 *
 * Calibration targets, goals per appearance:
 *   elite striker at peak  ~0.75      top-flight striker  ~0.40
 *   attacking midfielder   ~0.25      centre-back         ~0.05
 */
const GOAL_RATE: Record<string, number> = { GK: 0.0, DEF: 0.04, MID: 0.09, ATT: 0.3 };
const ASSIST_RATE: Record<string, number> = { GK: 0.004, DEF: 0.05, MID: 0.12, ATT: 0.15 };

export interface SeasonSimInput {
  player: Player;
  club: Club;
  league: League;
  role: SquadRole;
  injuryWeeks: number;
  /** Extra continental fixtures the club qualified for. */
  continentalRounds: number;
  /** Temporary rating penalty from events, e.g. mental pressure. */
  temporaryDelta: number;
  /**
   * His very first season as a professional, at any club.
   *
   * A sixteen-year-old does not play a season, he gets a handful of games —
   * cup ties, dead rubbers, the last twenty minutes of a win. The role model
   * cannot express that on its own: a boy who joins a small enough club clears
   * its bar and is handed thirty appearances at sixteen, which no career has.
   */
  firstSeason: boolean;
}

/** Appearances a debut season is allowed, whatever the role says. */
const DEBUT_APPEARANCES: [number, number] = [3, 8];

export function simulateSeason(rng: Rng, input: SeasonSimInput): SeasonStats {
  const { player, club, league, role } = input;
  const group = positionGroup(player.position);

  // Appearances come from the role's own range — a starter plays 40–50, a
  // substitute 15–24 — scaled by how strong the club is (weaker sides rotate
  // less) and by time lost to injury.
  const [low, high] = input.firstSeason ? DEBUT_APPEARANCES : appearanceRange(role, group === 'GK');
  const clubFactor = remap(club.reputation, 10, 100, 0.88, 1);
  const availability = clamp(1 - input.injuryWeeks / 40, 0, 1);
  const fixtures = BASE_FIXTURES + 6 + input.continentalRounds;
  const appearances = input.firstSeason
    ? // A debut is a fixed handful of games. Club quality and time on the
      // treatment table shape a real season, but they must not turn a first
      // season into none at all — a sixteen-year-old who is injured in
      // September still gets his cup tie in February, and "0 appearances" reads
      // as a career that has not started rather than one that has.
      clamp(Math.round(float(rng, low, high) * availability), low, high)
    : Math.min(
        fixtures,
        Math.max(0, Math.round(float(rng, low, high) * clubFactor * availability)),
      );

  const effectiveOverall = player.overall + input.temporaryDelta;

  // How far above or below the level of this league the player is. Dominating a
  // weak league inflates output; scraping by in a strong one suppresses it.
  const leagueBar = remap(league.strength, 0.1, 1, 52, 82);
  const edge = clamp((effectiveOverall - leagueBar) / 14, -1.2, 1.6);

  // A stronger squad creates more chances for its attackers and concedes less.
  const squadFactor = remap(club.reputation, 10, 100, 0.82, 1.2);

  const shooting = player.attributes.shooting / 100;
  const creativity = (player.attributes.passing * 0.7 + player.attributes.dribbling * 0.3) / 100;

  // Each factor is capped near 1.4× so the three cannot compound into fiction.
  const goalLambda =
    (GOAL_RATE[group] ?? 0.09) * appearances * (0.5 + shooting) * (1 + edge * 0.3) * squadFactor;
  const assistLambda =
    (ASSIST_RATE[group] ?? 0.09) * appearances * (0.55 + creativity * 0.9) * (1 + edge * 0.22) * squadFactor;

  // Consistency is a per-season form swing around a FIXED expectation: low
  // consistency means bigger hot and cold streaks, never a different career
  // average. (An earlier version multiplied the Poisson mean itself, which
  // quietly paid inconsistent players ~30% more goals for life.)
  const formSpread = remap(player.hidden.consistency, 0, 100, 0.32, 0.09);
  const form = clamp(1 + gaussian(rng, 0, formSpread), 0.5, 1.6);

  const goals = poisson(rng, Math.max(0, goalLambda * form));
  // A keeper's Poisson tail can spit out a playmaker's season — a 3,200-career
  // sweep found one on 4 assists, which no goalkeeper in Europe has ever
  // recorded. Two is the real-world ceiling (Ederson's best).
  const assists = Math.min(
    poisson(rng, Math.max(0, assistLambda * form)),
    group === 'GK' ? 2 : Number.MAX_SAFE_INTEGER,
  );

  const cleanSheets =
    group === 'GK' || group === 'DEF'
      ? Math.round(appearances * clamp(0.14 + (club.reputation / 100) * 0.34 + edge * 0.06, 0, 0.62))
      : 0;

  const detail = detailStats(rng, {
    group,
    position: player.position,
    attributes: player.attributes,
    appearances,
    clubReputation: club.reputation,
    edge,
  });

  const rating = computeRating(rng, {
    group,
    edge,
    goals,
    assists,
    appearances,
    cleanSheets,
    consistency: player.hidden.consistency,
  });

  return {
    appearances,
    goals,
    assists,
    cleanSheets,
    rating,
    ...detail,
  };
}

/**
 * The position-specific counting stats.
 *
 * These do not feed back into anything — they exist so a defender's season
 * reads like a defender's season. Rates are per appearance and roughly match
 * top-division averages; the attribute term moves a good player about 60% above
 * a poor one, which is the right spread for counting stats.
 */
function detailStats(
  rng: Rng,
  input: {
    group: string;
    position: string;
    attributes: Player['attributes'];
    appearances: number;
    clubReputation: number;
    edge: number;
  },
): Omit<SeasonStats, 'appearances' | 'goals' | 'assists' | 'cleanSheets' | 'rating'> {
  const { group, attributes, appearances: apps } = input;
  const scale = (base: number, attribute: number) =>
    Math.round(apps * base * (0.7 + (attribute / 100) * 0.9) * (0.85 + rng() * 0.3));

  // A weak team faces more shots, so its keeper's save count goes up even as
  // the team gets worse — which is why saves alone never tell you much.
  const pressure = remap(input.clubReputation, 10, 100, 1.45, 0.6);

  const saves = group === 'GK' ? Math.round(apps * 2.6 * pressure * (0.7 + (attributes.pace / 100) * 0.8)) : 0;
  const goalsConceded = group === 'GK' ? Math.round(apps * 1.35 * pressure * (1 - input.edge * 0.12)) : 0;

  const tackleBase = group === 'DEF' ? 1.9 : group === 'MID' ? 1.8 : group === 'GK' ? 0 : 0.6;
  const interceptBase = group === 'DEF' ? 1.5 : group === 'MID' ? 1.1 : group === 'GK' ? 0 : 0.3;
  const aerialBase =
    input.position === 'CB' ? 2.6 : input.position === 'ST' ? 1.7 : group === 'GK' ? 0.4 : 0.9;
  const keyPassBase = group === 'ATT' || group === 'MID' ? 1.4 : group === 'DEF' ? 0.5 : 0.05;
  const dribbleBase =
    input.position === 'LW' || input.position === 'RW' || input.position === 'LM' || input.position === 'RM'
      ? 1.9
      : group === 'ATT' || group === 'MID'
        ? 1.0
        : 0.4;

  // Pass completion clusters tightly: even poor passers complete most of them,
  // so the visible range is narrow and a 90 means something.
  const passAccuracy =
    apps > 0
      ? Math.round(
          clamp(
            remap(attributes.passing, 40, 99, 70, 91) + (group === 'DEF' ? 3 : group === 'ATT' ? -4 : 0) + gaussian(rng, 0, 1.6),
            58,
            95,
          ),
        )
      : 0;

  return {
    saves,
    goalsConceded,
    tackles: scale(tackleBase, attributes.defending),
    interceptions: scale(interceptBase, attributes.defending),
    aerialsWon: scale(aerialBase, attributes.physical),
    keyPasses: scale(keyPassBase, attributes.passing),
    passAccuracy,
    dribblesCompleted: scale(dribbleBase, attributes.dribbling),
  };
}

function computeRating(
  rng: Rng,
  input: {
    group: string;
    edge: number;
    goals: number;
    assists: number;
    appearances: number;
    cleanSheets: number;
    consistency: number;
  },
): number {
  const per90 = input.appearances > 0 ? (input.goals + input.assists * 0.7) / input.appearances : 0;
  const contribution =
    input.group === 'ATT' ? per90 * 1.25 :
    input.group === 'MID' ? per90 * 1.85 :
    input.group === 'DEF' ? (input.appearances > 0 ? (input.cleanSheets / input.appearances) * 1.1 : 0) :
    (input.appearances > 0 ? (input.cleanSheets / input.appearances) * 1.3 : 0);

  /**
   * A season average is an average over forty matches, and it was being drawn
   * with the spread of a single one.
   *
   * At ±0.42 a striker who had scored sixteen in forty-four could finish the
   * season on 6.37 — a number that reads as somebody who barely played —
   * purely because the season-level draw went against him. The
   * variance a season *should* have is already there and already earned: it
   * lives in the Poisson draws for goals and assists, which is where an
   * inconsistent player's hot and cold streaks belong (`formSpread`). Adding a
   * second, larger swing on top of the average double-counted it and untethered
   * the rating from the stat line printed next to it.
   */
  const spread = remap(input.consistency, 0, 100, 0.20, 0.08);

  /**
   * The baseline, set against what a match rating conventionally means rather
   * than by feel.
   *
   * 6.55 is "he played and did his job"; the contribution term then carries a
   * forward from about 6.9 at a quarter of a goal a game to about 7.4 at three
   * in four. It was 6.35, which rated a good season as a poor one and made the
   * whole career table read a quarter of a point mean.
   */
  const raw = 6.55 + input.edge * 0.45 + contribution + gaussian(rng, 0, spread);
  return Math.round(clamp(raw, 4.2, 9.6) * 100) / 100;
}

export { EMPTY_SEASON_STATS as EMPTY_STATS } from './statline.js';

export function addStats(a: SeasonStats, b: SeasonStats): SeasonStats {
  const appearances = a.appearances + b.appearances;
  // Appearance-weighted mean, so a three-cap international summer does not drag
  // a forty-game club season around. Rates average; counts sum.
  const weighted = (x: number, y: number) =>
    appearances > 0
      ? Math.round(((x * a.appearances + y * b.appearances) / appearances) * 100) / 100
      : 0;

  return {
    appearances,
    goals: a.goals + b.goals,
    assists: a.assists + b.assists,
    cleanSheets: a.cleanSheets + b.cleanSheets,
    rating: weighted(a.rating, b.rating),
    saves: a.saves + b.saves,
    goalsConceded: a.goalsConceded + b.goalsConceded,
    tackles: a.tackles + b.tackles,
    interceptions: a.interceptions + b.interceptions,
    aerialsWon: a.aerialsWon + b.aerialsWon,
    keyPasses: a.keyPasses + b.keyPasses,
    passAccuracy: Math.round(weighted(a.passAccuracy, b.passAccuracy)),
    dribblesCompleted: a.dribblesCompleted + b.dribblesCompleted,
  };
}
