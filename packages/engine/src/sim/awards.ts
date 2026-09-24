/**
 * Individual awards.
 *
 * The Ballon d'Or deliberately weights league strength hard. Thirty goals in a
 * weak league should not win it, and making that true in the maths — rather
 * than in a special case — is what gives the Saudi decision its teeth.
 */

import type { AwardId, League, Player, SeasonStats, TrophyId } from '../types.js';
import { chance, clamp, remap, type Rng } from '../rng.js';
import { positionGroup } from '../model/attributes.js';

export interface AwardContext {
  player: Player;
  league: League;
  /**
   * The club season on its own.
   *
   * League awards are league awards, and this is the only number that decides
   * them. `stats` below is the club season *plus* the international one, and
   * using it here is how a player with six club appearances and eight caps
   * cleared a twelve-appearance floor and was named in a league Team of the
   * Season he had barely played in — visible in a shipped screenshot, at
   * Bayern, two starts and four off the bench.
   */
  club: SeasonStats;
  /** Club and country together. The Ballon d'Or is the one award that reads it. */
  stats: SeasonStats;
  trophies: TrophyId[];
  /** True when the player was capped at a major international tournament. */
  wonInternational: boolean;
}

/**
 * What each award asks of a league season before it is even considered.
 *
 * Football's own thresholds, roughly: nobody is picked in a Team of the Season
 * on a handful of cameos, a Golden Boot is won across a campaign rather than in
 * a cup run, and a keeper's clean-sheet ratio means nothing over five games. A
 * full season here is 38–46 games, so these are "most of a season", "two thirds
 * of one", and "most of one" respectively.
 */
const MIN_LEAGUE_APPS = { team_of_the_season: 25, golden_boot: 22, golden_glove: 25 } as const;
/** The Ballon d'Or reads the whole year, but it is still won at a club. */
const MIN_BALLON_CLUB_APPS = 25;

export function simulateAwards(rng: Rng, context: AwardContext): AwardId[] {
  const { player, league, club, stats, trophies } = context;
  const awards: AwardId[] = [];
  const group = positionGroup(player.position);

  // Team of the Season: the one honour a good player in any division can reach,
  // and the only one with no artwork of its own — it is the drawn medal.
  if (
    club.appearances >= MIN_LEAGUE_APPS.team_of_the_season &&
    chance(rng, clamp(remap(player.overall, 76, 96, 0, 0.5), 0, 0.5))
  ) {
    awards.push('team_of_the_season');
  }

  // The league's Golden Boot, scaled by league strength: 25 goals means far
  // more in a top division than in a third-tier one. Club goals only — a goal
  // at a World Cup is not a league goal, and counting it here handed the boot
  // to players who had not scored enough of them.
  if (group === 'ATT' || group === 'MID') {
    const scaled = club.goals * (0.55 + league.strength * 0.6);
    if (
      club.appearances >= MIN_LEAGUE_APPS.golden_boot &&
      chance(rng, clamp(remap(scaled, 16, 32, 0, 0.75), 0, 0.75))
    ) {
      awards.push('golden_boot');
    }
  }

  if (group === 'GK' && club.appearances >= MIN_LEAGUE_APPS.golden_glove) {
    const ratio = club.cleanSheets / club.appearances;
    if (chance(rng, clamp(remap(ratio, 0.34, 0.55, 0, 0.6), 0, 0.6))) awards.push('golden_glove');
  }

  /*
   * **Defender of the Season is gone, and so is Playmaker of the Season.**
   *
   * Deliberate, and the same decision twice: the honours in this game are the
   * three the real world has trophies for — the Ballon d'Or, the Golden Boot,
   * the Golden Glove — plus **one medal**, the league Team of the Season. Two
   * more position-specific awards beside them turned the shelf into a list.
   *
   * What they were added for is real and is fixed elsewhere, for every position
   * rather than for two: the achievements board scores output against what
   * *that* position normally produces (`OUTPUT_PAR`), so a centre-back is no
   * longer judged against a striker's goals. These awards were the crude
   * version of that answer, and they are no longer the answer.
   */

  /*
   * **Playmaker of the Season is gone.** Deliberately: the one medal in
   * this game is the league Team of the Season, and a second midfield-only
   * award beside it made the honours shelf read like a list rather than a
   * cabinet. What it existed to fix — a creator finishing a career with zero
   * award points where a striker had 368 — is fixed elsewhere and for every
   * position: the achievements board scores output against what *that* position
   * is for (`OUTPUT_PAR`), so a playmaker is no longer judged against a
   * striker's par. The award was the crude version of that answer.
   */

  // Ballon d'Or. Needs elite ability, elite output, and silverware that matters.
  const abilityTerm = clamp(remap(player.overall, 86, 97, 0, 1), 0, 1);
  const silverware =
    (trophies.includes('continental_elite') ? 0.45 : 0) +
    (trophies.includes('league') ? 0.22 : 0) +
    (trophies.includes('world_cup') ? 0.55 : 0) +
    (trophies.includes('continental_nations') ? 0.25 : 0) +
    (context.wonInternational ? 0.1 : 0);
  // Bands moved with the rating baseline (6.35 → 6.55 in `computeRating`), so
  // the Ballon d'Or is no easier to win than it was — it is being asked for the
  // same season, expressed on the corrected scale.
  const outputTerm = clamp(remap(stats.rating, 7.2, 8.8, 0, 1), 0, 1);
  // The multiplier that makes an obscure league a career dead end for awards.
  const visibility = Math.pow(league.strength, 1.8);

  const ballonOdds = clamp(abilityTerm * (0.25 + silverware) * (0.4 + outputTerm * 0.9) * visibility * 1.5, 0, 0.85);
  if (club.appearances >= MIN_BALLON_CLUB_APPS && chance(rng, ballonOdds)) awards.push('ballon_dor');

  return awards;
}
