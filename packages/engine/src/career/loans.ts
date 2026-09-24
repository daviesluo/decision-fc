/**
 * Loans.
 *
 * The problem a loan solves is specific and very real: a nineteen-year-old at a
 * club too good for him will not play, and a season not playing costs him more
 * than a season anywhere else can gain.
 *
 * The shape: a loan is offered when the coming season projects him short of a
 * place, and when it fires it *replaces* the transfer window with **three clubs
 * where he would start**, drawn 90% from his own country. There is no "stay":
 * the window has become a loan window, and the choice is where. A career has up
 * to three spells — the ladder in `loan-flow.ts`.
 *
 * **Two decisions, both deliberate:**
 *
 * 1. **Every career is offered one.** The offer used to be a coin — 30% from
 *    rotation and 70% from the bench — which read as a chapter some players
 *    simply never got to see. The roll is gone: the first time a young player
 *    is projected short of a place, the window becomes a loan window.
 * 2. **It opens at seventeen, at home.** A seventeen-year-old going out to a
 *    club in his own country — any tier that would play him — is what actually
 *    happens to academy players, and it gives the loan somewhere to sit before
 *    the eighteen-year-old's move abroad.
 *
 * Two league-scope invariants apply as well, because they belong to the world
 * rather than to loan logic: destinations stay inside the core market and
 * inside Europe's pyramid, downward only.
 */

import type {
  ActiveLoan,
  Club,
  Decision,
  DecisionOption,
  League,
  Player,
  SquadRole,
  World,
} from '../types.js';
import { clamp, float, weightedPick, type Rng } from '../rng.js';
import { isRealisticTarget, roleCapOnLoan, roleRank } from '../model/role.js';
import { clubStanding, loanDestinationWeight } from '../model/market.js';
import { roundMoney } from '../model/finance.js';

/**
 * Does a weak projected role turn the window into a loan?
 *
 * The band matters: it keys off *rotation* downwards, not off the bench
 * downwards. Reading it one band too strict is what made loans all but
 * disappear once before — a teenager at his academy club is usually a squad
 * player, which used to score 0% and send him to a normal transfer window
 * instead.
 *
 * There is no coin. It used to roll 30% from rotation and 70% from the bench;
 * here a young player short of a place is offered the loan, full stop. A player
 * good enough to be in the side is not loaned out — that part is football, not
 * a probability.
 */
export function loanOffered(projectedRole: SquadRole): boolean {
  return roleRank(projectedRole) <= roleRank('squad');
}

/**
 * The role a loan club would actually give him — which is also the one it can
 * promise, and the one the season will honour.
 *
 * One function, used for choosing the destinations, for labelling each option
 * and for writing the guarantee into the loan, because all three have to agree.
 * They did not: the destination filter used a private bonus worth up to
 * seventeen rating points while the season capped the role at what ability
 * earned, so the card said "Regular Starter — you would start every week" and
 * the season delivered impact sub.
 *
 * `roleCapOnLoan` is the shared answer, and how big the lift is depends on who
 * is borrowing him — a promotion-chasing side gives a teenager rotation minutes,
 * a club fighting relegation plays him every week. See `LOAN_LIFT`.
 *
 * Exported because the loan-return card asks the same question when it offers a
 * second season: "would they still play him?" must have one answer.
 */
export function loanRoleAt(player: Player, club: Club, league: League, world: World): SquadRole {
  return roleCapOnLoan(player, club, league, clubStanding(club, league.id, world));
}

export interface LoanCandidate {
  club: Club;
  league: League;
  role: SquadRole;
}

/** Combined standing, so tiers differ in something the player can see. */
function levelOf(entry: LoanCandidate): number {
  return entry.club.reputation * 0.45 + entry.league.strength * 100 * 0.55;
}

/**
 * The clubs a loan window puts in front of him.
 *
 * The rule: **clubs where he would start**, drawn 90% from his own country and
 * 10% from further afield. A loan is not a shop window for the best club that
 * will take him — it is minutes, and a destination that would not play him is
 * not a destination.
 *
 * Within that, the three are spread by standing so the choice is visible: the
 * best of them, the middle, and the one where he would be the best player in
 * the building. Spreading by *role* does not work — every eligible club plays
 * him by construction — but standing still separates better football with less
 * certainty from weaker football where he is the man.
 */
