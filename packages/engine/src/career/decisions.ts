/**
 * Building the club-choice cards: academy offers, transfer windows, renewals
 * and the end of the road.
 *
 * Every offer carries its full financial shape — fee, wage, length, release
 * clause, promised role — because the money is the decision. Taking less at a
 * bigger club, or running a contract down to cash in on a free transfer, only
 * works as a choice if the numbers are on the card.
 */

import {
  WINDOW_SPREAD,
  type Club,
  type Contract,
  type Decision,
  type DecisionOption,
  type League,
  type ManagerStyle,
  type Player,
  type SeasonRecord,
  type Investments,
  type SquadRole,
  type World,
} from '../types.js';
import { float, int, pick, shuffle, weightedPick, type Rng } from '../rng.js';
import {
  FIT_NEAR_BEST,
  isRealisticTarget,
  promisableRole,
  starterBar,
  styleFit,
  withinOfferReach,
} from '../model/role.js';
import { MAX_WAGE, roundMoney, signingBonus, tierCost, transferFee, wageOffer } from '../model/finance.js';
import {
  leagueInMarket,
  marketFormOf,
  clubStature,
  marketWeight,
  outbids,
  standingLevel,
  suitorFloor,
  type Bid,
  type MarketContext,
} from '../model/market.js';

export interface OfferContext {
  player: Player;
  world: World;
  leagueOf: (clubId: string) => League;
  /**
   * The club as *this career* knows it.
   *
   * `world.clubs` is the opening position and a career changes it — managers
   * get sacked, and tactical fit is computed from the manager. Iterating the
   * raw list meant a suitor whose manager had changed priced its offer against
   * the one who left, so the role it promised disagreed with the role the
   * engine would then give him.
   */
  clubOf: (clubId: string) => Club;
  contract: Contract | null;
  /** Clubs the player should not be offered again this window. */
  exclude: readonly string[];
  /** The season just played — form decides who is actually watching. */
  lastSeason: SeasonRecord | null;
  /**
   * Nobody in his band will have him and he is too young to retire. Drop the
   * band and the ability bar: a division below, or a league that pays rather
   * than asks questions, is always somewhere to keep playing.
   */
  lastResort?: boolean;
}

/**
 * What the club will put in the contract: exactly the rung his ability earns
 * there, so the card and the top bar agree the morning after he signs. A player
 * short of a big club's standard is offered a squad place there, not a starting
 * one — however well last season went.
 */
function promisedRoleFor(player: Player, club: Club, league: League, seasonsAtClub = 0): SquadRole {
  return promisableRole(player, club, league, seasonsAtClub);
}

/** How far apart two clubs in one window may sit in reputation. */
export const WINDOW_REPUTATION_SPREAD = 28;

/**
 * How far below his own level the window is still allowed to be centred.
 *
 * A player is not only offered the exact level he has earned — a step down is
 * always available and is often the sensible move. This is the width of that
 * step when he has outgrown his club: the window centres just under what his
 * ability argues for rather than on the division he is currently in.
 */
const OUTGROWN_MARGIN = 0.1;

/**
 * The Gulf pitch, priced.
 *
 * A spin-off league that sells itself on money has to actually pay: its whole
 * function in the game is to be the wage trap, and a trap that quotes less than
 * the player already earns baits nothing. The event card was fixed for this
 * once; the transfer window was quoting Al-Nassr at a quarter of a declining
 * player's current wage on a squad role, which is not a decision — it is an
 * offer nobody would read twice.
 *
 * The floor applies only where `wageIndex` says the league outbids Europe, so
 * Japan, MLS and today's Chinese league are untouched: those are the twilight
 * move, where taking less to go and live somewhere is the honest story.
 */
const MONEY_LEAGUE_INDEX = 1.5;
const MONEY_LEAGUE_PREMIUM = 1.6;

function moneyLeagueWage(wage: number, league: League, currentWage: number): number {
  if (league.market !== 'spinoff' || (league.wageIndex ?? 1) < MONEY_LEAGUE_INDEX) return wage;
  if (currentWage <= 0) return wage;
  return roundMoney(Math.min(Math.max(wage, currentWage * MONEY_LEAGUE_PREMIUM), MAX_WAGE));
}

/**
 * How long a club will tie itself to a player of this age.
 *
 * Length is the player's main lever on transfer fees — a deal running down is
 * worth less to the selling club and more to him — so it has to read like real
 * contract-writing, not a die roll. Clubs stop offering long deals well before
 * a career ends: a five-year contract at 31 would run to 36, and nobody signs
 * that.
 *
 * These were all a year or two short, and the cost was not the lengths — it was
 * that **82% of every transfer window a career saw was the contract running
 * out**. Six expiry cards against one ordinary window. Longer deals put the
 * transfer window back where it belongs: a choice you make because someone came
 * for you, not a deadline the calendar handed you.
 *
 * The back half needed it most: over half of every expiry card a career saw
 * landed after 30, because a run of one- and two-year deals means the contract
 * runs out again almost every time the player looks up. Thirty-somethings sign
 * shorter than twenty-somethings — that part is right — but three years at 30
 * and two at 33 is what the game actually offers, and it turns four deadlines
 * into two.
 */
/**
 * The most a contract can have left and still be worth running down.
 *
 * One: the final year. See `canRunDown`.
 */
const RUN_DOWN_MAX_YEARS_LEFT = 1;

/**
 * Years left on a deal for a club to open renewal talks.
 *
 * Two. A club does not offer a five-year extension to a player with three
 * years still to run, and this project's own design compass says so —
 * "contracts that renew only near expiry". Exported because `machine.ts`
 * decides whether to build the offer at all, and the two must not drift.
 */
export const RENEWAL_MAX_YEARS_LEFT = 2;

