/**
 * Everything a loan does: offering it, ending it, and applying either choice.
 *
 * A loan is a young player's shot at minutes he cannot get where he is. Ages
 * **17–24**, only when the coming season projects him short of a place, and up
 * to **three spells**, which climb:
 *
 *   home        17, a club in his own country, any division that would play him
 *   development the big five's second tier — the first senior spell, always
 *   proving     from the second on, a bottom-half big-five top-flight club,
 *               and only if he is now good enough to start for one
 *
 * The last rung is not granted by surviving two loans; every destination has
 * always had to be a club that would actually play him, so a player whose
 * ability has not moved simply finds nobody in the top flight willing and gets
 * another second-tier season. The ladder is climbed by getting better.
 *
 * A sixteen-year-old does not get shipped anywhere and come back transformed —
 * that arc was the single most unrealistic thing the old model produced, and
 * the age floor is what stops it returning.
 *
 * It lives outside `machine.ts` because it is genuinely self-contained: the
 * state machine calls four functions here and knows nothing else about loans.
 */
import { rngFor } from '../rng.js';
import {
  determineRole,
  isRealisticTarget,
  minRole,
  promisableRole,
  roleRank,
  withinOfferReach,
} from '../model/role.js';
import { wageOffer } from '../model/finance.js';
import { clubStature, outbids, type Bid } from '../model/market.js';
import type {
  CareerState,
  Club,
  DecisionOption,
  SquadRole,
  World,
} from '../types.js';
import {
  buildLoanDecision,
  createLoan,
  loanDestinations,
  loanOffered,
  loanRung,
  loanSpellsOf,
  type LoanCandidate,
} from './loans.js';
import { buildRenewalOffer, buildTransferDecision } from './decisions.js';
import { indexWorld, type WorldIndex } from './world-index.js';

/**
 * Years that must remain on the parent contract before a loan is possible.
 *
 * Two: one for the loan season itself, and one left over so the player has a
 * club to come back to and the return card has something to offer.
 */
const LOAN_MIN_CONTRACT_YEARS = 2;

/**
 * The window's age band.
 *
 * It opens at seventeen, deliberately: a first spell at a club in his own
 * country, which is what academies actually do, and which the four-year youth
 * contract now leaves room for.
 */
const LOAN_MIN_AGE = 17;
const LOAN_MAX_AGE = 24;

/**
 * Appearances last season above which "you can't get a game here" is a lie.
 *
 * The loan card fires on the role his ability *projects* for the coming season,
 * read with his service reset, which can quietly drop a player the season just
 * carried as a regular back to a squad rating on paper. A loan offer on a
 * forty-appearance regular starter is nonsense on its face: a
 * boy who started most weeks is not short of minutes. Twenty-five is the squad
 * player's floor (`appearanceRange`); a season at or above it means he played,
 * whatever the projection says, and the card does not deal.
 */
const REGULAR_SEASON_APPEARANCES = 25;

/**
 * How many spells a career can have.
 *
 * Three: home, the second tier, and the proving move. A fourth would mean a
 * twenty-three-year-old who has spent his whole career on loan, which is not a
 * career arc, it is a holding pattern.
 */
const MAX_LOAN_SPELLS = 3;

/**
 * The clubs that would come in for him, asked through the same offer builder
 * that produces a real transfer window — so a loan ending offers the market's
 * honest view of him rather than a second, quietly different one.
 */
function candidateClubsForWindow(
  state: CareerState,
  world: World,
  index: WorldIndex,
  count: number,
  exclude: readonly string[],
): Club[] {
  const ask = (lastResort: boolean): Club[] => {
    const decision = buildTransferDecision({
      rng: rngFor(state.seed, `window-clubs:${state.seasons.length}`),
      context: {
        player: state.player!,
        world,
        leagueOf: (clubId) => index.leagueOfClub(clubId),
        clubOf: (clubId) => index.club(clubId),
        contract: state.contract,
        exclude,
        lastSeason: state.seasons[state.seasons.length - 1] ?? null,
        lastResort,
      },
      currentClub: null,
      currentLeague: null,
      mustMove: true,
      renewal: null,
    });
    return decision.options
      .filter((o) => o.id.startsWith('transfer:') && o.clubId)
      .slice(0, count)
      .map((o) => index.club(o.clubId!));
  };

  /*
   * Ask twice, exactly as `tryOpenTransferWindow` does.
   *
   * The ordinary search holds every suitor to the level of the club he is at,
   * which is right and which finds nobody for a modest player whose division
   * has finished with him — a 65-rated twenty-five-year-old at Deportivo got
   * back an empty list, and the loan-return card came out with two options on
   * it. `lastResort` widens the tolerance and drops the level anchor, which is
   * the honest answer to "who would take him?": somebody lower down.
   */
  const first = ask(false);
  return first.length >= count ? first : ask(true);
}