/**
 * Which rung of the loan ladder this spell is.
 *
 * `home` is a seventeen-year-old's first move, inside his club's own country.
 * `development` is the classic one — the big five's second tier. `proving` is
 * the step above it, and only a player who has *earned* it ever sees it.
 */
export type LoanRung = 'home' | 'development' | 'proving';

/** One spell: the club, and how old he was when it began. */
export interface LoanSpell {
  clubId: string;
  startAge: number;
}

/**
 * The spells a career has served, in order.
 *
 * Grouped by club rather than counted by season: a spell is one season, but the
 * player can choose to extend it, and two consecutive seasons at the same club
 * are one spell rather than two. The *starting* age is what decides which rung
 * it was, so a spell begun at seventeen and extended into an eighteen-year-old
 * season is still the home spell.
 */
export function loanSpellsOf(
  seasons: readonly { clubId: string; age: number; onLoanFrom: string | null }[],
): LoanSpell[] {
  const spells: LoanSpell[] = [];
  for (const season of seasons) {
    if (season.onLoanFrom === null) continue;
    const last = spells[spells.length - 1];
    if (last && last.clubId === season.clubId) continue;
    spells.push({ clubId: season.clubId, startAge: season.age });
  }
  return spells;
}

/**
 * The rung a player is on: how many senior spells he has already had, and how
 * old he is.
 *
 * The order is deliberate, and it is a progression rather than three flavours
 * of the same card. Seventeen goes out at home. The **first** senior loan is
 * always the big five's second tier — the Championship, 2. Bundesliga, Serie B
 * — because that is what happens to an eighteen-year-old at a good club. From
 * the second one on, a player who has developed well enough to start there can
 * go to a **bottom-half club in a big-five top flight** instead, which is the
 * loan that actually launches a career.
 *
 * "Developed well enough" is not a separate ability threshold. It is the same
 * rule every destination is already held to — he only ever sees clubs that
 * would play him — so a player whose ability has not moved simply finds no
 * top-flight club willing, and gets another second-tier season. The ladder is
 * climbed by getting better, not by surviving.
 */
export function loanRung(age: number, served: readonly LoanSpell[]): LoanRung {
  if (age <= 17 && served.length === 0) return 'home';
  // The spell at home is not the first *senior* loan. Counting it as one sent a
  // seventeen-year-old who had just been out locally straight to the proving
  // rung at eighteen, skipping the second-division season the rule
  // makes mandatory: **the first senior loan is always the big five's second
  // tier**. Only spells that began at eighteen or later count towards it.
  const senior = served.filter((spell) => spell.startAge >= 18).length;
  return senior === 0 ? 'development' : 'proving';
}