export function contractYearsFor(rng: Rng, age: number): number {
  if (age >= 36) return 1;
  if (age >= 33) return 2;
  if (age >= 30) return 3;
  return age >= 28 ? int(rng, 3, 4) : int(rng, 4, 5);
}

function buildOffer(
  rng: Rng,
  context: OfferContext,
  club: Club,
  league: League,
  isFreeTransfer: boolean,
): DecisionOption['offer'] {
  const role = promisedRoleFor(context.player, club, league);
  const wage = moneyLeagueWage(
    wageOffer(rng, context.player, club, league, role),
    league,
    context.contract?.wage ?? 0,
  );
  const fee = isFreeTransfer
    ? 0
    : transferFee(
        rng,
        context.player,
        context.contract?.yearsRemaining ?? 0,
        club,
        'normal',
        context.contract?.releaseClause ?? null,
      );
  // A move nobody paid a fee for is a free transfer, whether he arrived at the
  // window already out of contract or ran the last year down to get here. This
  // used to key off the caller's flag alone, so a player who let his deal
  // expire — the entire point of that route — collected the *paid-transfer*
  // signing bonus, a quarter of what he had earned. The money the buying club
  // did not spend on a fee is the money he captures; if it does not reach him,
  // running a contract down is a strictly worse move with better copy.
  const free = fee === 0;
  const years = contractYearsFor(rng, context.player.age);
  // Richer clubs insist on a clause; it is the price of the bigger wage.
  const releaseClause =
    club.wealth > 70 && rng() < 0.5
      ? Math.round(context.player.marketValue * float(rng, 1.5, 3.2))
      : null;

  return {
    wage,
    years,
    fee,
    signingBonus: signingBonus(wage, fee, free),
    releaseClause,
    promisedRole: role,
  };
}

/**
 * Which clubs would plausibly come in for this player.
 *
 * Filtered by market band first, so every option in a window belongs to roughly
 * the same football world, then weighted within it. Spin-off leagues are capped
 * at one per window: the Saudi offer is a decision, three of them is a theme
 * park.
 */
