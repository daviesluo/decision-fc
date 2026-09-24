/**
 * Squad role and tactical fit.
 *
 * This is the file that makes "should I join the bigger club?" a real question.
 * A manager's style re-weights which attributes matter, so an 82-rated target
 * man can be a starter under a wing-play manager and a substitute under a
 * possession one at a club of identical reputation.
 */

import {
  ATTRIBUTE_KEYS,
  type AttributeKey,
  type Club,
  type League,
  type ManagerStyle,
  type Player,
  type Position,
  type SquadRole,
} from '../types.js';
import { clamp, remap } from '../rng.js';
// Type only: `market.ts` imports this module at runtime, and a value import
// back would be a cycle. The band names belong with the standing that produces
// them, and the loan lift is a table over exactly those bands.
import type { ClubStanding } from './market.js';

/**
 * Attribute emphasis per manager style, as multipliers on the position weights.
 * Above 1 means the style leans on that attribute more than the position
 * normally would.
 */
const STYLE_EMPHASIS: Record<ManagerStyle, Partial<Record<AttributeKey, number>>> = {
  // Relentless pressing: legs and engine over craft.
  gegenpress: { pace: 1.35, physical: 1.3, defending: 1.15, passing: 0.85, dribbling: 0.85 },
  // Positional play: everyone must be able to receive and move the ball.
  possession: { passing: 1.45, dribbling: 1.15, pace: 0.75, physical: 0.8, shooting: 0.95 },
  // Deep block, break at speed: raw pace and finishing on the counter.
  counter: { pace: 1.4, shooting: 1.2, defending: 1.1, passing: 0.8, dribbling: 0.95 },
  // Defend first: organisation and duels; flair is a liability.
  low_block: { defending: 1.45, physical: 1.3, pace: 0.85, dribbling: 0.65, shooting: 0.85 },
  // Width and crosses: wingers who beat a man, forwards who attack the ball.
  wing_play: { dribbling: 1.3, pace: 1.2, physical: 1.15, passing: 0.9, defending: 0.9 },
  // Let the best players play: rewards outliers in any single attribute.
  free_role: { dribbling: 1.25, shooting: 1.2, passing: 1.1, defending: 0.8, physical: 0.85 },
};

/**
 * How well the player suits a manager style, as a multiplier on effective
 * ability. Bounded to roughly ±12% — enough to decide a squad place, never
 * enough to turn a poor player into a good one.
 */
export function styleFit(player: Player, style: ManagerStyle): number {
  const emphasis = STYLE_EMPHASIS[style];
  let weighted = 0;
  let plain = 0;
  for (const key of ATTRIBUTE_KEYS) {
    const value = player.attributes[key];
    const multiplier = emphasis[key] ?? 1;
    weighted += value * multiplier;
    plain += value;
  }
  if (plain === 0) return 1;
  return clamp(0.88 + (weighted / plain - 1) * 1.6, 0.88, 1.12);
}

/** How well the player suits this club's manager. See `styleFit`. */
export function tacticalFit(player: Player, club: Club): number {
  return styleFit(player, club.managerStyle);
}

/**
 * How close to the best system on offer anywhere a club has to be to count as
 * one that suits him.
 *
 * Relative, not absolute, because most players have no system that clearly
 * suits them: over 3,700 windows the median player's best fit was 1.03, and a
 * fixed bar at 1.04 was out of reach for two players in three. And near-best
 * rather than best, because the best is often scarce — seventeen clubs in the
 * world play wing play, and a technical striker's best system is wing play
 * nearly every time. 0.02 is the median gap between a player's best system and
 * his second, so this admits the runner-up when it is genuinely close and not
 * when it is not.
 */
export const FIT_NEAR_BEST = 0.02;

/**
 * The floor any club in this division demands, whatever its reputation.
 *
 * Reputation alone cannot express this, and pretending it could was the single
 * worst bug in the squad model. Our numbers put Leeds at 60 and Southampton at
 * 55 — five apart — so the two clubs asked the *same* standard of a player,
 * which made a 65-rated footballer a Premier League regular. He is not one.
 * The real gap between the bottom of a first division and the top of a second
 * is enormous, and it is a property of the division, not of the club.
 *
 * So the standard is the higher of what the club's own standing demands and
 * what its league does. A giant is unaffected — Manchester City asked 88 before
 * this existed and asks 88 now — and everything that moves is at the bottom of
 * a top flight, which is exactly where the model was lying.
 */
const LEAGUE_FLOOR_LOW = 56;
const LEAGUE_FLOOR_HIGH = 74;