export function loanDestinations(
  rng: Rng,
  world: World,
  player: Player,
  parentClub: Club,
  exclude: readonly string[] = [],
  /** Divisions this career has changed; see `CareerState.leagueMoves`. */
  leagueMoves?: Record<string, string>,
  rung: LoanRung = 'development',
): LoanCandidate[] {
  /**
   * A seventeen-year-old goes out at home.
   *
   * Not abroad, and not filtered to the big five's second tier: at seventeen
   * the move is to a club in the same country that will play him, whatever
   * division that turns out to be. That is what an academy actually does with a
   * boy who is not ready for the first team but is too good for the youth one,
   * and it keeps the eighteen-year-old's move — the Championship, 2. Bundesliga,
   * Serie B — as a distinct, later step rather than the only loan there is.
   *
   * "Home" is the country his **club** plays in, not the one on his passport.
   * Read the other way it silently excluded most of the world: the Netherlands
   * has one division here, and Brazil and Argentina have none at all, so a
   * Brazilian at Ajax had no domestic destination and never saw the card. He
   * should go out in the Eredivisie — that is the league system he is
   * registered in, and it is where a loan of his actually happens.
   */
  const homeSpell = rung === 'home';
  const leagueById = new Map(world.leagues.map((l) => [l.id, l]));
  const leagueOfClub = (club: Club) => leagueById.get(leagueMoves?.[club.id] ?? club.leagueId);
  const parentLeague = leagueOfClub(parentClub);
  if (!parentLeague) return [];
  const homeCountry = parentLeague.countryId;
  // Does his country even have a second division in this world? The big five
  // do; Portugal, the Netherlands and Belgium are modelled with one tier only.
  const homeHasSecondTier = world.leagues.some((l) => l.countryId === homeCountry && l.tier === 2);

  /**
   * Where a first loan goes: a second division in one of the big five.
   *
   * That is what the real loan market does with an eighteen-year-old at a good
   * club — the Championship, 2. Bundesliga, Serie B — because it is hard enough
   * to teach him something and close enough that his parent club can watch. A
   * boy sent to a small top-flight side abroad is a different, rarer story, and
   * offering it as the default made the loan card read like a lottery.
   */
  const BIG_FIVE = new Set(['eng', 'esp', 'ita', 'ger', 'fra']);
  const isDevelopmentLeague = (league: League) =>
    league.tier === 2 && BIG_FIVE.has(league.countryId);

  /**
   * The rung above: a bottom-half club in one of the big five's top flights.
   *
   * Not the whole division — a loan to a side chasing Europe is not a loan, it
   * is a transfer nobody would sanction. "Bottom half" is measured against the
   * median reputation of that league as the world has it, so it means the same
   * thing in the Premier League as in Ligue 1 and does not need a hand-kept
   * list of clubs.
   */
  const topFlightMedians = new Map<string, number>();
  const medianReputationOf = (league: League): number => {
    const cached = topFlightMedians.get(league.id);
    if (cached !== undefined) return cached;
    const reputations = world.clubs
      .filter((c) => (leagueMoves?.[c.id] ?? c.leagueId) === league.id)
      .map((c) => c.reputation)
      .sort((a, b) => a - b);
    const median = reputations.length === 0 ? 0 : reputations[Math.floor(reputations.length / 2)]!;
    topFlightMedians.set(league.id, median);
    return median;
  };
  const isProvingGround = (league: League, club: Club) =>
    league.tier === 1 && BIG_FIVE.has(league.countryId) && club.reputation <= medianReputationOf(league);

  const eligible = world.clubs
    .filter((club) => {
      if (club.id === parentClub.id || exclude.includes(club.id)) return false;
      // A loan is a step down, so the club is smaller. The one exception is a
      // home spell for a boy whose parent is *itself* in the second tier: there
      // is no division below to drop to, and the rule keeps him in his
      // own country's second tier, so a smaller club in the same division is the
      // honest move. Dropping the two-point buffer there lets that division
      // field the two clubs the card needs instead of sending him abroad.
      const buffer = homeSpell ? 0 : 2;
      return club.reputation < parentClub.reputation - buffer;
    })
    .map((club) => ({
      club,
      league: leagueOfClub(club)!,
      role: loanRoleAt(player, club, leagueOfClub(club)!, world),
    }))
    // Loans stay inside Europe's pyramid and inside the core market: nobody
    // sends a nineteen-year-old to the Gulf to develop.
    .filter(
      (entry) =>
        entry.league !== undefined &&
        loanDestinationWeight(parentLeague, entry.league, entry.club, homeSpell) > 0,
    )
    // The ladder. Home: his club's own country, any tier that would have him.
    // Development (the first senior spell): the big five's second tier — unless
    // the parent club is already there, in which case there is no rung below
    // and the filter would leave him nowhere to go. Proving (from the second
    // spell on): that second tier *or* a bottom-half club in a big-five top
    // flight, which the ability gate further down decides he is ready for.
    .filter((entry) => {
      // The rule: a seventeen-year-old's first loan is his own
      // country's **second division**. In the big five that division exists and
      // is the only home destination — a domestic top-flight loan (Man City to
      // Luton) is not what a first loan is. Portugal, the Netherlands and
      // Belgium have no second tier here, so a smaller club in their one
      // division is the nearest honest thing, and `tryOfferLoan` drops to the
      // development rung when even that cannot field two clubs.
      if (homeSpell) {
        if (entry.league.countryId !== homeCountry) return false;
        return homeHasSecondTier ? entry.league.tier === 2 : true;
      }
      if (isDevelopmentLeague(parentLeague)) return true;
      if (isDevelopmentLeague(entry.league)) return true;
      return rung === 'proving' && isProvingGround(entry.league, entry.club);
    })
    /*
     * Somebody who would actually have him.
     *
     * This used to read `role >= regular`, and once the guarantee became a
     * property of where the club sits in its division (`LOAN_GUARANTEE`) that
     * test stopped saying anything: every club now guarantees at least a squad
     * place, so the filter either passed everyone or, at `regular`, deleted the
     * top of every division from the card. Deleting the top is the worse of the
     * two — a promotion-chasing side offering rotation minutes is precisely the
     * option that has to be weighed against a struggling one offering every
     * week, and it can only be weighed if it is on the card.
     *
     * So the gate moves to the thing it was always standing in for: would this
     * club take him at all? The same test a transfer window uses, at a loose
     * tolerance, because a loan is a looser thing than a signing and a
     * seventeen-year-old already gets a youth allowance inside it.
     */
    .filter((entry) => isRealisticTarget(player, entry.club, entry.league, 12))
    // Tier on club standing *and* league quality together. Reputation alone put
    // a strong club in a weak league in the same tier as a weak club in a strong
    // one, and league strength is the number printed on the card.
    .sort((a, b) => levelOf(b) - levelOf(a));

  /**
   * Once he can start in a top flight, stop offering him the second tier.
   *
   * The proving rung allowed both, so a player who had outgrown the
   * Championship was still shown Championship clubs beside the Premier League
   * ones — and since every entry here has already passed "would start for
   * them", the second-tier card was strictly the worse version of the same
   * season. A ladder whose lower rung stays on the board is not a ladder.
   *
   * The gate is the eligibility filter above, not a rating threshold: if a
   * big-five top-flight club would play him every week, that *is* what "good
   * enough for the top flight" means, and no separate number has to be kept in
   * step with it.
   *
   * Any top-flight club, not only a bottom-half one. Keying it on
   * `isProvingGround` — the same test that decides whether such a club may be
   * *offered* — left a hole: a club can reach the card through a different
   * branch of the filter above and still be a top flight he can start in, and
   * the second-tier option then survived beside it. What matters here is the
   * division he is being offered, not which branch put it there.
   */
  const readyForTopFlight =
    rung === 'proving' &&
    eligible.some((entry) => entry.league.tier === 1 && BIG_FIVE.has(entry.league.countryId));
  const ladder = readyForTopFlight
    ? eligible.filter((entry) => !isDevelopmentLeague(entry.league))
    : eligible;

  if (ladder.length === 0) return [];
  if (ladder.length <= 3) return ladder;

  // Three tiers of the ladder field: the best he could get, the middle, and
  // the level where he would walk into the side.
  const third = Math.floor(ladder.length / 3);
  const tiers = [
    ladder.slice(0, Math.max(1, third)),
    ladder.slice(third, Math.max(third + 1, third * 2)),
    ladder.slice(third * 2),
  ];

  const chosen: LoanCandidate[] = [];
  const taken = new Set<string>();
  for (const tier of tiers) {
    const available = tier.filter((entry) => !taken.has(entry.club.id));
    // Within a tier: 90% his own country, and coaching quality decides the
    // rest — that is what a loan is for.
    const entry = weightedPick(rng, available, (candidate) => {
      // 90/10 his own country. A home spell has already been filtered to it, so
      // the weight is uniform there and this only shapes the older move.
      const home = candidate.league.countryId === player.countryId ? 9 : 1;
      return loanDestinationWeight(parentLeague, candidate.league, candidate.club, homeSpell) * home;
    });
    if (entry) {
      taken.add(entry.club.id);
      chosen.push(entry);
    }
  }

  return chosen;
}