function candidateClubs(
  rng: Rng,
  context: OfferContext,
  count: number,
  /**
   * The club the window has to read as coherent with, when there is one.
   *
   * Set to his current club whenever staying is on the table. "Renew here, or
   * join one of these two" is only a decision if all three are recognisably the
   * same level of football — otherwise the card puts a Premier League renewal
   * beside two Ligue 2 offers and the player is not choosing, he is being told.
   * When nobody wants to keep him there is no anchor, and there should not be:
   * a player being let go is genuinely on a different ladder from the one he
   * was on last week.
   */
  anchor: Club | null,
  /**
   * How many clubs to draw, when the caller needs spares.
   *
   * `count` is how many the card has room for, and is what the suitor floor is
   * measured against; `draw` is how many actually come back. They differ
   * because `buildTransferDecision` discards an offer that loses to the
   * renewal on every axis, and with exactly as many clubs as slots a discarded
   * one left a hole nothing filled — a transfer window whose only button was
   * *stay*. Spares are held to the same coherence spans as the rest, so any
   * subset of them still reads as one football world.
   */
  draw: number = count,
  /**
   * For a second draw into a card that already has clubs on it.
   *
   * `alongside` seeds the coherence spans with the clubs staying on the card,
   * so whatever is drawn reads as the same football world as them and not only
   * as the anchor's. `onlyIf` narrows the clubs that may be drawn at all.
   */
  also: { alongside?: readonly Club[]; onlyIf?: (club: Club) => boolean } = {},
): Club[] {
  const excluded = new Set(context.exclude);
  // Always through `leagueOf`, never through `club.leagueId`: the club record
  // carries the division it started the world in, and a career that has seen
  // promotions and relegations has moved several of them since. Reading the raw
  // field here meant the window still weighed a promoted club as second-tier
  // and then offered it beside a top-flight one — coherent by the stale
  // numbers, absurd on the card.
  const currentLeague = context.contract ? context.leagueOf(context.contract.clubId) : null;
  const currentClub = context.contract
    ? (context.world.clubs.find((c) => c.id === context.contract!.clubId) ?? null)
    : null;

  // Last season is what decides which way the ladder points: a good one brings
  // the clubs above down to look, a poor one brings the clubs below up.
  const form = marketFormOf(context.lastSeason);

  // Deliberately enormous: at this point the question is not whether a club
  // rates him, it is whether anyone will register him at all. Being frozen out
  // in a lower division is a worse career, and a career is what he keeps.
  const tolerance = context.lastResort ? 40 : undefined;
  const inBand = (europeQuiet: boolean): { club: Club; league: (typeof context.world.leagues)[number] }[] => {
    const market: MarketContext = {
      player: context.player,
      world: context.world,
      currentLeague,
      currentClub,
      europeQuiet,
      lastResort: context.lastResort === true,
      form,
    };
    return (
      context.world.clubs
        .filter((club) => !excluded.has(club.id))
        .map((club) => ({ club: context.clubOf(club.id), league: context.leagueOf(club.id) }))
        // Both tests run on the career's own view of the club, never the world's
        // opening one: the squad standard depends on the division the club is in
        // *now*, and a career moves clubs between divisions.
        .filter(
          (entry) =>
            entry.league !== undefined &&
            isRealisticTarget(context.player, entry.club, entry.league, tolerance) &&
            // The mirror of the floor: a club so far below his ability that it
            // would never sign him is not a suitor, whatever last season looked
            // like. A benched star still has a star's ability, and only clubs
            // near that level bid. (Weak players in a last resort clear this by
            // construction — nothing in the world is far below them.)
            withinOfferReach(context.player, entry.club, entry.league) &&
            // A last resort is not fussy about which league it is: what it needs
            // is a squad that will register him.
            (context.lastResort || leagueInMarket(entry.league, market)),
        )
    );
  };

  // First pass with Europe assumed healthy; if that produces almost nothing,
  // the player's options really have dried up and the spin-off door opens.
  let pool = inBand(false);
  const europeQuiet = context.lastResort || pool.filter((entry) => entry.league.market === 'core').length < 2;
  if (europeQuiet) pool = inBand(true);
  // A last resort drops the band, but not the rule that the Gulf is not a
  // twenty-one-year-old's next step. Europe first; the spin-off leagues only
  // when there is genuinely nothing else left in it.
  if (context.lastResort) {
    const core = pool.filter((entry) => entry.league.market === 'core');
    if (core.length > 0) pool = core;
    // And it looks *downward*. Dropping the ability bar to 40 opens the band in
    // both directions at once, which put a 43-rated teenager in front of Osasuna
    // and Girona — the two clubs in Spain least likely to take his call. What a
    // last resort promises is a division below, so it has to offer one.
    //
    // Relative to the pool rather than to him, because a player can be below
    // every squad standard in the game: the lowest bar is 58 and careers do go
    // under it. An absolute test would find nothing and fall back to the whole
    // world — which is how this went wrong the first time.
    const lowestBar = Math.min(...pool.map((entry) => starterBar(entry.club, entry.league)));
    const reachable = pool.filter(
      (entry) => starterBar(entry.club, entry.league) <= Math.max(lowestBar, context.player.overall) + 4,
    );
    if (reachable.length > 0) pool = reachable;
  }
  if (pool.length === 0) {
    if (!context.lastResort) return [];
    /*
     * The register-him-somewhere rule. A last resort that can still come back
     * empty is not a last resort, and it did: an 82-rated thirty-four-year-old
     * was forcibly retired by a window nobody attended, which does not happen
     * to 82-rated thirty-four-year-olds anywhere football is played. When
     * every band, reach and market filter has produced nothing, one club that
     * his ability would not embarrass takes him on whatever terms — a career
     * gets worse before it stops.
     */
    const anyone = context.world.clubs
      .filter((club) => !excluded.has(club.id))
      .map((club) => ({ club: context.clubOf(club.id), league: context.leagueOf(club.id) }))
      .filter(
        (entry) =>
          entry.league !== undefined && isRealisticTarget(context.player, entry.club, entry.league, 60),
      );
    const one = weightedPick(rng, anyone, (entry) => 1 + entry.club.reputation);
    return one ? [one.club] : [];
  }

  const market: MarketContext = {
    player: context.player,
    world: context.world,
    currentLeague,
    currentClub,
    europeQuiet,
    lastResort: context.lastResort === true,
    form,
  };

  // After a season worth talking about, the clubs well below him stop bidding.
  // Applied here rather than inside the band so it can never be what makes
  // Europe look quiet and opens the spin-off door by accident.
  //
  // The floor *relaxes* rather than yielding. It used to be all-or-nothing —
  // if the raised pool could not fill the window the floor was dropped
  // altogether — and dropping it does not return the window to "one small step
  // down", it returns it to the entire band, twenty reputation points and all.
  // That is how a player came off a season that made his name and was shown a
  // club two divisions below the one he had just starred for. Stepping the
  // floor down keeps the good season worth something even when the shortlist
  // above him is thin.
  const floor = suitorFloor(market);
  if (floor !== null) {
    const wanted = Math.max(2, count);
    for (const give of [0, 6, 12]) {
      const raised = pool.filter((entry) => entry.club.reputation >= floor - give);
      if (raised.length >= wanted) {
        pool = raised;
        break;
      }
    }
  }

  const picked: Club[] = [];
  const taken = new Set<string>();
  let spinoffs = 0;
  /**
   * How far apart the leagues in one window may be — measured across the whole
   * window, not against whichever club happened to be drawn first.
   *
   * Holding each new suitor to the *first* one is not the same rule and does
   * not produce it: with a first pick at 0.62, both 0.41 and 0.70 are inside
   * the band, and the window ends up offering the Belgian top flight, the
   * Eredivisie and the Spanish second division together — 0.29 apart, which is
   * exactly the incoherence this exists to stop. Tracking the running span
   * closes it. See `WINDOW_SPREAD`; the event cards that carry a move use it
   * too.
   */
  let low: number | null = null;
  let high: number | null = null;
  /**
   * The same span rule on club standing, because the league is only half of it.
   * Napoli and Cremonese are both Serie A, and a window offering the two
   * together is exactly as incoherent as one that crosses divisions — it says
   * nobody has really decided what this player is. A giant beside a solid
   * mid-table club is fine and is the decision the window exists to pose; a
   * giant beside a minnow is not.
   */
  let repLow: number | null = null;
  let repHigh: number | null = null;

  /*
   * Seed both spans from the club he is being asked to stay at — **unless he
   * has outgrown it**, in which case the window is about where he is going.
   *
   * Anchoring on the current club keeps "stay" comparable with the offers, and
   * that is right for a player who is where he belongs. It is badly wrong for
   * one who is not: an 82-rated twenty-two-year-old at a mid-table
   * Championship club had his window seeded at Championship strength (0.48),
   * so a spread of 0.22 put the *ceiling* at 0.70 — the Eredivisie — and every
   * big-five top flight was arithmetically unreachable. A playthrough of
   * exactly that career got Twente and AZ.
   *
   * `standingLevel` is what his ability and last season argue for. When it is
   * clearly above the division he is in, that is the level the market is
   * talking about, and the club he is leaving becomes the outlier — which is
   * the honest reading of a Championship star with Premier League clubs
   * calling. "Stay" is still on the card; it is simply no longer the thing
   * every other option has to look like.
   */
  if (anchor) {
    const anchorLeague = context.leagueOf(anchor.id);
    if (anchorLeague && anchorLeague.market !== 'spinoff') {
      const outgrown = Math.max(anchorLeague.strength, standingLevel(market) - OUTGROWN_MARGIN);
      low = outgrown;
      high = outgrown;
      repLow = anchor.reputation;
      repHigh = anchor.reputation;
    }
  }

  for (const club of also.alongside ?? []) {
    taken.add(club.id);
    const league = context.leagueOf(club.id);
    if (league.market === 'spinoff') {
      spinoffs += 1;
      continue;
    }
    low = low === null ? league.strength : Math.min(low, league.strength);
    high = high === null ? league.strength : Math.max(high, league.strength);
    repLow = repLow === null ? club.reputation : Math.min(repLow, club.reputation);
    repHigh = repHigh === null ? club.reputation : Math.max(repHigh, club.reputation);
  }

  for (let i = 0; i < draw * 8 && picked.length < draw; i += 1) {
    const available = pool.filter((entry) => {
      if (taken.has(entry.club.id)) return false;
      if (also.onlyIf && !also.onlyIf(entry.club)) return false;
      if (entry.league.market === 'spinoff') return spinoffs < 1;
      if (low === null || high === null || repLow === null || repHigh === null) return true;
      const strength = entry.league.strength;
      if (Math.max(high, strength) - Math.min(low, strength) > WINDOW_SPREAD) return false;
      const rep = entry.club.reputation;
      return Math.max(repHigh, rep) - Math.min(repLow, rep) <= WINDOW_REPUTATION_SPREAD;
    });
    const entry = weightedPick(rng, available, (candidate) =>
      marketWeight(candidate.league, candidate.club, market),
    );
    if (!entry) break;
    taken.add(entry.club.id);
    if (entry.league.market === 'spinoff') spinoffs += 1;
    else {
      const strength = entry.league.strength;
      low = low === null ? strength : Math.min(low, strength);
      high = high === null ? strength : Math.max(high, strength);
      const rep = entry.club.reputation;
      repLow = repLow === null ? rep : Math.min(repLow, rep);
      repHigh = repHigh === null ? rep : Math.max(repHigh, rep);
    }
    picked.push(entry.club);
  }
  return picked;
}