export function tryOfferLoan(state: CareerState, world: World): CareerState | null {
  const player = state.player!;
  const contract = state.contract!;
  if (state.loan) return null;
  // Seventeen at the earliest — a boy in his first senior season has nothing to
  // be loaned from yet — and twenty-four at the latest, after which a player
  // without a place is a transfer, not a development move.
  if (player.age < LOAN_MIN_AGE || player.age > LOAN_MAX_AGE) return null;
  // Up to three spells, which is what makes it a ladder rather than a single
  // card. That is deliberate, and the rungs above the first are gated on
  // ability rather than on having had a turn.
  const spells = loanSpellsOf(state.seasons);
  if (spells.length >= MAX_LOAN_SPELLS) return null;
  // Nobody loans out a player whose deal expires the moment he comes back: the
  // club would be sending away an asset it is about to lose for nothing, and
  // the player would return to no contract and no club. A loan has to leave at
  // least a season on the parent deal for there to be anything to return to.
  if (contract.yearsRemaining < LOAN_MIN_CONTRACT_YEARS) return null;

  const index = indexWorld(world, state.leagueMoves, state.managerChanges);
  const club = index.club(contract.clubId);
  const rng = rngFor(state.seed, `loan:${state.seasons.length}`);
  const projected = determineRole(player, {
    club,
    league: index.leagueOfClub(club.id),
    promisedRole: null,
    suspended: false,
    seasonsAtClub: 0,
  });

  // No coin. A young player projected short of a place is offered the loan; one
  // who has earned his place is not loaned out at all. See `loanOffered`.
  if (!loanOffered(projected)) return null;

  // ...and not a player who just played a full season. `loanOffered` reads the
  // projection from ability alone, so a regular starter the season carried on
  // service or form can still project to squad and draw a card that tells him he
  // is frozen out. Last season's minutes are the truth that card claims: at a
  // squad player's appearance count or above, he plainly gets a game, and it
  // does not fire. A first senior season has none to check, which is exactly the
  // seventeen-year-old the home loan is for.
  const lastSeason = state.seasons[state.seasons.length - 1];
  if (lastSeason && lastSeason.stats.appearances >= REGULAR_SEASON_APPEARANCES) return null;

  // Which rung: the seventeen-year-old's spell at home, the first senior move
  // down a division, or the proving move above it.
  const rung = loanRung(player.age, spells);
  const decision = buildLoanDecision(rng, world, player, club, state.step, state.leagueMoves, rung);
  return decision ? { ...state, pending: decision } : null;
}

/**
 * Consecutive seasons just served at a club — the same measure `machine.ts`
 * uses, deliberately.
 *
 * Standing is earned by an unbroken spell, and a loan breaks it: the loan
 * season's `clubId` is the borrowing club, so straight after one this is zero
 * at the parent. Counting lifetime seasons instead let a returning player's
 * card promise a rung above his ability, which the offer audit catches and the
 * season would then take back off him.
 */
function seasonsAt(state: CareerState, clubId: string): number {
  let count = 0;
  for (let i = state.seasons.length - 1; i >= 0; i -= 1) {
    if (state.seasons[i]!.clubId === clubId) count += 1;
    else break;
  }
  return count;
}