export function buildLoanDecision(
  rng: Rng,
  world: World,
  player: Player,
  parentClub: Club,
  step: number,
  leagueMoves?: Record<string, string>,
  rung: LoanRung = 'development',
): Decision | null {
  // Three destinations and no "stay". This window *is* the loan window — the
  // club has already decided he is going out, and there is no way to refuse
  // it. Fewer than three only when the world cannot supply three clubs that
  // would play him.
  const effectiveRung = rung;
  const options = loanDestinations(rng, world, player, parentClub, [], leagueMoves, rung).slice(0, 3);
  /**
   * A seventeen-year-old's first loan is his own country's second tier, or he
   * does not go out at seventeen — the rule, taken at its word.
   *
   * There used to be a fallback here: a home spell his own country could not
   * fill dropped to the development rung and sent the boy to a big-five second
   * tier *abroad*. That kept the loan chapter, but it broke the rule — a
   * Portuguese or Belgian academy boy (their countries have one division in
   * this world), or one at a club already near the foot of a second tier, was
   * loaned out of his country at seventeen. The rule wins: when the domestic
   * second tier cannot field a window he simply does not go out this year, and
   * the ordinary development rung offers him a second-tier loan a year later,
   * which is exactly where that ladder was always going next.
   */
  /**
   * And when even that cannot find him two clubs, there is no card.
   *
   * The rung is not the only thing that can leave a boy with one destination:
   * a player at a club near the bottom of the pyramid has almost nothing
   * *below* him to be loaned to, whatever rung he is on. A window with one club
   * in it is not a window, and the loan is a chapter a career can simply not
   * have — he stays, fights for his place, and the season says so.
   */
  if (options.length < 2) return null;

  // The guaranteed role rides on `promisedRole`, so the card prints it on the
  // same tactics line as a transfer offer — not as a sentence of its own.
  const decisionOptions: DecisionOption[] = options.map((entry) => ({
    id: `loan:${entry.club.id}`,
    labelKey: 'decisions.loan.join',
    params: { club: entry.club.id },
    clubId: entry.club.id,
    promisedRole: entry.role,
    outcomes: [],
  }));

  return {
    id: `loan|${step}`,
    kind: 'loan',
    titleKey: 'decisions.loan.title',
    // Three different moves deserve three different framings: a boy going out
    // locally, a teenager sent down a division to learn, and a young player who
    // has earned a look at the level above. The *effective* rung, so a home
    // spell that had to go abroad is described as the move it actually is.
    bodyKey: `decisions.loan.body_${effectiveRung}`,
    params: { club: parentClub.id },
    options: decisionOptions,
  };
}