/** The opening card: three academies, differing in prestige and coaching. */
export function buildAcademyDecision(rng: Rng, world: World, player: Player): Decision {
  // Academies come from the modest end of the core market, and lean toward the
  // player's own country — a sixteen-year-old is scouted where he lives. The
  // trade-off on offer is prestige against coaching quality.
  const leagueById = new Map(world.leagues.map((l) => [l.id, l]));
  const pool = world.clubs.filter((club) => {
    const league = leagueById.get(club.leagueId);
    return league !== undefined && league.market === 'core' && club.reputation <= 68;
  });

  const home = pool.filter((club) => leagueById.get(club.leagueId)!.countryId === player.countryId);
  // Players from countries with no clubs in the database go abroad young, which
  // is also what happens.
  const shuffled = shuffle(rng, home.length >= 3 ? home : pool);

  const chosen: Club[] = [];
  const leaguesUsed = new Set<string>();
  for (const club of shuffled) {
    if (chosen.length >= 3) break;
    if (leaguesUsed.has(club.leagueId) && chosen.length < 2) continue;
    leaguesUsed.add(club.leagueId);
    chosen.push(club);
  }
  while (chosen.length < 3 && shuffled.length > chosen.length) {
    const extra = shuffled[chosen.length];
    if (extra) chosen.push(extra);
  }

  return {
    id: 'academy',
    kind: 'academy',
    titleKey: 'decisions.academy.title',
    bodyKey: 'decisions.academy.body',
    options: chosen.map((club) => ({
      id: `academy:${club.id}`,
      labelKey: 'decisions.academy.join',
      params: { club: club.id },
      clubId: club.id,
      outcomes: [],
    })),
  };
}

export interface TransferDecisionInput {
  rng: Rng;
  context: OfferContext;
  currentClub: Club | null;
  currentLeague: League | null;
  /** True when staying is not an option (contract expired or forced out). */
  mustMove: boolean;
  /** Renewal terms from the current club, when they want to keep him. */
  renewal: DecisionOption['offer'] | null;
  /**
   * Staying is on the table without a new contract behind it.
   *
   * Set when the club wants him and his deal is nowhere near expiry, so there
   * is nothing to re-sign. Without it a mid-contract window has no way to say
   * "stay", and a player three years into a five-year deal is forced out.
   */
  canStayOnCurrentDeal?: boolean;
  /** Offer a walk-away option alongside the contracts; set for veterans. */
  allowRetire?: boolean;
}

/**
 * A card is three options, never more.
 *
 * Three is what a phone shows without pushing the career table off the
 * screen — two clubs and the option to stay. Because "run the contract down"
 * and "retire" are real choices, they take a slot rather than being cut off the
 * end — the number of clubs offered flexes to make room.
 *
 * Exported because the same budget governs event cards that carry a club move
 * (`startEvent`) and the panel that renders them; three separate 3s would
 * drift apart.
 */
export const CARD_SLOTS = 3;

/**
 * Choose `n` suitors from a set so the card reads as `n` *different* decisions.
 *
 * Taking the first `n`, or the `n` biggest clubs, gives a window that is the
 * same choice made twice — three title-race sides at similar wages is not a
 * decision, it is a list. So the pick is spread: the biggest club by stature,
 * then the best-paid one (so "the bigger stage" and "the bigger cheque" are
 * both on the card), then the next-biggest by stature to fill any third slot.
 *
 * Deterministic — sorts with a club-id tiebreak, no RNG — so a replay of the
 * same career deals the identical window, which the leaderboard's anti-cheat
 * requires.
 */