export function leagueFloor(league: League): number {
  return remap(league.strength, 0.37, 1.0, LEAGUE_FLOOR_LOW, LEAGUE_FLOOR_HIGH);
}

/**
 * The OVR a player must clear to be a regular starter at this club.
 *
 * `league` is the division the club is in *right now*, which a career changes:
 * promotion and relegation move clubs, so this must never be derived from
 * `club.leagueId`, which is only where the world started.
 */
export function starterBar(club: Club, league: League): number {
  return Math.round(Math.max(CLUB_BASELINE[reputationBand(club.reputation)]!, leagueFloor(league)));
}

export interface RoleContext {
  club: Club;
  /** The division the club is in this season. */
  league: League;
  /** Promised role from the contract acts as a floor for one season. */
  promisedRole: SquadRole | null;
  /** Whether the player is currently serving a suspension. */
  suspended: boolean;
  /** Consecutive seasons already served here; long service earns a rung. */
  seasonsAtClub: number;
}

/**
 * Clubs sit in six reputation bands, and each band has a squad standard a
 * player must clear to start. Bands rather than a smooth curve because the
 * real world is banded too: the gap between a title contender and a mid-table
 * side is a step, not a slope.
 */
export function reputationBand(reputation: number): number {
  if (reputation >= 90) return 5;
  if (reputation >= 84) return 4;
  if (reputation >= 76) return 3;
  if (reputation >= 66) return 2;
  if (reputation >= 52) return 1;
  return 0;
}

const CLUB_BASELINE = [58, 68, 75, 80, 84, 88];

export const ROLE_ORDER: SquadRole[] = [
  'fringe',
  'impact_sub',
  'squad',
  'regular',
  'important',
  'star',
];

export function shiftRole(role: SquadRole, steps: number): SquadRole {
  const index = ROLE_ORDER.indexOf(role);
  return ROLE_ORDER[clamp(index + steps, 0, ROLE_ORDER.length - 1)]!;
}

export function roleRank(role: SquadRole): number {
  return ROLE_ORDER.indexOf(role);
}

/** The lower of two roles. */
export function minRole(a: SquadRole, b: SquadRole): SquadRole {
  return roleRank(a) <= roleRank(b) ? a : b;
}

/**
 * How far above the club's squad standard this player is, in rating points.
 * Tactical fit moves it by at most ±2 — enough to decide a squad place, never
 * enough to make a player something he is not.
 */
export function standingDelta(player: Player, club: Club, league: League): number {
  const fitAdjust = clamp((tacticalFit(player, club) - 1) * 25, -2, 2);
  return player.overall + fitAdjust - starterBar(club, league);
}

/**
 * Rating points clear of the club's standard each rung demands. Outfielders
 * and goalkeepers are graded apart because a goalkeeper's season is close to
 * binary: he plays or he does not, so there is no "squad player" keeping a
 * third of the minutes warm.
 */
const ROLE_BANDS: { role: SquadRole; delta: number }[] = [
  { role: 'star', delta: 10 },
  { role: 'important', delta: 5 },
  { role: 'regular', delta: 0 },
  { role: 'squad', delta: -4 },
  { role: 'impact_sub', delta: -8 },
];

const ROLE_BANDS_GK: { role: SquadRole; delta: number }[] = [
  { role: 'star', delta: 10 },
  { role: 'important', delta: 4 },
  { role: 'regular', delta: 0 },
  { role: 'impact_sub', delta: -6 },
];

function bandsFor(player: Player): { role: SquadRole; delta: number }[] {
  return player.position === 'GK' ? ROLE_BANDS_GK : ROLE_BANDS;
}

/**
 * The rung a given standing buys. Separate from `roleCeiling` so a caller that
 * wants to ask "and what if he were this much better here?" — a loan club that
 * takes a boy specifically to play him — reads off the same ladder rather than
 * inventing a second one.
 */
export function roleForDelta(player: Player, delta: number): SquadRole {
  for (const band of bandsFor(player)) {
    if (delta >= band.delta) return band.role;
  }
  return 'fringe';
}

/**
 * The best role this player could hold at this club on ability alone.
 *
 * Everything that could otherwise hand out a role — a contract clause, a lucky
 * event card, a loan guarantee — is clamped to this. That is the whole point:
 * a 68-rated player who signs for a Champions League side is a squad player
 * there no matter what the contract says or how the season breaks for him,
 * because the eleven ahead of him are better and no piece of paper changes
 * that. Getting promoted means getting better first.
 *
 * One deliberate crack: `PROMISE_HEADROOM` lets a club promise exactly one
 * rung above what he has earned. Clubs do oversell a signing, the player finds
 * out in August, and a guarantee that could never be broken would make every
 * transfer decision a formality.
 */