export function createLoan(
  rng: Rng,
  player: Player,
  parentClub: Club,
  destination: Club,
  destinationLeague: League,
  world: World,
): ActiveLoan {
  const role = loanRoleAt(player, destination, destinationLeague, world);
  // A club that would have him as its best player wants the right to keep him.
  const wantsOption = role === 'star' || rng() < 0.4;
  return {
    clubId: destination.id,
    parentClubId: parentClub.id,
    /**
     * **A loan is one season. Always.**
     *
     * It used to be one *or two* for a teenager, which read as the engine
     * deciding a year of his career without asking: a third of all spells ran
     * two seasons, and on the quicker paces — where a card comes every second
     * season anyway — the player was away so long it looked like the game had
     * forgotten him. A second year at the same club is a perfectly good story;
     * it is just a decision, and `tryCloseLoan` now offers it as one.
     *
     * This is also what keeps the loan clock independent of the card cadence:
     * the return card is dealt the moment the season ends, at every pace,
     * because the season the loan lasts is the season the loan lasts.
     */
    seasonsRemaining: 1,
    guaranteedRole: role,
    buyOption: wantsOption ? roundMoney(player.marketValue * float(rng, 1.1, 1.9)) : null,
  };
}

/** Did the spell work? Minutes first, then how he actually played. */
export function loanWentWell(appearances: number, rating: number): boolean {
  // 6.8 on the corrected rating scale is the same season 6.6 described before
  // `computeRating`'s baseline was fixed — see the note there.
  return appearances >= 22 && rating >= 6.8;
}

/** Loan spells at a much weaker club do less for development. */
export function loanGrowthModifier(parentClub: Club, loanClub: Club): number {
  const drop = clamp((parentClub.reputation - loanClub.reputation) / 100, 0, 0.6);
  return 1 - drop * 0.25;
}