function selectSpread<T extends { suitor: DecisionOption; bid: Bid }>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  const id = (item: T) => item.suitor.clubId ?? '';
  const byStature = [...items].sort(
    (a, b) => b.bid.stature - a.bid.stature || b.bid.wage - a.bid.wage || id(a).localeCompare(id(b)),
  );
  const byWage = [...items].sort(
    (a, b) => b.bid.wage - a.bid.wage || b.bid.stature - a.bid.stature || id(a).localeCompare(id(b)),
  );
  const picked: T[] = [byStature[0]!];
  for (const item of byWage) {
    if (picked.length >= n) break;
    if (!picked.includes(item)) {
      picked.push(item);
      break;
    }
  }
  for (const item of byStature) {
    if (picked.length >= n) break;
    if (!picked.includes(item)) picked.push(item);
  }
  return picked;
}

/**
 * The systems that count as suiting this player, as a test on a club.
 *
 * His best system and anything within `FIT_NEAR_BEST` of it — and then, if
 * too few clubs play those, the next best in turn until at least 48 do, a
 * quarter of the world. Measured, not assumed: seventeen clubs play wing play,
 * which is a winger's best system nearly every time, and with only those
 * counting one window in forty had no suitable club inside its coherence spans
 * at all — and "seventeen clubs in the world suit a winger" is not football
 * either. With the floor a winger's suitable systems are wing play and the
 * counter-attack, fifty-eight clubs. The promise is "a system near his best
 * that clubs at his level actually play", which is the read a player can make.
 *
 * Measured against the systems clubs play, not every system the engine knows
 * (no club plays a free role), and read through `clubOf`, because managers
 * change and take their systems with them.
 */
const MIN_SUITABLE_CLUBS = 48;

/** The systems clubs play, best fit for this player first, with how many play each. */
function rankStyles(player: Player, clubStyles: readonly ManagerStyle[]) {
  const clubsPlaying = new Map<ManagerStyle, number>();
  for (const style of clubStyles) clubsPlaying.set(style, (clubsPlaying.get(style) ?? 0) + 1);
  return [...clubsPlaying.entries()]
    .map(([style, clubs]) => ({ style, clubs, fit: styleFit(player, style) }))
    .sort((a, b) => b.fit - a.fit || a.style.localeCompare(b.style));
}

export function suitableStyles(player: Player, clubStyles: readonly ManagerStyle[]): Set<ManagerStyle> {
  const ranked = rankStyles(player, clubStyles);
  const best = ranked[0]?.fit ?? 1;
  const suitable = new Set<ManagerStyle>();
  let clubs = 0;
  for (const entry of ranked) {
    if (entry.fit < best - FIT_NEAR_BEST && clubs >= MIN_SUITABLE_CLUBS) break;
    suitable.add(entry.style);
    clubs += entry.clubs;
  }
  return suitable;
}

/**
 * The suitable systems for this player, and then the next best one at a time.
 *
 * The first entry is `suitableStyles`. The rest exist for the rare window —
 * about one in seven hundred, all at the very top — where no club inside the
 * window's coherence spans plays any of those: there the promise becomes the
 * best system that clubs at his level do play, rather than a club from another
 * level dropped into the card to keep it.
 */
function suitableTiers(context: OfferContext): Set<ManagerStyle>[] {
  const clubStyles = context.world.clubs.map((club) => context.clubOf(club.id).managerStyle);
  const tiers = [suitableStyles(context.player, clubStyles)];
  for (const { style } of rankStyles(context.player, clubStyles)) {
    const last = tiers[tiers.length - 1]!;
    if (!last.has(style)) tiers.push(new Set([...last, style]));
  }
  return tiers;
}