export function roleCeiling(player: Player, club: Club, league: League): SquadRole {
  return roleForDelta(player, standingDelta(player, club, league));
}

/**
 * Standing earned by service, in rungs of headroom above pure ability.
 *
 * Every incentive in this game used to point at leaving. Loyalty paid a small
 * legacy bonus at retirement and nothing during a career, while every window
 * offered a raise — so a one-club career, one of football's best stories, had
 * no mechanical account of itself at all.
 *
 * Seasons served buy a rung. A player the club raised, or who has been there
 * five years, is picked ahead of a signing of identical ability, because that
 * is what actually happens: managers trust the player they know, the crowd sings
 * for him, and being sold becomes a decision the board has to justify.
 *
 * Capped at one rung. It is a thumb on the scale, not a way to be a Champions
 * League club's star player on 68 ability.
 */
const SERVICE_FOR_STANDING = 4;

export function standingBonus(seasonsAtClub: number): number {
  return seasonsAtClub >= SERVICE_FOR_STANDING ? 1 : 0;
}

/**
 * The role a club will put in writing — exactly the one his ability earns here.
 *
 * This used to add a rung of "clubs oversell a signing" optimism on top. The
 * intent was that a club occasionally talks a player up and he finds out in
 * August; what it actually did was add the rung to *every* offer in the game,
 * so the contract was wrong by precisely one rung every single time. A player
 * signed as an Important Player, opened the top bar, and read Regular Starter —
 * not sometimes, always. A promise that is never kept is not a promise, it is
 * a display bug with a backstory.
 *
 * So the card now states the truth, and `determineRole` honours it. The upside
 * that used to hide in the lie has a home of its own in `roleCap`, where it
 * belongs: something a season earns, not something a signature grants.
 */
export function promisableRole(player: Player, club: Club, league: League, seasonsAtClub = 0): SquadRole {
  const base = shiftRole(roleCeiling(player, club, league), standingBonus(seasonsAtClub));
  /*
   * The spin-off floor — the second place, after the loan guarantee, where a
   * promise legitimately outruns the ability bar. A Saudi, American, Japanese
   * or Chinese club does not fly a European name in to rotate him: the signing
   * IS the product, the whole pitch is that he plays, and the rule
   * says every such offer reads at least Important Player. `determineRole`
   * honours the promise for the season it was signed, so the card and the
   * season agree; from the second season ability decides again, like anywhere.
   */
  if (league.market === 'spinoff' && roleRank(base) < roleRank('important')) return 'important';
  return base;
}

/**
 * The hard ceiling on a role once the season is running.
 *
 * One rung above what he has earned, and that rung is the whole of the upside
 * an event card, a good run in the side or a loan guarantee can ever buy. A
 * 68-rated player does not become a Champions League club's Star Player because
 * a card said so — but he can force his way from Squad Player to Regular
 * Starter over a season that goes well, which is a thing that happens.
 */
const IN_SEASON_HEADROOM = 1;

/**
 * What a borrowing club's obligation is worth, in rungs — and it depends
 * entirely on **who is borrowing him**.
 *
 * A club takes a young player on loan specifically to play him, usually under a
 * clause obliging it to, and that lift is the only reason a seventeen-year-old
 * has anywhere to go at all: he rates below every senior starting bar in the
 * database. But a flat two rungs for everybody made every loan card read the
 * same — "Star Player" three times over — and it is not how the loan market
 * works. The rule, and it is obviously right:
 *
 *   a second-tier club chasing promotion has a squad built to go up, and will
 *   give a borrowed teenager rotation minutes and no more;
 *   a mid-table one will build a bit of its side around him;
 *   a club fighting relegation will play him every week, because he is one of
 *   the best players it can get.
 *
 * So the lift is read off where the club sits **in its own division**, which is
 * the same `clubStanding` the offer row prints. The cap of two rungs still
 * holds at the bottom of the table — it is the same total the ladder allows a
 * long-serving player having a good season — and at the top of a division it is
 * zero, so a promotion-chasing club offers exactly what his ability earns
 * there.
 *
 * Everything a loan card promises is bounded by this, and the season reads the
 * same function, so the card cannot promise a season the engine will not
 * deliver — which is exactly what happened when the destination filter used its
 * own private bonus and the cap clawed it back: "Regular Starter — you would
 * start every week" resolving to impact sub.
 */
