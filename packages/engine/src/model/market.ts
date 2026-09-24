/**
 * Transfer market plausibility.
 *
 * The problem this solves: picking destinations purely on "would this club take
 * him?" produced windows offering Tottenham alongside a Chinese second-division
 * side. Both were technically valid — the player cleared both squads' bars —
 * and the card was nonsense, because those two clubs do not compete for the
 * same signature in any world.
 *
 * Three rules fix it:
 *
 *  1. A player has a *market level* set by his ability, and offers come from
 *     leagues near that level. Clubs far above do not call; clubs far below do
 *     not bother.
 *  2. Last season moves that level. A season as the star of a mid-table side is
 *     an audition: the clubs above start calling and the clubs below stop
 *     bothering. A season on the bench is the same mechanism in reverse.
 *  3. Spin-off leagues — the Gulf, MLS, China, Japan — are not an ordinary next
 *     step. They appear as a money move late in a career, or as a way out when
 *     Europe has stopped calling, and never more than one per window.
 */

import type { Club, League, Player, SeasonRecord, SquadRole, World } from '../types.js';
import { clamp, remap } from '../rng.js';
import { roleRank } from './role.js';

/** The league strength a player of this ability naturally belongs in. */
export function marketLevel(player: Player): number {
  return clamp(remap(player.overall, 52, 88, 0.32, 1.0), 0.28, 1.0);
}

/**
 * The part of last season a scout would actually quote.
 *
 * Kept as its own small shape rather than the whole `SeasonRecord` so the
 * market cannot quietly start reading things it has no business reading —
 * earnings, headlines, who was in the dressing room.
 */
export interface MarketForm {
  role: SquadRole;
  appearances: number;
  /** Average match rating, 4.0–10.0. */
  rating: number;
  /** Trophies lifted last season. */
  trophies: number;
  /** Individual awards won last season. */
  awards: number;
  /** Ability gained across the season — a rising player is a different asset. */
  growth: number;
}

export function marketFormOf(season: SeasonRecord | null | undefined): MarketForm | null {
  if (!season) return null;
  return {
    role: season.role,
    appearances: season.stats.appearances,
    rating: season.stats.rating,
    trophies: season.trophies.length,
    awards: season.awards.length,
    growth: season.overallEnd - season.overallStart,
  };
}

const ROLE_STANDING: Record<SquadRole, number> = {
  star: 0.5,
  important: 0.3,
  regular: 0.14,
  squad: -0.06,
  impact_sub: -0.45,
  fringe: -0.8,
};

/**
 * How much last season changed his standing, from −1 (forgotten) to +1 (the
 * name every sporting director says out loud). Squad role and match rating do
 * most of the work; silverware and a jump in ability are the accents.
 */
export function formScore(form: MarketForm | null | undefined): number {
  if (!form) return 0;
  const played = ROLE_STANDING[form.role] + clamp(remap(form.appearances, 8, 40, -0.3, 0.14), -0.3, 0.14);
  // Band moved with the rating baseline (6.35 → 6.55 in `sim/season.ts`). It is
  // the same season being graded, read off the corrected scale — leaving it
  // where it was would have promoted every ordinary season to a good one, and
  // the market would have started showing smaller clubs to players it had just
  // decided were on the way up.
  const graded = clamp(remap(form.rating, 6.5, 7.8, -0.35, 0.5), -0.35, 0.5);
  const silverware = Math.min(0.22, form.trophies * 0.09) + Math.min(0.3, form.awards * 0.18);
  const rising = clamp(form.growth * 0.05, -0.2, 0.22);
  return clamp(played + graded + silverware + rising, -1, 1);
}

export interface MarketContext {
  player: Player;
  /**
   * The world, needed to say where a club sits **in its own division** — the
   * same `clubStanding` the offer row prints. Only the three smaller European
   * top flights consult it, and only to answer "is this their title race or
   * their European places?".
   */
  world: World;
  /** The league he is in now; always stays in range so staying is an option. */
  currentLeague: League | null;
  /** The club he plays for — the rung of the ladder every offer is measured against. */
  currentClub?: Club | null;
  /** Set when Europe has produced nothing — opens the spin-off door early. */
  europeQuiet: boolean;
  /**
   * Nobody anywhere in his band will register him. This is the genuine dead
   * end, and the only thing that opens the spin-off door before the age gate.
   */
  lastResort?: boolean;
  /** Last season's demonstrated form; big clubs do not buy invisible players. */
  form?: MarketForm | null;
}

/**
 * Did last season actually show anything a scout could point at?
 *
 * A hard gate rather than a point on the `formScore` scale: a player who did
 * not play cannot be bought on potential alone, however good the rest of his
 * numbers look.
 */