export function buildTransferDecision(input: TransferDecisionInput): Decision {
  const { rng, context, currentClub } = input;
  const options: DecisionOption[] = [];

  /**
   * "Your contract has expired" is news about the club, not about the calendar.
   *
   * It used to key off the years reaching zero and nothing else, so a player
   * whose club had terms waiting for him was still told he was a free agent —
   * the headline said his time there was over while the first option on the
   * card was a new deal from the same club. A club that wants to keep somebody
   * renews him; the card only reads as expiry when nobody has put anything in
   * front of him, which is exactly the case the free transfer exists for.
   *
   * The run-down route lands here by construction rather than by a second
   * check: choosing it *is* choosing to take no new terms.
   */
  const isFree = (context.contract?.yearsRemaining ?? 0) <= 0 && input.renewal === null;

  const canRetire = input.allowRetire === true;
  // Running a deal down is a young man's play for a bigger signing bonus; a
  // veteran being asked whether to retire has no use for it, and dropping it
  // is what keeps the window at three cards.
  /**
   * Running the deal down is a **last-year** decision, not an any-time one.
   *
   * `applyTransfer` sets the contract to one year whatever was on it, so
   * offering this mid-deal meant a player who had just signed for five years
   * could tear up four of them from a card that said only "leave for nothing
   * next summer" — the upside without the cost. Since contracts got longer,
   * that was most of them.
   *
   * Gated to the final year, the card is honest without needing a paragraph:
   * the deal was ending anyway, this is the choice not to renew it, and the
   * next window is a free transfer.
   */
  const canRunDown =
    !input.mustMove &&
    !canRetire &&
    currentClub !== null &&
    (context.contract?.yearsRemaining ?? 0) > 0 &&
    (context.contract?.yearsRemaining ?? 0) <= RUN_DOWN_MAX_YEARS_LEFT;

  /**
   * One way of saying "I am staying", chosen from the three that mean it.
   *
   * The machine says whether he *may* stay — he is under contract and no card
   * has forced him out. Which button that becomes is decided here, and only one
   * of them may be on the card at a time: signing the renewal, running the last
   * year down for a free transfer, or simply carrying on under the deal he
   * already has. Printing "stay on your current deal" beside "run it down"
   * would put the same answer on the card twice and cost a suitor the slot.
   */
  const canStay =
    !input.mustMove &&
    currentClub !== null &&
    (input.renewal !== null || (input.canStayOnCurrentDeal === true && !canRunDown));

  // Everything that is not a club offer books its slot first; whatever is left
  // is how many clubs come calling, and there is always at least one.
  const reserved = (canStay ? 1 : 0) + (canRunDown ? 1 : 0) + (canRetire ? 1 : 0);
  const offerCount = Math.max(1, CARD_SLOTS - reserved);
  /**
   * Two spare suitors, because the test below throws offers away.
   *
   * A window drew exactly as many clubs as it had slots and then dropped the
   * ones that lost to the renewal on every axis — so when both drawn clubs were
   * worse, the "transfer window" came back with a single button saying *stay*.
   * One career in six hit it. Drawing spares means the rule that keeps filler
   * off the card no longer takes the card down with it.
   */
  /**
   * A last resort has no anchor, by definition.
   *
   * The anchor holds every suitor to the level of the club he is at, which is
   * what stops a Premier League renewal being printed beside a Ligue 2 offer.
   * On the second look — when the first found nobody at all — that same rule
   * searches the one place already known to be empty, and the window came back
   * with a single button on it for a thirty-one-year-old whose division had
   * finished with him. What a last resort offers is a step down; measuring the
   * step against the rung he is leaving defeats it. The clubs drawn are still
   * held to the spans *against each other*, so the card still reads as one
   * football world — just not as his old one.
   */
  const anchor = canStay && context.lastResort !== true ? currentClub : null;
  // Draw generously — the window keeps the best spread it can, not the first
  // clubs that come back, so it needs choices to spread across. See `selectSpread`.
  const clubs = candidateClubs(rng, context, offerCount, anchor, offerCount + 6);

  /** Everything the card shows about a deal, as the shared market rule reads it. */
  const bidOf = (clubId: string, offer: NonNullable<DecisionOption['offer']>): Bid => ({
    stature: clubStature(context.clubOf(clubId), context.leagueOf(clubId)),
    role: offer.promisedRole,
    wage: offer.wage,
  });

  const drawn = clubs
    .map((club) => ({ club, offer: buildOffer(rng, context, club, context.leagueOf(club.id), isFree) }))
    .filter((entry): entry is { club: Club; offer: NonNullable<DecisionOption['offer']> } => entry.offer !== undefined);
  /**
   * The deal already in front of him, as one more bid to be beaten.
   *
   * Only a renewal counts. Staying on an existing contract is not a competing
   * offer — it is the absence of one — and treating it as a bid would delete
   * every suitor who could not beat terms he signed three years ago.
   */
  const baseline = input.renewal && currentClub ? bidOf(currentClub.id, input.renewal) : null;
  const bids = drawn.map((entry) => bidOf(entry.club.id, entry.offer));
  const makeSuitor = (entry: (typeof drawn)[number]): DecisionOption => ({
    id: `transfer:${entry.club.id}`,
    labelKey: 'decisions.transfer.join',
    params: { club: entry.club.id },
    clubId: entry.club.id,
    offer: entry.offer,
    outcomes: [],
  });

  /**
   * A window is three genuinely different decisions — or as many as the market
   * honestly supports. Two rules run together here, and they
   * used to fight:
   *
   *  - **No dead buttons.** An offer another offer beats on stature, role *and*
   *    wage is filler; the card must never make one option the obvious answer
   *    by surrounding it with worse copies of itself.
   *  - **Three choices.** Transfer and loan windows deal three, not two — a
   *    two-option window was reported more than once, with a screenshot.
   *
   * The old code honoured the first and gave up on the second: it capped the
   * card at one suitor unless a move was forced, so a wanted player saw *stay*
   * and one club and nothing else. The fix keeps both. The non-dominated
   * frontier is filled first, spread across it so "the bigger club" and "the
   * one paying most" are both on the card rather than two near-identical sides;
   * then, only if the frontier fell short, the card is topped up from the
   * clubs it passed over — but never with one that something already on the
   * card outclasses on every axis. Where the market has three real choices the
   * card has three; where it has two, it has two, and the "stay" option keeps
   * even that a decision rather than a single tap.
   */
  const onCard: Bid[] = baseline ? [baseline] : [];
  const frontier: { suitor: DecisionOption; bid: Bid }[] = [];
  const passedOver: { suitor: DecisionOption; bid: Bid }[] = [];
  drawn.forEach((entry, i) => {
    const item = { suitor: makeSuitor(entry), bid: bids[i]! };
    const beaten =
      (baseline !== null && outbids(baseline, bids[i]!)) ||
      bids.some((other, j) => j !== i && outbids(other, bids[i]!));
    (beaten ? passedOver : frontier).push(item);
  });

  for (const item of selectSpread(frontier, offerCount)) {
    onCard.push(item.bid);
    options.push(item.suitor);
  }
  if (options.length < offerCount) {
    for (const item of passedOver) {
      if (options.length >= offerCount) break;
      if (onCard.some((b) => outbids(b, item.bid))) continue;
      onCard.push(item.bid);
      options.push(item.suitor);
    }
  }

  /**
   * The floor: a window is a decision or it is not dealt.
   *
   * The two rules above prefer a card free of dead buttons, but the suite (and
   * the machine) hold a harder line — a window must always have somewhere to
   * go, and it must never be a single button. So when the market could not fill
   * the card cleanly, it is filled anyway from the clubs passed over: with a
   * "stay" or a "run it down" already on the card one club to join is enough,
   * and a forced move needs two. One lesser club beside a renewal is a step
   * down he can decline — the objection was to *several* worse
   * clubs making the renewal the only answer, not the existence of one.
   */
  // Fill the card. With a stay or a run-down already on it the window used to
  // settle for a single suitor — so a manager-change window came up as just
  // "renew" beside one club, a two-button card where every other end-of-season
  // decision has three. The floor is now the number of club slots the card was
  // built for (`offerCount`): renew + two offers, or renew + one offer + retire,
  // either way three real choices. A forced move (no stay, no run-down) still
  // needs two suitors to be a decision at all.
  const suitorFloor = canStay || canRunDown ? offerCount : 2;
  if (options.length < suitorFloor) {
    const already = new Set(options.map((o) => o.clubId));
    const fallback = selectSpread(
      passedOver.filter((p) => !already.has(p.suitor.clubId)),
      suitorFloor,
    );
    for (const item of fallback) {
      if (options.length >= suitorFloor) break;
      options.push(item.suitor);
    }
  }

  /**
   * One club on the card plays a system that suits him — and the card does not
   * say which (a rule since 2026-09-23).
   *
   * Reading a manager's style against your own game is the player's call, not
   * the screen's: the style is printed on every offer and How to Play says what
   * each one asks for. What the game owes him in return is that the read can
   * pay off — a window where every club would play him out of position is not
   * a choice, it is a tax. So when neither staying nor any offer suits him,
   * one offer is swapped for a club that does, matched to it in level: first
   * from the clubs this window already drew, which are coherent with the rest
   * by construction, and otherwise by one more draw held to the same spans as
   * the clubs staying on the card. The dominance rules above are not re-applied to it on purpose —
   * fit is the axis they cannot see, and a club that is smaller or pays less
   * but plays his game is exactly the trade the card should pose.
   */
  for (const styles of suitableTiers(context)) {
    const suits = (club: Club) => styles.has(club.managerStyle);
    const suitsOption = (option: DecisionOption) =>
      option.clubId !== undefined && suits(context.clubOf(option.clubId));
    if (options.length === 0) break;
    if (canStay && currentClub !== null && suits(context.clubOf(currentClub.id))) break;
    if (options.some(suitsOption)) break;

    const onCard = new Set(options.map((option) => option.clubId));
    const full = options.length >= offerCount;
    const slots = full ? [...options.keys()].reverse() : [options.length];
    /**
     * Swap like for like. The card was chosen as the biggest club and the best
     * payer, so the clubs it passed over are mostly smaller: taking the biggest
     * of them lowered the swapped slot by four reputation points on average.
     * So the candidates are the suitable clubs this window already drew plus a
     * fresh draw for each slot — held to the spans of the clubs that would stay
     * beside it — and the pair chosen is the one nearest in level: reputation,
     * and league strength at a point per 0.01. That keeps the window at the
     * level the market set, which is the condition on this rule. An
     * empty slot has nothing to match, so it takes the biggest.
     */
    const distance = (a: Club, b: Club) =>
      Math.abs(a.reputation - b.reputation) +
      100 * Math.abs(context.leagueOf(a.id).strength - context.leagueOf(b.id).strength);
    const drawnIds = drawn.map((entry) => entry.club.id);
    const choices: { slot: number; club: Club; suitor: DecisionOption | null; d: number }[] = [];
    for (const slot of slots) {
      const leaving = slot < options.length ? context.clubOf(options[slot]!.clubId!) : null;
      const score = (club: Club) => (leaving ? distance(club, leaving) : -club.reputation);
      for (const item of [...frontier, ...passedOver]) {
        if (onCard.has(item.suitor.clubId) || !suitsOption(item.suitor)) continue;
        const club = context.clubOf(item.suitor.clubId!);
        choices.push({ slot, club, suitor: item.suitor, d: score(club) });
      }
      const staying = options.filter((_, i) => i !== slot).map((option) => context.clubOf(option.clubId!));
      const fresh = candidateClubs(
        rng,
        { ...context, exclude: [...context.exclude, ...drawnIds] },
        1,
        anchor,
        6,
        { alongside: staying, onlyIf: suits },
      );
      for (const club of fresh) choices.push({ slot, club, suitor: null, d: score(club) });
    }
    choices.sort((a, b) => a.d - b.d || b.slot - a.slot || a.club.id.localeCompare(b.club.id));
    let replacement: DecisionOption | null = null;
    let at = slots[0]!;
    for (const choice of choices) {
      let suitor = choice.suitor;
      if (!suitor) {
        const offer = buildOffer(rng, context, choice.club, context.leagueOf(choice.club.id), isFree);
        if (!offer) continue;
        suitor = makeSuitor({ club: choice.club, offer });
      }
      replacement = suitor;
      at = choice.slot;
      break;
    }
    if (replacement) {
      if (at < options.length) options[at] = replacement;
      else options.push(replacement);
      break;
    }
  }

  if (canStay && currentClub) {
    options.unshift(
      input.renewal
        ? {
            id: `stay:${currentClub.id}`,
            labelKey: 'decisions.transfer.stay',
            params: { club: currentClub.id },
            clubId: currentClub.id,
            offer: input.renewal,
            outcomes: [],
          }
        : {
            // No offer: there is nothing to sign, and printing terms the engine
            // would not apply is the exact fault this card has been fixed for
            // twice. The line says what actually happens — the existing deal
            // runs on.
            id: `stay:${currentClub.id}`,
            labelKey: 'decisions.transfer.stay_on_deal',
            params: { club: currentClub.id },
            clubId: currentClub.id,
            outcomes: [{ labelKey: 'decisions.transfer.stay_on_deal_hint', tone: 'neutral' }],
          },
    );
  }

  // Running the contract down: no new deal now, a free transfer and a much
  // larger signing bonus next summer. The Wealth route's signature move.
  if (canRunDown && currentClub) {
    options.push({
      id: `runout:${currentClub.id}`,
      labelKey: 'decisions.transfer.run_down',
      params: { club: currentClub.id },
      clubId: currentClub.id,
      outcomes: [
        { labelKey: 'decisions.transfer.run_down_hint', tone: 'neutral' },
      ],
    });
  }

  // With nowhere to go but a club still happy to hold his registration, life
  // simply continues. When he *must* move the fallback is deliberately absent:
  // an empty option list is how the machine learns the career is over.
  if (options.length === 0 && !input.mustMove && currentClub) {
    options.push({
      id: `stay:${currentClub.id}`,
      labelKey: 'decisions.transfer.stay',
      params: { club: currentClub.id },
      clubId: currentClub.id,
      outcomes: [],
    });
  }

  // A veteran can always choose to walk away on his own terms.
  if (canRetire && options.length > 0) {
    options.push({
      id: 'retire:now',
      labelKey: 'decisions.transfer.retire',
      outcomes: [{ labelKey: 'decisions.transfer.retire_hint', tone: 'neutral' }],
    });
  }

  // Whether his own club has put a contract on the table is the first thing a
  // player would want to know, and the card said it nowhere: the same words
  // appeared whether the club was fighting to keep him or had quietly decided
  // not to renew. The option list showed it — a "stay" card, or none — but only
  // if you knew to read the absence of one.
  const wanted = canStay && currentClub !== null;
  // Three things his own club can be doing, and the body has to say which. A
  // renewal on the table is "they want to extend you"; being able to stay on
  // the deal he already has, with nothing new offered, is *not* that — the body
  // said it was, and a card headed "they want to renew" over an option reading
  // "your current contract runs on" is the game contradicting itself. The free
  // path has no existing deal to run on, so it keeps the two-way split.
  const bodyKey = isFree
    ? wanted
      ? 'decisions.transfer.free_body_wanted'
      : 'decisions.transfer.free_body_unwanted'
    : input.renewal
      ? 'decisions.transfer.body_wanted'
      : wanted
        ? 'decisions.transfer.body_stay'
        : 'decisions.transfer.body_unwanted';

  return {
    id: `transfer:${context.player.age}`,
    kind: 'transfer',
    titleKey: isFree ? 'decisions.transfer.free_title' : 'decisions.transfer.title',
    bodyKey,
    // Names the club in the body, which is what makes "they want to keep you"
    // land as news about somewhere real.
    ...(currentClub ? { params: { club: currentClub.id } } : {}),
    options,
  };
}