export const LOAN_GUARANTEE: Record<ClubStanding, SquadRole> = {
  // Chasing the title or promotion: the squad is already built to go up, and a
  // borrowed teenager gets rotation minutes.
  title: 'squad',
  promotion: 'squad',
  // European or play-off places: the same. Still a side with somewhere to be.
  european: 'squad',
  playoff: 'squad',
  // Mid-table: room to build part of a side around him.
  midtable: 'important',
  // Fighting to stay up: he plays every week, because he is the best player
  // they were able to get hold of.
  survival: 'star',
};

/**
 * The role a season on loan is written for: the **higher** of what his ability
 * earns at that club and what the club has undertaken to give him.
 *
 * The guarantee genuinely does outrun ability, and it is the one place in this
 * game where that is right rather than a bug. Everywhere else the ladder is
 * hard — a 68-rated player is a squad player at a Champions League club
 * whatever the paper says — because a club picks the best eleven it has. A loan
 * is the exception by construction: the parent club lends the boy *on condition
 * that he plays*, the borrowing club signs up to it, and that clause is the
 * entire reason a seventeen-year-old has anywhere to go. He rates below every
 * senior starting bar in the database.
 *
 * The offer audit knows this and skips loan seasons for that reason; every
 * other season is still held to ability plus at most two rungs.
 */
export function roleCapOnLoan(
  player: Player,
  club: Club,
  league: League,
  standing: ClubStanding,
): SquadRole {
  const earned = roleCeiling(player, club, league);
  const promised = LOAN_GUARANTEE[standing];
  return roleRank(earned) >= roleRank(promised) ? earned : promised;
}

export function roleCap(player: Player, club: Club, league: League, seasonsAtClub = 0): SquadRole {
  // The two do not stack. Adding them let a long-serving player who is only
  // just good enough to start reach *two* rungs above his ability — a Star
  // Player on a rating that earns Regular Starter, which is exactly the thing
  // the ladder exists to prevent. Whichever is larger applies, and it is one.
  return shiftRole(
    roleCeiling(player, club, league),
    Math.max(IN_SEASON_HEADROOM, standingBonus(seasonsAtClub)),
  );
}

/**
 * How far off the next rung he is, at this club.
 *
 * The ladder is deterministic on purpose — "am I good enough for them?" is a
 * question the player should be able to answer by looking at the numbers rather
 * than by gambling. But until this existed the numbers were only in the source:
 * a player could see he was a squad player and had no way to know whether that
 * was two rating points away from a starting place or twenty.
 *
 * Returns null at the top of the ladder, or when service already has him above
 * what ability alone would buy.
 *
 * `shown` is the role the screen is displaying — the one he actually held last
 * season, or the one his contract promised him — and it is not always the one
 * his ability earns. A card that hands him a rung, a promise honoured for the
 * season it was signed, or a loan guarantee can all put him above it, and this
 * function measured from ability alone: the header read "Regular Starter" and
 * the line under it read "+3 OVR to be a regular starter here", which is the
 * screen telling a player he is not yet the thing it has just called him.
 * Measure from whichever is higher.
 */
export function nextRung(
  player: Player,
  club: Club,
  league: League,
  seasonsAtClub = 0,
  shown: SquadRole | null = null,
): { role: SquadRole; points: number } | null {
  const fromAbility = shiftRole(roleCeiling(player, club, league), standingBonus(seasonsAtClub));
  const current = shown && roleRank(shown) > roleRank(fromAbility) ? shown : fromAbility;
  if (current === 'star') return null;

  const delta = standingDelta(player, club, league);
  const bands = bandsFor(player);
  const wanted = ROLE_ORDER[roleRank(current) + 1]!;
  // The band the *ceiling* has to reach; service carries the rest.
  const target = bands.find((b) => b.role === shiftRole(wanted, -standingBonus(seasonsAtClub)));
  if (!target) return null;

  const points = Math.max(1, Math.ceil(target.delta - delta));
  return { role: wanted, points };
}

/**
 * Where a player stands in a squad — ability against the club's standard, and
 * almost nothing else.
 *
 * This is deliberately deterministic: the same player at the same club always
 * gets the same role, so "am I good enough for them?" is a question the player
 * can answer by looking at the numbers rather than by gambling. Tactical fit is
 * the only other input, and it is small: a couple of points either way, never
 * the difference between starting and being frozen out.
 */