function weakForm(context: MarketContext): boolean {
  const form = context.form;
  return form != null && (roleRank(form.role) <= roleRank('impact_sub') || form.appearances < 15);
}

/** The level of football his last season argues for, rather than his ability alone. */
export function standingLevel(context: MarketContext): number {
  return clamp(marketLevel(context.player) + formScore(context.form) * 0.08, 0.28, 1.0);
}

/**
 * How far from his level a player will realistically be looked at.
 *
 * Young players get a wider window upward — clubs buy potential — and everyone
 * gets a wide window downward, because dropping a level is always possible.
 * After a season that made people notice the floor comes up: nobody who just
 * starred in a top division fields offers from two divisions below.
 */
function bandFor(context: MarketContext): { low: number; high: number } {
  const level = standingLevel(context);
  const upward = context.player.age <= 23 ? 0.3 : 0.22;
  const band = { low: level - 0.34, high: level + upward };
  if (formScore(context.form) > 0.2 && context.currentLeague) {
    band.low = Math.max(band.low, context.currentLeague.strength - 0.18);
  }
  return band;
}

/**
 * Whether a spin-off move makes sense right now.
 *
 * Late career is the honest version of this — the wages are the point and
 * everyone knows it. Before that it only appears when nothing in Europe wants
 * him, which is its own kind of story.
 *
 * **All four are twilight moves, not just the Gulf.** Japan, MLS and the
 * Chinese league were reachable from 28, which is a player's peak: being shown
 * them at 28 reads as the game giving up on a career that has not finished
 * happening. 32 is when a move abroad for money or for somewhere to live is the
 * story a real player would tell.
 */
export const SPINOFF_MIN_AGE = 32;

export function spinoffAllowed(context: MarketContext): boolean {
  if (context.player.age >= SPINOFF_MIN_AGE) return true;
  // "Europe is quiet" is not "Europe is shut". It fires whenever fewer than two
  // core clubs are in band, which for a player having an ordinary dip is most
  // windows — and it was putting Shanghai and Seattle in front of
  // twenty-nine-year-olds, which is the whole thing the age gate exists to
  // stop. Only a real dead end, where nobody at all will take him, still opens
  // the door early: a career that cannot continue is worse than one that
  // continues somewhere odd.
  return context.lastResort === true;
}

/** Whether this league can plausibly appear in the player's window. */
export function leagueInMarket(league: League, context: MarketContext): boolean {
  if (league.market === 'spinoff' && !spinoffAllowed(context)) return false;

  const band = bandFor(context);
  // A season on the bench caps the ceiling at roughly where he already is:
  // nobody jumps up a level off the back of fifteen appearances, however
  // able the scouts think he might be.
  if (weakForm(context) && context.currentLeague) {
    band.high = Math.min(band.high, context.currentLeague.strength + 0.06);
  }
  if (context.currentLeague && league.id === context.currentLeague.id) return true;
  return league.strength >= band.low && league.strength <= band.high;
}

/**
 * Domestic interest always outweighs foreign interest, and the gap narrows
 * as the player's profile grows. This is a soft bias, not a gate, and
 * deliberately so: a modest player CAN move abroad, it is simply less likely.
 * Spin-off leagues scout globally by design — their gate is age, not place.
 */
function geographyFactor(league: League, context: MarketContext): number {
  if (league.market === 'spinoff') return 1;
  const current = context.currentLeague;
  if (current && league.id === current.id) return 1.35;
  if (current && league.countryId === current.countryId) return 1.2;
  if (league.countryId === context.player.countryId) return 1.1;
  const overall = context.player.overall;
  if (overall >= 83) return 1;
  if (overall >= 78) return 0.8;
  if (overall >= 73) return 0.55;
  return 0.35;
}

/**
 * Relative likelihood a club comes calling. Peaks at the player's own level and
 * falls away sharply in both directions, so a window reads as a coherent set of
 * clubs rather than a list sampled from the whole world.
 */
/**
 * How much of the football world's attention a league commands.
 *
 * Two clubs of equal reputation are not equally likely to sign someone: a
 * Premier League side is in the market for everybody, a Belgian one is not.
 * Without this the smaller top divisions turned up far more often than they
 * should, because our reputation numbers put their best clubs level with
 * mid-table clubs in the big five.
 */
export function leaguePull(league: League): number {
  switch (league.countryId) {
    case 'eng':
    case 'esp':
    case 'ita':
    case 'ger':
    case 'fra':
      return league.tier === 1 ? 1 : 0.7;
    // A ruling, and the numbers followed it down: these three sit below
    // the big five, and a career that has earned a big-five move should not be
    // reading Eredivisie offers half the time. Halved again from 0.45/0.35.
    case 'por':
    case 'ned':
      return 0.22;
    case 'bel':
      return 0.16;
    default:
      return 1; // spin-off leagues have their own gating
  }
}