/**
 * The spending card. Offered once, early, and again whenever the player's
 * finances change enough for the choice to mean something.
 */
export function buildSpendingDecision(
  rng: Rng,
  cash: number,
  /** What he is on now, so the card can say what this costs in money. */
  annualWage = 0,
  investments: Investments = { trainingStaff: 0, lifestyle: 0, ventures: 0 },
): Decision {
  const flavour = pick(rng, ['a', 'b']) ?? 'a';
  /*
   * "A slice of your wage, every year" is not a price. The tiers cost 6%, 14%
   * and 25% of the gross wage and the card knew all of it — the wage, the tier
   * he is on, the tier he would move to — and still made the player guess.
   */
  const costOf = (tier: number) => Math.round(annualWage * (tierCost(tier + 1) - tierCost(tier)));
  return {
    id: `spending:${Math.round(cash)}`,
    kind: 'spending',
    titleKey: 'decisions.spending.title',
    bodyKey: `decisions.spending.body_${flavour}`,
    options: [
      {
        id: 'spend:training',
        labelKey: 'decisions.spending.training',
        outcomes: [
          { labelKey: 'decisions.spending.training_up', tone: 'positive' },
          {
            labelKey: 'decisions.spending.cost',
            params: { cash: costOf(investments.trainingStaff) },
            tone: 'negative',
          },
        ],
      },
      {
        id: 'spend:lifestyle',
        labelKey: 'decisions.spending.lifestyle',
        outcomes: [
          { labelKey: 'decisions.spending.lifestyle_up', tone: 'positive' },
          { labelKey: 'decisions.spending.lifestyle_down', tone: 'negative' },
          {
            labelKey: 'decisions.spending.cost',
            params: { cash: costOf(investments.lifestyle) },
            tone: 'negative',
          },
        ],
      },
      {
        id: 'spend:save',
        labelKey: 'decisions.spending.save',
        outcomes: [{ labelKey: 'decisions.spending.save_hint', tone: 'neutral' }],
      },
    ],
  };
}