export function determineRole(player: Player, context: RoleContext): SquadRole {
  if (context.suspended) return 'fringe';

  let role = shiftRole(
    roleCeiling(player, context.club, context.league),
    standingBonus(context.seasonsAtClub),
  );

  // The contract is honoured for the season it was signed. Since the promise is
  // now exactly the role his ability earned when he signed, this only ever bites
  // when something moved underneath him — most often a new manager whose system
  // suits him worse. Being carried for one season by a deal you signed in good
  // faith is right; the season after, ability alone decides again.
  if (context.promisedRole && roleRank(role) < roleRank(context.promisedRole)) {
    role = context.promisedRole;
  }
  return role;
}

/** Appearances a role is worth across a full season, before injuries. */
export function appearanceRange(role: SquadRole, isGoalkeeper: boolean): [number, number] {
  if (isGoalkeeper) {
    // A goalkeeper is first choice or he is watching.
    if (roleRank(role) >= roleRank('regular')) return [42, 50];
    if (role === 'fringe') return [0, 4];
    return [2, 12];
  }
  switch (role) {
    case 'star':
      return [42, 50];
    case 'important':
      return [38, 48];
    case 'regular':
      return [33, 44];
    case 'squad':
      return [25, 39];
    case 'impact_sub':
      return [15, 24];
    case 'fringe':
      return [5, 14];
  }
}

/*
 * `minutesShare` used to live here: a second, differently-scaled statement of
 * what a role is worth in minutes, documented as driving "appearances, and
 * through them both development and output". Nothing called it. `appearanceRange`
 * above is what the season actually reads, and the two disagreed — a fringe
 * player at 4% of the minutes against a range of 5-14 games — so the only thing
 * the export could have done, had anybody wired it up, is contradict the model.
 * Deleted rather than reconciled: one rule, in one place.
 */

/**
 * Whether a club would realistically want this player at all. Used to filter
 * transfer offers so a 62-rated reserve never gets a Champions League bid.
 *
 * This is the **floor** — is he good enough for them. It has a mirror, below.
 */
export function isRealisticTarget(
  player: Player,
  club: Club,
  league: League,
  tolerance = 6,
): boolean {
  const bar = starterBar(club, league);
  return player.overall >= bar - tolerance - (player.age <= 20 ? 6 : 0);
}

/**
 * How far above a club's standard a player may be and still be a plausible
 * permanent signing for it — a couple of rungs past its Star Player.
 *
 * A club signs the best player it can attract, and a player this far clear of
 * its standard does not sign for it: he is too good for the wage, the stage and
 * the level, and he would not go even if they asked. Fourteen points is a
 * comfortable Star Player and then some — enough that a good player can still
 * join a smaller top-flight side and be its best, but not so much that an
 * 86-rated forward is shown a Serie B club, which is the offer a benched
 * Barcelona winger was once shown, and it was nonsense.
 */
const OFFER_ABILITY_CEILING = 14;

/**
 * The **ceiling** the floor was always missing: a core-market club so far below
 * the player that it would never realistically sign him is not a suitor,
 * whatever his recent form.
 *
 * Form drove the market on its own before this — a good season brought the
 * clubs above down to look, a poor one brought the clubs below up — so a player
 * with real ability but no minutes (an 86 frozen out) had *every* club he
 * cleared on the floor bidding for him, down to the second divisions. Ability
 * is not form: a benched star is still a star, and the clubs that can sign him
 * are still only the ones near his level.
 *
 * Spin-off clubs are exempt: a twilight money move to the Gulf is a bid on the
 * cheque, not on the fit, and it is gated by age and market rules elsewhere.
 */
export function withinOfferReach(player: Player, club: Club, league: League): boolean {
  if (league.market !== 'core') return true;
  return player.overall - starterBar(club, league) <= OFFER_ABILITY_CEILING;
}

/** Positional versatility, used when an event asks the player to switch roles. */
export function adjacentPositions(position: Position): Position[] {
  switch (position) {
    case 'GK':
      return [];
    case 'CB':
      return ['CDM', 'LB', 'RB'];
    case 'LB':
      return ['CB', 'CDM', 'LW'];
    case 'RB':
      return ['CB', 'CDM', 'RW'];
    // LM/RM are retired as *playable* positions; a legacy save that still
    // carries one retrains into the modern equivalents.
    case 'LM':
      return ['LW', 'CM'];
    case 'RM':
      return ['RW', 'CM'];
    case 'CDM':
      return ['CM', 'CAM'];
    case 'CM':
      return ['CDM', 'CAM'];
    case 'CAM':
      return ['CDM', 'CM'];
    case 'ST':
      return ['LW', 'RW', 'CAM'];
    case 'LW':
      return ['ST', 'CAM'];
    case 'RW':
      return ['ST', 'CAM'];
  }
}