/**
 * Which clubs in the smaller European top flights ever come calling.
 *
 * The second ruling on the same three leagues: when Portugal, the
 * Netherlands or Belgium do appear, it is **their title race and their European
 * places** — Benfica, Ajax, Club Brugge — and not a mid-table side. That is how
 * the real market works: a player good enough to be looked at from abroad is
 * being looked at by the club in that country with European football to offer,
 * and by nobody else in it.
 *
 * The big five are untouched. A mid-table Serie A club is a real destination
 * for most careers, which is exactly what makes it a decision.
 */
export function outsideBigFive(league: League): boolean {
  return league.market === 'core' && league.tier === 1 && ['por', 'ned', 'bel'].includes(league.countryId);
}

/**
 * How big a move this is, in one number.
 *
 * Reputation alone is not the stage. A mid-table Premier League club and a
 * good Serie B side can sit within a point or two of each other on reputation
 * and be nothing like the same move, and reading only the club number made the
 * window delete the top-flight offer as the "worse" one. The division is worth
 * about as much as twenty-five points of reputation, which is the same weight
 * the skill harness uses when it asks whether a career climbed.
 */
export function clubStature(club: Club, league: League): number {
  return club.reputation + league.strength * 25;
}

/**
 * One offer as a player reads it: how big the move is, how much football he is
 * promised, and what he is paid.
 */
export interface Bid {
  stature: number;
  role: SquadRole;
  wage: number;
}

/**
 * "This one is better in every way that matters."
 *
 * The rule that keeps a card from being a tap. A window offering Valencia,
 * Getafe and Mallorca on the same squad role with Valencia paying the most is
 * not a decision — and three cards in ten were that card, on the transfer
 * screen, on the loan-return screen and on every event that opened two doors at
 * once. Whatever deals a card, an option that another option beats on all three
 * counts is filler and comes off.
 *
 * Margins rather than bare comparisons, because two offers a hair apart are the
 * same offer to a reader: a couple of points of standing and five per cent of a
 * wage do not make a decision, and a dead option rescued by one of them is
 * still dead.
 */
export function outbids(a: Bid, b: Bid): boolean {
  return (
    a.stature >= b.stature - 2 &&
    roleRank(a.role) >= roleRank(b.role) &&
    a.wage >= b.wage * 0.95 &&
    (a.stature > b.stature + 2 || roleRank(a.role) > roleRank(b.role) || a.wage > b.wage * 1.05)
  );
}

/**
 * May this club come calling at all?
 *
 * The one gate both doors have to share. The transfer window is not the only
 * way a player changes clubs — half the event deck carries an inline move, and
 * those cards resolve their destination from their own pool. Fixing the rule
 * in `marketWeight` alone left a quarter of the Portuguese, Dutch and Belgian
 * offers coming through the side door, from exactly the mid-table clubs the
 * rule exists to remove.
 */
export function clubMayBid(club: Club, league: League, world: World): boolean {
  if (!outsideBigFive(league)) return true;
  const standing = clubStanding(club, league.id, world);
  return standing === 'title' || standing === 'european';
}

/**
 * Which way the ladder points after last season.
 *
 * This is the rule the transfer screen was missing. Offers were a function of
 * ability alone, so a player could win the league, be named its best forward,
 * and open the window to find a smaller club than the one he had just starred
 * for. Reputation steps are the ladder — roughly 14 points from a mid-table
 * side to a title contender — and last season decides which way he moves along
 * it. A bad season inverts it, because that is equally true: the clubs above
 * stop calling and the ones below smell a bargain.
 */
export function standingFactor(club: Club, context: MarketContext): number {
  const current = context.currentClub;
  if (!current || club.id === current.id) return 1;
  const form = formScore(context.form);
  if (Math.abs(form) < 0.05) return 1;
  const step = clamp((club.reputation - current.reputation) / 14, -1.5, 1.5);
  return clamp(1 + step * form * 1.6, 0.2, 2.4);
}

/**
 * Where a club finishes, in words rather than in a reputation number.
 *
 * Two sets, because a division decides what there is to *play for*. A top
 * flight has a title and European qualification above it and relegation below.
 * A second tier has automatic promotion, a play-off place, and relegation —
 * and no European places at all, which is the mistake the first version made:
 * it ran the same four labels over every division, so the fifth-best club in
 * the Championship was advertised as being in "European places". A label that
 * cannot be true of that competition is worse than no label.
 */
export type ClubStanding =
  | 'title'
  | 'european'
  | 'midtable'
  | 'survival'
  | 'promotion'
  | 'playoff';