/** When a loan runs out, decide where he goes next. */
export function tryCloseLoan(state: CareerState, world: World): CareerState | null {
  const loan = state.loan;
  if (!loan || loan.seasonsRemaining > 0) return null;

  const index = indexWorld(world, state.leagueMoves, state.managerChanges);
  const player = state.player!;

  const loanClub = index.club(loan.clubId);
  const parentClub = index.club(loan.parentClubId);
  const parentLeague = index.leagueOfClub(parentClub.id);
  const rng = rngFor(state.seed, `loan-return:${state.seasons.length}`);

  const existing = state.contract!;
  /**
   * Seasons still to run on the parent deal, the loan season already deducted.
   * Never below one: a loan cannot start with fewer than `LOAN_MIN_CONTRACT_YEARS`
   * on the deal, so there is always at least the coming season left.
   */
  const contractYears = Math.max(1, existing.yearsRemaining);
  /** The season he is about to play is the last one the parent deal covers. */
  const finalYear = contractYears <= 1;

  const priced = (club: Club, role: SquadRole, years: number): NonNullable<DecisionOption['offer']> => {
    const wage = wageOffer(rng, player, club, index.leagueOfClub(club.id), role);
    return { wage, years, fee: 0, signingBonus: 0, releaseClause: null, promisedRole: role };
  };

  // Would he actually play for the parent club now? That is the fork the whole
  // card hangs on.
  const roleAtParent = determineRole(player, {
    club: parentClub,
    league: parentLeague,
    promisedRole: null,
    suspended: false,
    seasonsAtClub: seasonsAt(state, parentClub.id),
  });
  const wanted = roleRank(roleAtParent) >= roleRank('squad');

  /**
   * Whether the parent club actually puts new terms on the table.
   *
   * **Returning used to re-term him in silence.** The option carried a freshly
   * priced offer — a market wage for the player he had become, and a length of
   * `max(1, yearsRemaining)` — and `applyLoanReturn` then took the better of
   * that and his existing deal on each axis. So a boy came back from a good
   * loan, chose "go back", and found his wage raised and his contract reading a
   * full year again, with nothing on the card saying a club had decided
   * anything. It looked like an automatic renewal because, on the wage, it was
   * one.
   *
   * The club now makes the decision the player can see:
   *
   *   mid-contract      he goes back on the deal he signed, unchanged
   *   final year, wanted    the club offers new terms, printed as an offer
   *   final year, not wanted  the club offers nothing, and the card says so —
   *                           he plays the last season out and leaves for free
   *
   * That last branch is deliberate: a parent club is allowed
   * to decide it does not want him, and the way a player finds out should be by
   * reading it, not by watching the contract counter next summer.
   */
  const renewal =
    finalYear && wanted
      ? buildRenewalOffer(rng, player, parentClub, parentLeague, seasonsAt(state, parentClub.id))
      : null;

  const goBack: DecisionOption = renewal
    ? {
        id: `renew:${parentClub.id}`,
        labelKey: 'decisions.loan_return.go_back_renew',
        params: { club: parentClub.id },
        clubId: parentClub.id,
        // The role is already on the offer, and the card prints it on the
        // tactics line like every other offer — no sentence restating it.
        offer: renewal,
        outcomes: [],
      }
    : {
        id: `return:${parentClub.id}`,
        labelKey: 'decisions.loan_return.go_back',
        params: { club: parentClub.id },
        clubId: parentClub.id,
        // The deal he already has, printed exactly as it stands. `existing`
        // makes the screen read the length as time remaining rather than as a
        // contract being signed — see `DecisionOption['offer']`.
        offer: {
          wage: existing.wage,
          years: contractYears,
          fee: 0,
          signingBonus: 0,
          releaseClause: existing.releaseClause,
          promisedRole: roleAtParent,
          existing: true,
        },
        // Name the place, do not gesture at it. This read "you go back to the
        // same problem", which tells a player nothing he can weigh against two
        // clubs offering him football: the same problem as what, and how bad?
        // `roleAtParent` is already computed from his ability at that club — the
        // exact number the season will then use — so the card can simply say it.
        // Two lines at most, and the second only when it says something the
        // offer above it does not. "Your current deal runs on, 3 seasons left"
        // was the wage, the length and the role restated in a sentence, so it
        // went: the tags already say it. The final-year line
        // stays, because *that* is a fact no tag on the card carries.
        outcomes: finalYear
          ? [
              {
                labelKey: 'decisions.loan_return.back_at_role',
                params: { role: roleAtParent },
                tone: wanted ? ('neutral' as const) : ('negative' as const),
              },
              { labelKey: 'decisions.loan_return.no_new_terms', tone: 'negative' as const },
            ]
          : [
              {
                labelKey: 'decisions.loan_return.back_at_role',
                params: { role: roleAtParent },
                tone: wanted ? ('neutral' as const) : ('negative' as const),
              },
            ],
      };

  const options: DecisionOption[] = [];
  const taken = new Set<string>([parentClub.id, loanClub.id]);

  /*
   * **There is no "stay another year" on this card.** Deliberately.
   *
   * It was here, and it cost more than it gave: the card has three slots, so
   * an extension took one from the clubs — a boy who had just had a season
   * somewhere was shown that same club again and only two others. The loan is
   * one season and this card is about where he goes next, which is the
   * question worth three real answers.
   *
   * A career can still spend two seasons at the same club: it comes back
   * through the ordinary rungs, on merit, rather than as a button that says
   * "again".
   */

  /*
   * Another spell, worked out before anything is pushed — because whether one
   * exists is what decides whether "go back" is offered at all.
   *
   * The rule: when the parent club does not want him, going back would
   * be fringe minutes on its bench, which is not a return worth a slot. Send him
   * out again instead, to a club that will play him — and **fill the card with
   * loans, not a permanent transfer**. Two destinations, so "not in their plans"
   * is a choice of where he plays next, rather than a single loan sat beside a
   * random move that read as the return being swapped for a transfer. It is
   * the second or third rung — `loanRung` reads the spells already served, so a
   * player who has outgrown the second tier is shown a bottom-half top-flight
   * club here and one who has not is shown another second-division side.
   *
   * Gated on the parent contract exactly as `tryOfferLoan` is: a player is never
   * loaned out in the last year of his deal — the club would be lending an asset
   * it is about to lose for nothing, and he would come back to no contract at
   * all. When that gate closes there is no loan to send him on, and going back
   * to play the final season out is the only honest thing left.
   */
  let nextLoans: LoanCandidate[] = [];
  if (!wanted) {
    const served = loanSpellsOf(state.seasons);
    nextLoans =
      served.length >= MAX_LOAN_SPELLS || contractYears < LOAN_MIN_CONTRACT_YEARS
        ? []
        : loanDestinations(
            rng,
            world,
            player,
            parentClub,
            [loanClub.id],
            state.leagueMoves,
            loanRung(player.age, served),
          ).slice(0, 2);
  }

  /*
   * The one case a loan cannot cover: the parent club does not want him and
   * cannot send him out either — his final contract year, or the loan rungs are
   * spent. It is not lending him, so it will do the other thing an unwanted
   * asset gets: sell him before he walks for nothing. The card reads that way —
   * the body says the club means to cash in, the slots are sale offers (the
   * buyout it earned on loan and one from the market), and the last door is the
   * bleak one, going back to run the deal down from the bench.
   */
  const sellCase = !wanted && nextLoans.length === 0;

  if (!wanted) {
    // Not retained: a permanent signing at the club he has just played for
    // sits at the top, because it is the offer the season he just had actually
    // earned him.
    options.push({
      id: `buyout:${loanClub.id}`,
      labelKey: 'decisions.loan_return.sign_permanently',
      params: { club: loanClub.id },
      clubId: loanClub.id,
      // The loan guarantee was a term of the *loan*: a club takes a young player
      // specifically to play him, often under a clause obliging them to. Signing
      // him outright ends that obligation, so the permanent deal is written
      // against his ability at the club like any other — otherwise a season on
      // loan bought a star's contract at a club he could not start for.
      offer: {
        ...priced(
          loanClub,
          minRole(loan.guaranteedRole, promisableRole(player, loanClub, index.leagueOfClub(loanClub.id))),
          4,
        ),
        fee: loan.buyOption ?? 0,
      },
      outcomes: [{ labelKey: 'decisions.loan_return.stay_playing', tone: 'positive' }],
    });
  }

  // Going back to the parent club, when it wants him — a return to a real place
  // in the side is the heart of this card. When it does not want him a return
  // would only be fringe minutes, so the rule replaces it with the loan
  // below when one can be dealt, and in the sell case it goes on last, after the
  // sale offers, as the resigned choice to run the deal down from the bench.
  if (wanted) {
    options.push(goBack);
  }

  for (const entry of nextLoans) {
    taken.add(entry.club.id);
    options.push({
      id: `loan:${entry.club.id}`,
      labelKey: 'decisions.loan.join',
      params: { club: entry.club.id },
      clubId: entry.club.id,
      promisedRole: entry.role,
      outcomes: [],
    });
  }

  /**
   * Three answers, always.
   *
   * Every other club card in this game deals three, and this one dealt two
   * whenever the world could not produce a next loan rung — a boy whose parent
   * club did not want him was shown "sign for the club you were just at" and
   * "go back to the club that does not want you", with no third door. The
   * market has an honest opinion of him either way, so it is asked for one and
   * the missing slots are filled with real permanent offers, priced by the same
   * builder a transfer window uses.
   */
  // Normally three answers; in the sell case only two are filled here, because
  // the third — going back to run the deal down — is pushed on last, below.
  const fillTarget = sellCase ? 2 : 3;
  if (options.length < fillTarget) {
    const suitors = candidateClubsForWindow(state, world, index, 6, [...taken]);
    /**
     * Three answers, and three *different* ones.
     *
     * The same rule the transfer window applies: a club that another option on
     * this card already beats on stature, role and wage alike is not a third
     * answer, it is a third button. Filling the slot from a wider draw is what
     * keeps both promises at once — three doors, none of them painted on.
     */
    const onCard = (): Bid[] =>
      options.flatMap((o) =>
        o.offer && o.clubId
          ? [
              {
                stature: clubStature(index.club(o.clubId), index.leagueOfClub(o.clubId)),
                role: o.offer.promisedRole,
                wage: o.offer.wage,
              },
            ]
          : [],
      );
    const skipped: Club[] = [];
    const consider = (club: Club, allowBeaten: boolean): boolean => {
      if (options.length >= fillTarget) return false;
      if (taken.has(club.id)) return false;
      // The widened search is a search, not a licence. `lastResort` relaxes the
      // ability test to a tolerance of forty so a career that has run out of
      // road is shown *something*, and on a seventeen-year-old that produced
      // Championship clubs bidding for a 45-rated boy. The filter every other
      // window applies still applies here.
      if (!isRealisticTarget(player, club, index.leagueOfClub(club.id))) return false;
      // The ceiling too: a sale offer on this card is a permanent move like any
      // other, so a club far below his ability is no more a suitor here.
      if (!withinOfferReach(player, club, index.leagueOfClub(club.id))) return false;
      const offer = priced(
        club,
        determineRole(player, {
          club,
          league: index.leagueOfClub(club.id),
          promisedRole: null,
          suspended: false,
          seasonsAtClub: 0,
        }),
        3,
      );
      const bid: Bid = {
        stature: clubStature(club, index.leagueOfClub(club.id)),
        role: offer.promisedRole,
        wage: offer.wage,
      };
      if (!allowBeaten && onCard().some((other) => outbids(other, bid))) {
        skipped.push(club);
        return false;
      }
      taken.add(club.id);
      options.push({
        id: `transfer:${club.id}`,
        // A permanent signing, sitting on the same card as the loan-club buyout
        // (`sign_permanently`) and another loan (`Go to … on loan`). Reusing the
        // plain "Sign for {club}" here read as something less than permanent
        // beside "Sign permanently"; this makes both permanent rows say so, and
        // only the loan row say "loan".
        labelKey: 'decisions.loan_return.sign_permanently',
        params: { club: club.id },
        clubId: club.id,
        offer,
        outcomes: [],
      });
      return true;
    };
    for (const club of suitors) consider(club, false);
    // Nobody in the draw could add anything. The card still deals its answers,
    // so the best of the ones it passed over goes on: a step down he can see
    // beats a slot that is not there.
    for (const club of skipped) {
      if (options.length >= fillTarget) break;
      consider(club, true);
    }
  }

  // The sell case's last door: going back to see the contract out from the
  // bench, added after the sale offers so it reads as the resigned choice.
  if (sellCase) {
    options.push(goBack);
  }

  return {
    ...state,
    pending: {
      id: `loan_return|${state.step}`,
      kind: 'loan_return',
      titleKey: 'decisions.loan_return.title',
      // The body speaks to what the parent club has decided. "They want you in
      // the side" over a real return; "still not in their plans, go find your
      // football" over a card that sends him out again; "still not in their
      // plans, and they mean to sell you before your deal runs out" over the
      // card that cannot. Keyed on ability at the parent — exactly what a good or
      // a poor loan moved — and on whether another spell could be dealt.
      bodyKey: wanted
        ? 'decisions.loan_return.body_wanted'
        : sellCase
          ? 'decisions.loan_return.body_selling'
          : 'decisions.loan_return.body_unwanted',
      params: { club: parentClub.id, loanClub: loanClub.id },
      options,
    },
  };
}