/** Renewal terms the current club is willing to put on the table. */
export function buildRenewalOffer(
  rng: Rng,
  player: Player,
  club: Club,
  league: League,
  /** Consecutive seasons served here; long service is worth a rung and a rise. */
  seasonsAtClub = 0,
): DecisionOption['offer'] {
  const role = promisedRoleFor(player, club, league, seasonsAtClub);
  // Clubs pay a little over the odds to keep someone they already have, and
  // more again for somebody who has been there long enough that the crowd would
  // notice him leaving. This is the only offer in the game that pays for
  // service rather than ability, which is what makes staying a real option
  // rather than the choice you make when nothing better arrives.
  const loyalty = 1.08 + Math.min(0.22, seasonsAtClub * 0.045);
  const wage = Math.round(wageOffer(rng, player, club, league, role) * loyalty);
  return {
    wage,
    // A veteran who is still wanted is not automatically on a rolling
    // one-year deal — clubs hedge with age, they do not all hedge the same.
    // Was two-to-four for a twenty-year-old while a *new* club would offer
    // three-to-five, so renewing was quietly the worse deal on length as well as
    // being the safe option. A club keeping a player it rates does not offer him
    // less security than a stranger would.
    years: contractYearsFor(rng, player.age),
    fee: 0,
    signingBonus: signingBonus(wage, 0, false),
    releaseClause: null,
    promisedRole: role,
  };
}