/**
 * What kind of club this is, said the way a supporter would say it.
 *
 * An offer card prints the division, the wage, the length and the role, and
 * still does not answer the first question anybody asks about a club they do
 * not know: *are they any good?* Real Sociedad and Real Betis are both La Liga
 * and are not the same offer, and a player picking between them off a
 * reputation number he cannot see is guessing.
 *
 * Measured **inside the club's own division**, by quartile, so it means the
 * same thing in the Premier League as in Ligue 2 — "mid-table" is mid-table of
 * where they actually play. Reputation is the world's own ranking and the same
 * number the trophy field is built from, so this cannot disagree with what the
 * season then does.
 *
 * The band names come from the division's tier, because what a club is playing
 * for is a fact about the competition and not about the club. Below the top
 * flight the top two bands are promotion and the play-offs; there is no
 * European place to finish in.
 */
export function clubStanding(club: Club, leagueId: string, world: World): ClubStanding {
  const peers = world.clubs.filter((c) => c.leagueId === leagueId).map((c) => c.reputation);
  const topFlight = (world.leagues.find((l) => l.id === leagueId)?.tier ?? 1) === 1;
  const high: ClubStanding = topFlight ? 'title' : 'promotion';
  const second: ClubStanding = topFlight ? 'european' : 'playoff';
  if (peers.length < 4) return 'midtable';
  const sorted = [...peers].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]!;
  if (club.reputation >= at(0.85)) return high;
  if (club.reputation >= at(0.55)) return second;
  if (club.reputation >= at(0.25)) return 'midtable';
  return 'survival';
}

/**
 * The reputation a club must have to bother bidding, given how last season
 * went. Null when form was ordinary and the whole market is still in play.
 *
 * A weight alone was not enough: there are far more clubs below a good player
 * than above him, so even a heavy tilt left most windows pointing downward. A
 * floor is what makes "I had a great year" read the way it should.
 */
export function suitorFloor(context: MarketContext): number | null {
  const current = context.currentClub;
  if (!current || formScore(context.form) <= 0.2) return null;
  return current.reputation - 6;
}

export function marketWeight(league: League, club: Club, context: MarketContext): number {
  // Portugal, the Netherlands and Belgium bid with their top clubs or not at
  // all — see `outsideBigFive`. Measured inside their own division, so it means
  // the same thing in each of the three.
  if (!clubMayBid(club, league, context.world)) return 0;
  const distance = Math.abs(league.strength - standingLevel(context));
  const fit = Math.exp(-Math.pow(distance / 0.16, 2));
  // Spin-off clubs bid hard when they bid at all — that is their whole pitch.
  const eagerness = league.market === 'spinoff' ? 1.4 : 1;
  // Richer clubs are more active in any window.
  const activity = 0.6 + (club.wealth / 100) * 0.8;
  // An invisible season also mutes whatever interest remains from above.
  const visibility = weakForm(context) && league.strength > (context.currentLeague?.strength ?? 0) ? 0.3 : 1;
  return (
    fit *
      eagerness *
      activity *
      geographyFactor(league, context) *
      visibility *
      standingFactor(club, context) *
      leaguePull(league) *
      100 +
    0.5
  );
}

/**
 * Loan destinations stay inside the core market and inside Europe's pyramid.
 *
 * Sending an eighteen-year-old on loan to the Saudi Pro League is not a
 * development move, and nobody does it. Same-country loans are preferred
 * because that is overwhelmingly how the real loan market works.
 */
export function loanDestinationWeight(
  parentLeague: League,
  destinationLeague: League,
  destinationClub: Club,
  /**
   * Allow a move *within* the parent's own division to a weaker club.
   *
   * Off by default, and on only for a seventeen-year-old's spell at home. The
   * pyramid modelled here bottoms out at tier 2, so a boy at a Championship
   * club has no division below him and — with this off — no domestic
   * destination at all: nine careers in ten hundred reached the loan age
   * eligible and were offered nothing, every one of them at an English
   * second-tier club. Sideways to a weaker side in the same league is both the
   * real answer for those players and the only one this world can give.
   *
   * The club still has to be materially weaker and still has to play him;
   * those gates live in `loanDestinations`.
   */
  allowSameLeague = false,
): number {
  if (destinationLeague.market === 'spinoff') return 0;
  // Never loan a player *up* — the point is minutes he cannot get already.
  if (allowSameLeague
    ? destinationLeague.strength > parentLeague.strength
    : destinationLeague.strength >= parentLeague.strength) return 0;
  // Nor so far down that the football stops teaching him anything.
  if (parentLeague.strength - destinationLeague.strength > 0.62) return 0;

  const sameCountry = destinationLeague.countryId === parentLeague.countryId ? 2.4 : 1;
  // Coaching is what a loan is for.
  return (destinationClub.training + 20) * sameCountry;
}

/** Leagues a player could plausibly move to right now. */
export function eligibleLeagues(world: World, context: MarketContext): League[] {
  return world.leagues.filter((league) => leagueInMarket(league, context));
}