export function applyLoan(state: CareerState, option: DecisionOption, world: World): CareerState {

  const index = indexWorld(world, state.leagueMoves, state.managerChanges);
  const destination = index.club(option.clubId!);
  const parent = index.club(state.contract!.clubId);
  const loan = createLoan(
    rngFor(state.seed, `loan-terms:${state.step}`),
    state.player!,
    parent,
    destination,
    index.leagueOfClub(destination.id),
    world,
  );

  return {
    ...state,
    loan,
    lastResult: { key: 'decisions.loan.results.joined', tone: 'neutral', params: { club: destination.id } },
  };
}

/**
 * @param applyTransfer the state machine's own transfer resolver, passed in
 *   rather than imported to keep this module free of a cycle back into
 *   `machine.ts`. A move offered on this card has to go through exactly the
 *   same code as a move offered in a transfer window, or the two quietly
 *   diverge — which is precisely how the bug below happened.
 */
export function applyLoanReturn(
  state: CareerState,
  option: DecisionOption,
  world: World,
  applyTransfer: (state: CareerState, option: DecisionOption, world: World) => CareerState,
): CareerState {
  const index = indexWorld(world, state.leagueMoves, state.managerChanges);
  const loan = state.loan!;

  /**
   * A permanent move to one of the clubs the card offered.
   *
   * **This branch did not exist.** The card builds `transfer:<club>` options —
   * two of them, priced, with a wage, a contract length and a promised role on
   * the face of the card — and every one of them fell through to the "went back
   * to the parent club" return below. A player who chose Lyon was handed his
   * old club, his old contract and no explanation. It is the worst kind of bug
   * this game can have: the decision was read, considered and taken, and the
   * engine ignored it.
   */
  if (option.id.startsWith('transfer:')) {
    const moved = applyTransfer({ ...state, loan: null }, option, world);
    return {
      ...moved,
      loan: null,
      lastResult: {
        key: 'decisions.transfer.results.joined',
        tone: 'positive',
        params: { club: option.clubId! },
      },
    };
  }

  /**
   * Another loan spell, the next rung up.
   *
   * Also fell through to "went home". `applyLoan` reads the parent from
   * `state.contract`, which is still the parent club here, so the new spell is
   * built against the right club — but the old one has to be cleared first or
   * `tryOfferLoan`'s `if (state.loan) return null` guard sees a spell already
   * running.
   */
  if (option.id.startsWith('loan:')) {
    return applyLoan({ ...state, loan: null }, option, world);
  }

  // Signing permanently for the loan club: the buy option becomes a real fee,
  // and that fee counts toward the Valuation leaderboard like any other.
  if (option.id.startsWith('buyout:')) {
    const club = index.club(option.clubId!);
    // The wage shown on the card is the wage he signs for.
    const wage = option.offer?.wage ?? state.contract!.wage;
    return {
      ...state,
      loan: null,
      contract: {
        clubId: club.id,
        wage,
        yearsRemaining: 4,
        releaseClause: null,
        promisedRole: loan.guaranteedRole,
      },
      totals: { ...state.totals, transferFees: state.totals.transferFees + (loan.buyOption ?? 0) },
      // The fee lands on the season about to be played, like any other signing.
      pendingFee: loan.buyOption ?? 0,
      lastResult: { key: 'decisions.loan_return.results.signed', tone: 'positive', params: { club: club.id } },
    };
  }

  /**
   * Going back to the parent club — and going back on exactly the terms the
   * card printed, whichever of the two shapes it took.
   *
   * `renew:` is the club putting new terms on the table, which only happens in
   * the final year of the deal and only when it wants him. `return:` is the
   * deal he already has, and the offer on it was built from that deal, so it
   * applies verbatim.
   *
   * This used to take the better of card and contract on each axis, which
   * sounds protective and was not: the card was priced at the market rate for
   * the player he had become, so *every* return quietly raised his wage and
   * refreshed his contract with no club having decided anything. The card now
   * states which of the two is happening, and this applies what it said.
   */
  const existing = state.contract!;
  const offer = option.offer;
  const renewed = option.id.startsWith('renew:');
  return {
    ...state,
    loan: null,
    contract: offer
      ? {
          clubId: existing.clubId,
          wage: offer.wage,
          yearsRemaining: offer.years,
          releaseClause: offer.releaseClause,
          promisedRole: offer.promisedRole,
        }
      : existing,
    lastResult: {
      key: renewed ? 'decisions.loan_return.results.renewed' : 'decisions.loan_return.results.returned',
      tone: 'neutral',
      params: { club: existing.clubId },
    },
  };
}
