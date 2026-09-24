/**
 * The career state machine.
 *
 * Two entry points drive everything: `selectIdentity` starts a career and
 * `decide` answers whatever card is on screen. After a decision is applied the
 * machine runs forward on its own — simulating seasons, ageing the player,
 * opening transfer windows — until it needs the player again or the career is
 * over. The UI therefore never has to know what "next" means.
 *
 * States are treated as immutable: every function returns a new object. RNG is
 * addressed per channel, so adding a roll in one place does not shift results
 * everywhere else.
 */

import {
  EMPTY_MODIFIERS,
  EMPTY_TOTALS,
  MANAGER_STYLES,
  PACE_DECISIONS,
  PACE_EFFECT_SCALE,
  WINDOW_SPREAD,
  type CareerState,
  type Club,
  type Contract,
  type Country,
  type Decision,
  type DecisionOption,
  type IdentityInput,
  type League,
  type Pace,
  type ManagerStyle,
  type Player,
  type SeasonRecord,
  type SquadRole,
  type World,
} from '../types.js';
import { chance, clamp, float, int, rngFor, weightedPick, type Rng } from '../rng.js';
import { applyArchetype, computeOverall, startingAttributes } from '../model/attributes.js';
import {
  coachingMultiplier,
  developPlayer,
  formGrowthMultiplier,
  minutesGrowthMultiplier,
  rollDevelopmentProfile,
  stillImproving,
} from '../model/growth.js';
import {
  determineRole,
  shiftRole,
  adjacentPositions,
  isRealisticTarget,
  minRole,
  promisableRole,
  roleCap,
  roleCapOnLoan,
  roleCeiling,
  roleRank,
  starterBar as starterBarOf,
  tacticalFit,
  withinOfferReach,
} from '../model/role.js';
import { injuryRisk, rollInjury } from '../model/injury.js';
import {
  clubMayBid,
  clubStanding,
  clubStature,
  formScore,
  leaguePull,
  marketFormOf,
  outbids,
  SPINOFF_MIN_AGE,
  type Bid,
} from '../model/market.js';
import {
  MAX_WAGE,
  annualSpend,
  endorsementIncome,
  wageOffer,
  lifestyleGrowthMultiplier,
  marketValue,
  netOf,
  roundMoney,
  trainingGrowthMultiplier,
  trainingInjuryMultiplier,
  ventureReturn,
} from '../model/finance.js';
import { EMPTY_STATS, addStats, simulateSeason } from '../sim/season.js';
import { continentalEntry, simulateTrophies, trophyField } from '../sim/trophies.js';
import { simulateAwards } from '../sim/awards.js';
import { simulateNationalTeam, tournamentThisYear } from '../sim/national.js';
import { generateHeadlines } from '../sim/media.js';
import { buildSquad } from '../sim/squad.js';
import { eligibleEvents, type EventContext, type EventDef, EVENTS } from './events.js';
import type { Effect } from './effects.js';
import { describeEffect } from './consequences.js';
import {
  CARD_SLOTS,
  WINDOW_REPUTATION_SPREAD,
  buildAcademyDecision,
  contractYearsFor,
  buildRenewalOffer,
  buildSpendingDecision,
  buildTransferDecision,
  RENEWAL_MAX_YEARS_LEFT,
} from './decisions.js';
import { indexWorld, type WorldIndex } from './world-index.js';
import { applyLoan, applyLoanReturn, tryCloseLoan, tryOfferLoan } from './loan-flow.js';
import { finishCareer, maybeRetire, MIN_RETIREMENT_AGE } from './ending.js';

const START_AGE = 16;
const START_YEAR = 2026;
/**
 * The most overall a single season may cost — the ageing curve and a lasting
 * injury together. The curve alone is bounded in `growth.ts`; this bounds the
 * sum, so even a serious injury in a declining year is a step down, not the
 * 85-to-68 collapse a player reported.
 */
const MAX_TOTAL_SEASON_DROP = 7;

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export function createCareer(seed: string, pace: Pace): CareerState {
  return {
    version: 1,
    seed,
    pace,
    phase: 'identity',
    step: 0,
    year: START_YEAR,
    player: null,
    identity: null,
    contract: null,
    loan: null,
    developmentCycle: null,
    investments: { trainingStaff: 0, lifestyle: 0, ventures: 0 },
    cash: 0,
    seasons: [],
    totals: { ...EMPTY_TOTALS },
    pending: null,
    history: [],
    cardsRemaining: 0,
    lastResult: null,
    recentSeasons: [],
    modifiers: { ...EMPTY_MODIFIERS },
    seenEvents: [],
    chapters: {},
    redStreak: 0,
    retirement: null,
  };
}

export function selectIdentity(state: CareerState, input: IdentityInput, world: World): CareerState {
  if (state.phase !== 'identity') throw new Error(`Cannot select identity in phase "${state.phase}"`);
  const index = indexWorld(world, state.leagueMoves, state.managerChanges);
  // Throws on a country the world does not have, before any of it is written
  // into the save.
  index.country(input.countryId);

  const rng = rngFor(state.seed, 'identity');
  const archetype = input.archetype ?? 'technical';
  // The type reshapes the six attributes without changing the rating, so no
  // starting choice is stronger than another.
  // A separate channel for the type's own wobble: adding draws to `identity`
  // would shift every roll after it and break the replay of stored careers.
  const shapeRng = rngFor(state.seed, 'identity:shape');
  const attributes = applyArchetype(
    startingAttributes(input.position, (min, max) => float(rng, min, max)),
    archetype,
    input.position,
    (min, max) => float(shapeRng, min, max),
  );
  const player: Player = {
    lastName: input.lastName.trim().slice(0, 18) || 'Player',
    archetype,
    shirtNumber: clamp(Math.round(input.shirtNumber), 1, 99),
    foot: input.foot,
    countryId: input.countryId,
    position: input.position,
    age: START_AGE,
    attributes,
    hidden: {
      developmentProfile: rollDevelopmentProfile(rng),
      consistency: Math.round(float(rng, 25, 95)),
      // A body built for contact holds up better; a body built for sprinting
      // does not. This is the physical player's whole edge — he takes neither
      // the quick player's early bonus nor his late bill, and is paid in
      // games played instead (~29.2 appearances a season against 28.9).
      injuryProneness: clamp(
        Math.round(float(rng, 10, 90)) + (archetype === 'physical' ? -20 : archetype === 'pace' ? 10 : 0),
        5,
        95,
      ),
    },
    personality: rollPersonality(rng),
    dopingBan: false,
    overall: computeOverall(attributes, input.position),
    marketValue: 0,
  };
  player.marketValue = marketValue(player, 0.4);

  return {
    ...state,
    phase: 'academy',
    player,
    // Store the normalized inputs, not the raw ones, so a replayed submission
    // goes through exactly the same trimming/clamping as the original run.
    identity: {
      lastName: player.lastName,
      shirtNumber: player.shirtNumber,
      foot: input.foot,
      countryId: input.countryId,
      position: input.position,
      archetype,
    },
    pending: buildAcademyDecision(rngFor(state.seed, 'academy'), world, player),
  };
}

function rollPersonality(rng: Rng): Player['personality'] {
  const options: Player['personality'][] = [
    'model_professional', 'perfectionist', 'resolute', 'maverick',
    'leader', 'loner', 'fragile', 'party_animal',
    'loyalist', 'mercenary', 'reserved', 'media_darling',
  ];
  return options[int(rng, 0, options.length - 1)]!;
}

/**
 * Where he stands at the club he is at, right now.
 *
 * The last season he actually played there is the honest answer — it is the
 * one the club and the player both saw. Straight after a move there is no such
 * season, and then the contract's promise is what he has been told he is, which
 * is exactly what a real player would tell you in August.
 *
 * Returns null only before the first contract exists.
 */
export function currentRole(state: CareerState): SquadRole | null {
  const clubId = state.loan?.clubId ?? state.contract?.clubId ?? null;
  if (!clubId) return null;
  const last = state.seasons[state.seasons.length - 1];
  if (last && last.clubId === clubId) return last.role;
  return state.loan?.guaranteedRole ?? state.contract?.promisedRole ?? null;
}

// ---------------------------------------------------------------------------
// Decision entry point
// ---------------------------------------------------------------------------

export function decide(state: CareerState, optionId: string, world: World): CareerState {
  const decision = state.pending;
  if (!decision) throw new Error('No decision is pending');
  const option = decision.options.find((o) => o.id === optionId);
  if (!option) throw new Error(`Unknown option: ${optionId}`);

  let next: CareerState = {
    ...state,
    step: state.step + 1,
    history: [...state.history, { decisionId: decision.id, optionId }],
    pending: null,
    lastResult: null,
    recentSeasons: [],
  };

  switch (decision.kind) {
    case 'academy':
      next = applyAcademy(next, option, world);
      break;
    case 'transfer':
      // The window can carry a walk-away option for veterans.
      if (option.id === 'retire:now') return finishCareer(next, world, 'retirement.chose');
      next = applyTransfer(next, option, world);
      break;
    case 'spending':
      next = applySpending(next, option);
      break;
    case 'loan':
      next = applyLoan(next, option, world);
      break;
    case 'loan_return':
      next = applyLoanReturn(next, option, world, applyTransfer);
      break;
    case 'career_event':
      next = applyCareerEvent(next, decision, option, world);
      break;
    case 'retirement':
      return finishCareer(next, world, 'retirement.chose');
    default: {
      /**
       * A kind nothing resolves must not be answerable.
       *
       * This was `default: break` — the card was dealt, the player chose, the
       * engine applied nothing and moved on. That is the same fault the
       * loan-return card had for months: a branch nobody wrote, no type error,
       * no throw, and a choice that quietly did not happen. Typed as `never`,
       * adding a kind to `DecisionKind` without a case here stops compiling,
       * and the runtime throw covers a card built from a save the compiler
       * never saw.
       */
      const unresolved: never = decision.kind;
      throw new Error(`No resolver for decision kind: ${String(unresolved)}`);
    }
  }

  return progress(next, world);
}

// ---------------------------------------------------------------------------
// Decision application
// ---------------------------------------------------------------------------

function applyAcademy(state: CareerState, option: DecisionOption, world: World): CareerState {
  const index = indexWorld(world, state.leagueMoves, state.managerChanges);
  const club = index.club(option.clubId!);
  const league = index.leagueOfClub(club.id);
  const rng = rngFor(state.seed, `academy-terms:${club.id}`);

  const wage = roundMoney(clamp(club.wealth * 22 * float(rng, 0.7, 1.4), 300, 6_000));
  const contract: Contract = {
    clubId: club.id,
    wage,
    // Four, and it has to be four — see `ACADEMY_CONTRACT_YEARS`. This branch
    // held a hardcoded 3 while the constant that documents the rule sat
    // unread in `applyTransfer`, which is the branch an academy card never
    // takes. Three years leaves one on the deal at 18, `LOAN_MIN_CONTRACT_YEARS`
    // refuses to loan a player with one year left, and the entire loan chapter
    // quietly stopped happening to anyone who had not already transferred:
    // 17 loan seasons at eighteen across 600 careers, against 313 once this
    // reads the constant.
    yearsRemaining: ACADEMY_CONTRACT_YEARS,
    releaseClause: null,
    /**
     * A sixteen-year-old signing his first youth deal is a fringe player, and
     * the screen has to say so.
     *
     * This read `impact_sub`, and `determineRole` treats a promised role as a
     * floor, so every career in the game opened on "Impact Sub — you come off
     * the bench to change games" before the boy had trained with the first team
     * once. Nothing else promoted him: his ability earns `fringe` at any club in
     * the database at sixteen, so the floor was the whole of it. `fringe` is
     * rank zero, which means this line now states the truth and lifts nothing.
     *
     * It does not cost him his debut season either: appearances at seasonIndex 0
     * come from `DEBUT_APPEARANCES` whatever the role says, so he still gets his
     * three-to-eight games.
     */
    promisedRole: 'fringe',
  };

  const player = state.player!;
  return {
    ...state,
    phase: 'season',
    contract,
    player: { ...player, marketValue: marketValue(player, league.strength) },
    cardsRemaining: cardsForSeason(state.pace, 0),
  };
}

function applyTransfer(state: CareerState, option: DecisionOption, world: World): CareerState {
  const index = indexWorld(world, state.leagueMoves, state.managerChanges);

  // Running the deal down: stay put, no new terms, and the contract lapses so
  // next summer is a free transfer.
  if (option.id.startsWith('runout:')) {
    return {
      ...state,
      contract: state.contract ? { ...state.contract, yearsRemaining: 1 } : state.contract,
      // Remembered for the season it governs: see `CareerState.runningDown`.
      runningDown: true,
      lastResult: { key: 'decisions.transfer.results.running_down', tone: 'neutral' },
    };
  }

  const club = index.club(option.clubId!);
  const league = index.leagueOfClub(club.id);
  const offer = option.offer;
  const player = state.player!;
  const isMove = state.contract?.clubId !== club.id;

  const contract: Contract = offer
    ? {
        clubId: club.id,
        wage: offer.wage,
        yearsRemaining: offer.years,
        releaseClause: offer.releaseClause,
        promisedRole: offer.promisedRole,
      }
    : {
        clubId: club.id,
        wage: state.contract?.wage ?? 1000,
        // A first youth deal is long — four years, which is what an academy
        // signs a sixteen-year-old to. Two meant his contract ran out at
        // eighteen, which is both wrong and the exact age the loan window opens:
        // a deal with one year left cannot be loaned out (see
        // `LOAN_MIN_CONTRACT_YEARS`), so the short academy contract was quietly
        // cancelling the loan chapter as well as producing an expiry card.
        yearsRemaining: ACADEMY_CONTRACT_YEARS,
        releaseClause: null,
        promisedRole: minRole('squad', promisableRole(player, club, league, countSeasonsAtClub(state.seasons, club.id))),
      };

  const bonus = offer?.signingBonus ?? 0;
  const fee = isMove ? offer?.fee ?? 0 : 0;

  return {
    ...state,
    contract,
    // Signing anything ends the run-down, including a renewal at the same club:
    // the decision it recorded was "no new terms", and there are now new terms.
    runningDown: false,
    cash: state.cash + bonus,
    player: { ...player, marketValue: marketValue(player, league.strength) },
    totals: { ...state.totals, transferFees: state.totals.transferFees + fee },
    // Fee is attributed to the season about to be played.
    modifiers: { ...state.modifiers, forcedTransfer: false },
    lastResult: {
      // Three outcomes, not two: a move joins, a renewal is signed, and "stay
      // on the deal I have" is neither — the last used to report "you put pen
      // to paper" for the one option that explicitly puts no new terms on the
      // table (`stay_on_deal`, which carries no offer).
      key: isMove
        ? 'decisions.transfer.results.joined'
        : offer
          ? 'decisions.transfer.results.stayed'
          : 'decisions.transfer.results.stayed_on_deal',
      tone: 'neutral',
      params: { club: club.id },
    },
    // Carry the fee so the next simulated season records it.
    pendingFee: fee,
  };
}

function applySpending(state: CareerState, option: DecisionOption): CareerState {
  const investments = { ...state.investments };
  let key = 'decisions.spending.results.saved';
  switch (option.id) {
    case 'spend:training':
      investments.trainingStaff = clamp(investments.trainingStaff + 1, 0, 3);
      key = 'decisions.spending.results.training';
      break;
    case 'spend:lifestyle':
      investments.lifestyle = clamp(investments.lifestyle + 1, 0, 3);
      key = 'decisions.spending.results.lifestyle';
      break;
    default:
      break;
  }
  return { ...state, investments, lastResult: { key, tone: 'neutral' } };
}

function applyCareerEvent(
  state: CareerState,
  decision: Decision,
  option: DecisionOption,
  world: World,
): CareerState {
  const eventId = decision.id.split('|')[0]!;
  const event = EVENTS.find((e) => e.id === eventId);
  if (!event) return state;

  // An inline club move: the card already carried the priced offer, so the
  // transfer applies exactly as shown, then the event's own consequences.
  if (option.clubId && option.id.includes(':join:')) {
    const moved = applyTransfer(state, option, world);
    const joinDef = event.options.find((o) => o.outcomes[0]?.effect.joinClub);
    if (!joinDef) return moved;
    const { joinClub: _joinClub, ...rest } = resolveEffect(
      joinDef.outcomes[0]!.effect,
      state.contract?.wage ?? 0,
      state.pace,
    );
    return applyEffect(
      moved,
      rest,
      world,
      `events.${event.id}.results.${rest.resultKey}`,
      null,
      resultParams(decision),
    );
  }

  const optionKey = option.id.split(':').pop()!;
  const definition = event.options.find((o) => o.id === optionKey);
  if (!definition) return state;

  const rng = rngFor(state.seed, `event-outcome:${state.step}:${eventId}`);
  const [primary, secondary] = definition.outcomes;
  const isGamble = secondary !== undefined && primary.odds !== undefined;

  /*
   * The mercy rule (2026-08-02, deliberately undocumented in
   * the game): three gambles landing red in a row means the fourth cannot.
   * Purely a floor on misery — it never touches an ordinary roll, the printed
   * odds stay true for every roll that actually happens, and the streak is
   * part of `CareerState`, so a replay from seed + decisions reproduces the
   * forced roll exactly. Nothing in the UI or the copy may ever explain it.
   */
  const streak = state.redStreak ?? 0;
  let outcome = primary;
  if (isGamble && streak >= 3) {
    outcome =
      primary.effect.resultTone !== 'negative'
        ? primary
        : secondary.effect.resultTone !== 'negative'
          ? secondary
          : primary;
  } else if (isGamble) {
    outcome = !chance(rng, primary.odds!) ? secondary : primary;
  }

  const nextStreak = !isGamble
    ? streak
    : outcome.effect.resultTone === 'negative'
      ? streak + 1
      : 0;

  return applyEffect(
    { ...state, redStreak: nextStreak },
    resolveEffect(outcome.effect, state.contract?.wage ?? 0, state.pace),
    world,
    `events.${eventId}.results.${outcome.effect.resultKey}`,
    typeof decision.params?.newCountry === 'string' ? decision.params.newCountry : null,
    resultParams(decision),
  );
}

/**
 * The slots a result line may fill, taken from the card that produced it.
 *
 * Result copy used to carry no params at all, so a sentence with a slot in it
 * printed the slot: the club-versus-country card said "You go to the
 * {tournament} and play for your country" — 20 times in 540 played careers, in
 * both languages, because the *card* resolved `{tournament}` and the *result*
 * had nothing to resolve it with.
 *
 * `club` is deliberately left out: the screen fills that one with the club the
 * career is at when the result is read, which for a card that moves you is the
 * club you moved to rather than the one you left.
 */
function resultParams(decision: Decision): Record<string, string | number> | undefined {
  const { club: _club, ...rest } = decision.params ?? {};
  return Object.keys(rest).length > 0 ? rest : undefined;
}

/**
 * Fold a single effect into career state.
 *
 * @param newCountry the destination the card resolved for a nationality switch,
 *   carried on the decision so the player could read it before choosing.
 * @param params slots the result sentence may name — the tournament, the
 *   trophy, the month the card was stamped with.
 */
function applyEffect(
  state: CareerState,
  effect: Effect,
  world: World,
  resultKey: string,
  newCountry: string | null = null,
  params: Record<string, string | number> | undefined = undefined,
): CareerState {
  let player = state.player!;
  const index = indexWorld(world, state.leagueMoves, state.managerChanges);
  const rng = rngFor(state.seed, `effect:${state.step}`);

  if (effect.overall) player = nudgeOverall(player, effect.overall);
  if (effect.attributes) {
    const attributes = { ...player.attributes };
    for (const [key, delta] of Object.entries(effect.attributes)) {
      const k = key as keyof typeof attributes;
      attributes[k] = clamp(attributes[k] + (delta ?? 0), 1, 99);
    }
    player = { ...player, attributes, overall: computeOverall(attributes, player.position) };
  }
  if (effect.changePosition) {
    const options = adjacentPositions(player.position);
    const target = options[int(rng, 0, Math.max(0, options.length - 1))];
    if (target) player = { ...player, position: target, overall: computeOverall(player.attributes, target) };
  }
  if (effect.dopingBan) player = { ...player, dopingBan: true };
  if (effect.switchNation && newCountry) player = { ...player, countryId: newCountry };

  const modifiers = { ...state.modifiers };
  modifiers.temporaryDelta += effect.temporary ?? 0;
  modifiers.roleShift += effect.roleShift ?? 0;
  if (effect.role) modifiers.roleOverride = effect.role;
  if (effect.leagueTrophyMultiplier) modifiers.leagueTrophyMultiplier *= effect.leagueTrophyMultiplier;
  if (effect.cupTrophyMultiplier) modifiers.cupTrophyMultiplier *= effect.cupTrophyMultiplier;
  if (effect.continentalTrophyMultiplier) modifiers.continentalTrophyMultiplier *= effect.continentalTrophyMultiplier;
  if (effect.growthMultiplier) modifiers.growthMultiplier *= effect.growthMultiplier;
  if (effect.injuryRiskMultiplier) modifiers.injuryRiskMultiplier *= effect.injuryRiskMultiplier;
  if (effect.suspended) modifiers.suspended = true;
  if (effect.forceTransfer) modifiers.forcedTransfer = true;
  // The key-moment coin lands: the pre-simulated final is forced or lost.
  if (effect.forcePendingTrophy && state.pendingTrophy) modifiers.forceTrophy = state.pendingTrophy;
  if (effect.skipPendingTrophy && state.pendingTrophy) modifiers.skipTrophy = state.pendingTrophy;
  // Club versus country. Both of these were declared on the effect, printed on
  // the card as a consequence, and dropped here — so the decision changed
  // nothing at all.
  if (effect.forceCallUp) modifiers.forceCallUp = true;
  if (effect.skipCallUp) modifiers.skipCallUp = true;

  const chapters = { ...state.chapters };
  if (effect.advanceChapter) chapters[effect.advanceChapter] = (chapters[effect.advanceChapter] ?? 0) + 1;

  let contract = state.contract;
  if (effect.wageMultiplier && contract) {
    contract = { ...contract, wage: roundMoney(contract.wage * effect.wageMultiplier) };
  }

  // Keep market value honest after any ability change.
  if (contract) {
    const league = index.leagueOfClub(contract.clubId);
    player = { ...player, marketValue: marketValue(player, league.strength) };
  }

  /*
   * Money a card *pays* is money the career earned, so it belongs on the
   * wealth board with the wages.
   *
   * It did not before. The earnings board counted only the contract, so the
   * boot deal, the testimonial gate and every other card whose whole subject
   * is money changed the number in the corner of the screen and nothing else
   * — three world rankings, one of them explicitly about wealth, and the
   * cards about wealth did not reach it. Money a card *costs* is an expense:
   * it comes out of what he has, not out of what he ever earned.
   */
  const earned = Math.max(0, effect.cash ?? 0);

  const next: CareerState = {
    ...state,
    player,
    contract,
    modifiers,
    chapters,
    cash: Math.max(0, state.cash + (effect.cash ?? 0)),
    totals: earned > 0
      ? {
          ...state.totals,
          grossEarnings: state.totals.grossEarnings + earned,
          netEarnings: state.totals.netEarnings + earned,
        }
      : state.totals,
    lastResult: { key: resultKey, tone: effect.resultTone, ...(params ? { params } : {}) },
  };
  // A key-moment trophy is decided exactly once.
  delete next.pendingTrophy;
  return next;
}

/**
 * Spread an OVR-denominated change across the attributes the position cares
 * about, so the rating moves by roughly the stated amount without flattening
 * the player's profile.
 */
function nudgeOverall(player: Player, delta: number): Player {
  const attributes = { ...player.attributes };
  const keys = Object.keys(attributes) as (keyof typeof attributes)[];
  for (const key of keys) attributes[key] = clamp(attributes[key] + delta, 1, 99);
  return { ...player, attributes, overall: computeOverall(attributes, player.position) };
}

// ---------------------------------------------------------------------------
// Forward progression
// ---------------------------------------------------------------------------

/** Run the career forward until it needs the player again, or it ends. */
function progress(state: CareerState, world: World): CareerState {
  let current = state;
  // The bound is a safety net against a content bug producing an endless loop;
  // a full career is around 25 iterations.
  for (let guard = 0; guard < 400; guard += 1) {
    if (current.phase === 'summary' || current.pending) return current;

    if (current.cardsRemaining > 0) {
      const next = tryBuildEventDecision(current, world);
      if (next) return next;
      current = { ...current, cardsRemaining: 0 };
      continue;
    }

    current = playSeason(current, world);
    if (current.phase === 'summary') return current;

    // Refill event cards for the season ahead *before* any window can pause
    // the loop. When the refill sat at the bottom, answering a transfer or
    // loan card skipped straight into the next season with no events at all.
    current = { ...current, cardsRemaining: cardsForSeason(current.pace, current.seasons.length) };

    const loanReturn = tryCloseLoan(current, world);
    if (loanReturn) return loanReturn;

    // A season lost to a ban ends in one question and one only: where next.
    // No loan card, no event card between it and the window — a player coming
    // off a suspension has exactly one decision in front of him, and burying it
    // under a training-camp card would be absurd.
    const servedBan = current.seasons[current.seasons.length - 1]?.suspended ?? false;
    if (servedBan) current = { ...current, cardsRemaining: 0 };

    if (!servedBan) {
      const loanOffer = tryOfferLoan(current, world);
      if (loanOffer) return loanOffer;
    }

    const windowDecision = tryOpenTransferWindow(current, world);
    if (windowDecision) return windowDecision;

    const spending = trySpendingDecision(current);
    if (spending) return spending;
  }
  return current;
}

/**
 * Weigh a card's lasting consequences against the pace it is served at, so the
 * deck adds up to the same career at every pace.
 *
 * Only what *outlives the season* is scaled — ability, cash, the wage the
 * contract carries forward. A season-bound consequence is left exactly as
 * written: being suspended means suspended, a card that puts the league title
 * on the line puts it on the line, and `modifiers` reset at the end of every
 * season anyway, so those cannot compound across a career.
 *
 * Scaling here rather than at apply time keeps the number the card *shows*
 * identical to the number it delivers. Deterministic from the pace alone, so
 * replay is unaffected.
 */
/**
 * Turn a written effect into the one the career actually gets: money in weeks
 * of wage becomes money in euros, then the pace weighting is applied.
 *
 * Both halves happen here, in one function, called from the two places that
 * matter — where the card is *built* and where it is *applied*. That is the
 * whole reason it exists: if the two disagreed by a single euro the card would
 * be advertising a number the engine does not deliver.
 *
 * The floor keeps a card honest for a player who is not being paid yet. An
 * academy contract can carry a nominal wage, and a boot deal worth "forty
 * weeks" of nothing is a card with no content on it.
 */
const WAGE_FLOOR_FOR_CARDS = 4_000;

function resolveEffect(effect: Effect, wage: number, pace: Pace): Effect {
  if (effect.cashWeeks === undefined) return scaleEffectToPace(effect, pace);
  const { cashWeeks, ...rest } = effect;
  const weekly = Math.max(wage, WAGE_FLOOR_FOR_CARDS);
  return scaleEffectToPace(
    { ...rest, cash: roundMoney((effect.cash ?? 0) + cashWeeks * weekly) },
    pace,
  );
}

function scaleEffectToPace(effect: Effect, pace: Pace): Effect {
  const scale = PACE_EFFECT_SCALE[pace];
  if (scale === 1) return effect;

  const step = (value: number | undefined): number | undefined => {
    if (value === undefined || value === 0) return value;
    const scaled = Math.round(value * scale);
    // Never round a real consequence away to nothing.
    return scaled === 0 ? Math.sign(value) : scaled;
  };
  // A multiplier scales in the exponent: applying 1.2 twice as often, half as
  // hard, has to land in the same place.
  const factor = (value: number | undefined): number | undefined =>
    value === undefined || value === 1 ? value : Math.pow(value, scale);

  const attributes = effect.attributes
    ? (Object.fromEntries(
        Object.entries(effect.attributes).map(([key, value]) => [key, step(value)]),
      ) as Effect['attributes'])
    : undefined;

  return {
    ...effect,
    overall: step(effect.overall),
    deferredOverall: step(effect.deferredOverall),
    ...(attributes ? { attributes } : {}),
    ...(effect.cash === undefined ? {} : { cash: roundMoney(effect.cash * scale) }),
    wageMultiplier: factor(effect.wageMultiplier),
    /*
     * Development compounds, so it scales like the wage rather than like a
     * season-bound modifier. It was left alone as "single-season", which is
     * true of the multiplier and false of what it does: a deep career takes
     * four times as many of these and every one of them is a permanent point
     * of ability by the end. Deep finished 1.7 peak OVR clear of the other two
     * with the card scale already at 0.95.
     */
    growthMultiplier: factor(effect.growthMultiplier),
  };
}

/**
 * How many event cards this season, given the chosen pace.
 *
 * Below one card a season the cadence is a stride — a card every `1 / rate`
 * seasons — taken deterministically from the season index so a replay agrees
 * with the career it is replaying.
 *
 * The stride used to be hardcoded to three, which quietly made
 * `PACE_DECISIONS.quick` decorative: the constant said 0.34, and it would have
 * said the same thing had it read 0.5 or 0.9, because nothing consulted the
 * number. Changing the pace's advertised rate therefore changed the card on the
 * intro screen and nothing about the game.
 */
function cardsForSeason(pace: Pace, seasonIndex: number): number {
  const rate = PACE_DECISIONS[pace];
  if (rate >= 1) return Math.round(rate);
  const stride = Math.max(1, Math.round(1 / rate));
  return seasonIndex % stride === 0 ? 1 : 0;
}

function tryBuildEventDecision(state: CareerState, world: World): CareerState | null {
  const player = state.player;
  const contract = state.contract;
  if (!player || !contract) return null;

  const index = indexWorld(world, state.leagueMoves, state.managerChanges);
  // During a loan spell, daily life happens at the club he actually plays for.
  const club = index.club(state.loan?.clubId ?? contract.clubId);
  const league = index.leagueOfClub(club.id);
  const country = index.country(player.countryId);
  const lastSeason = state.seasons[state.seasons.length - 1] ?? null;

  // Pre-run next season's trophy engine on the exact channel playSeason will
  // use: whatever it says the club goes on to win is what a key-moment card
  // can put on the line. Same channel, same modifiers ⇒ same answer.
  const preview = simulateTrophies(rngFor(state.seed, `season:${state.seasons.length}:trophies`), {
    club,
    league,
    modifiers: state.modifiers,
    continental: continentalEntry(club, league, world),
    playerOverall: player.overall,
    field: trophyField(world),
    // Identical to what playSeason will pass, or the preview lies — and the
    // standing damping means a mid-table club almost never previews a title,
    // so the key-moment card cannot put an implausible trophy on the line.
    standing: clubStanding(club, league.id, world),
    // Same rule, same value as `playSeason` below — a preview that disagrees
    // with the season it previews is the one thing this call must never do.
    justPromoted: lastSeason !== null && lastSeason.promoted && lastSeason.clubId === club.id,
    hasLowerDivision: world.leagues.some(
      (l) => l.countryId === league.countryId && l.tier === league.tier + 1,
    ),
  });
  const pendingTrophy =
    (['continental_elite', 'continental_secondary', 'league', 'domestic_cup'] as const).find((t) =>
      preview.trophies.includes(t),
    ) ?? null;

  const context: EventContext = {
    player,
    club,
    league,
    country,
    world,
    role: lastSeason?.role ?? contract.promisedRole,
    seasonsAtClub: countSeasonsAtClub(state.seasons, club.id),
    lastSeason,
    seasonIndex: state.seasons.length,
    seasonYear: START_YEAR + state.seasons.length,
    runningDown: state.runningDown === true,
    cash: state.cash,
    chapters: state.chapters,
    wage: contract.wage,
    squad: buildSquad(world, club, state.year, 4),
    pendingTrophy,
    joinTargets: resolveJoinTargets(state, world, index, club, league),
    capped: state.seasons.some((s) => s.nationalStats !== null),
    switchTo: switchableNation(world, country),
  };

  const pool = eligibleEvents(context, state.seenEvents);
  if (pool.length === 0) return null;

  const rng = rngFor(state.seed, `event-pick:${state.step}:${state.seasons.length}`);
  /**
   * Two cards about leaving, back to back, read as one card asked twice.
   *
   * A transfer window has just put every club that wants him on the table and
   * he answered it; the next card being a Gulf approach makes the summer feel
   * like the game has one idea. This is a preference rather than a
   * rule — the loan clock and the forced move are exempt on purpose — so it is
   * a weight rather than a filter: a move card is a quarter as likely in a
   * season whose window has just closed, not impossible. Some careers really
   * are one long auction, and the deck should still be able to say so.
   */
  const windowJustClosed = state.lastWindowSeason === state.seasons.length;
  const event = weightedPick(rng, pool, (e) =>
    windowJustClosed && e.options.some((o) => o.outcomes.some((x) => x.effect.joinClub))
      ? e.weight * 0.25
      : e.weight,
  );
  if (!event) return null;

  const decision = buildEventDecision(event, context, state.step, state.pace);

  // Price any inline club move now, so the card shows a real destination with
  // real terms and the apply step honours exactly what was shown. A move whose
  // kind resolved two clubs becomes two options — asking to leave should be a
  // choice of where, not a single door. The card stays within its three-option
  // budget because the destinations fill only the slots the card has spare.
  const staying = decision.options.filter(
    (o) => !event.options.find((d) => `${event.id}:${d.id}` === o.id)?.outcomes[0]?.effect.joinClub,
  ).length;
  const moveBudget = Math.max(1, CARD_SLOTS - staying);
  const offerRng = rngFor(state.seed, `event-join:${state.step}:${event.id}`);
  const expanded: DecisionOption[] = [];

  for (const option of decision.options) {
    const def = event.options.find((o) => `${event.id}:${o.id}` === option.id);
    const kind = def?.outcomes[0]?.effect.joinClub;
    if (!kind) {
      expanded.push(option);
      continue;
    }
    const targets = context.joinTargets[kind].slice(0, moveBudget);
    if (targets.length === 0) {
      expanded.push(option);
      continue;
    }
    /*
     * Two doors, or one honest one.
     *
     * The transfer window throws away a suitor that another suitor beats on
     * club, role and wage alike; this card is the same market and needs the
     * same rule. Without it "get me out of here" opened onto Plymouth and
     * Nürnberg on the same squad role with Plymouth paying twice as much —
     * two doors, one room. Four hundred cards in four hundred careers were
     * that card. When the second destination adds nothing, the card names the
     * one that does.
     */
    const priced = targets.map((targetId) => {
      const target = index.club(targetId);
      const targetLeague = index.leagueOfClub(targetId);
      const promisedRole = promisableRole(player, target, targetLeague);
      return {
        targetId,
        target,
        targetLeague,
        promisedRole,
        wage: joinWage(offerRng, player, target, targetLeague, kind, contract.wage, promisedRole),
      };
    });
    const bid = (e: (typeof priced)[number]): Bid => ({
      stature: clubStature(e.target, e.targetLeague),
      role: e.promisedRole,
      wage: e.wage,
    });
    const offered = priced.filter((me, i) => !priced.some((other, j) => j !== i && outbids(bid(other), bid(me))));
    const doors = offered.length > 0 ? offered : priced.slice(0, 1);

    // Two destinations under one label would print the same line twice, so a
    // split card falls back to a shared line that names where he is going.
    const labelKey = doors.length > 1 && !def?.namesClub ? 'events.shared.joinClub' : option.labelKey;

    for (const { targetId, promisedRole, wage } of doors) {
      /*
       * What the club would really put in writing for him — the same answer a
       * transfer window gives, and nothing on top of it.
       *
       * There used to be a second cap here: `minRole('squad', …)` on every move
       * but the returning-hero card. It could only ever lower the promise, and
       * it lowered *all* of them, so a player good enough to be Real Madrid's
       * important player was offered a squad place by Real Madrid, on a wage
       * priced against a squad place, on every event card that moved him. Read
       * across a hundred careers the escape card printed "Squad Player" beside
       * a title race, a relegation fight and a Ligue 2 side alike — the one
       * number on the row that should tell them apart said the same thing every
       * time.
       *
       * `promisableRole` already is the honest ceiling: exactly the rung his
       * ability earns at that club, service included. A card cannot promise
       * more than that, and there is no reason it should promise less.
       */
      expanded.push({
        ...option,
        id: `${event.id}:join:${targetId}`,
        labelKey,
        clubId: targetId,
        params: { ...option.params, club: targetId },
        offer: {
          // Paid for the role the card actually promises. Pricing every event
          // move as a starting place overpaid the squad-player ones, and the
          // pace serving the most move cards collected that overpayment the
          // most often.
          wage,
          years: contractYearsFor(offerRng, player.age),
          fee: 0,
          signingBonus: 0,
          releaseClause: null,
          promisedRole,
        },
      });
    }
    // The card's own copy talks about the destination ("{club} are building a
    // superteam"), so a card with one named suitor points its param at him.
    // With two on offer the copy is generic and the current club is right.
    if (doors.length === 1) decision.params = { ...decision.params, club: doors[0]!.targetId };
  }
  decision.options = expanded;

  const isKeyMoment = pendingTrophy !== null &&
    (event.id === 'decisive_penalty' || event.id === 'decisive_save' || event.id === 'injury_at_peak');

  const next: CareerState = {
    ...state,
    cardsRemaining: state.cardsRemaining - 1,
    seenEvents: [...state.seenEvents, event.id],
    pending: decision,
  };
  if (isKeyMoment) next.pendingTrophy = pendingTrophy!;
  return next;
}

/**
 * What a club offers to prise a player out of his current one.
 *
 * Nobody leaves for a pay cut, and a card that says "they will treble your
 * wages" has to actually treble them — the first version priced these purely
 * off the destination club, so the Gulf offered £40k a week to a player
 * already on £47.7k while the copy promised three times the money.
 */
function joinWage(
  rng: Rng,
  player: Player,
  club: Club,
  league: League,
  kind: keyof EventContext['joinTargets'],
  currentWage: number,
  role: SquadRole,
): number {
  const market = wageOffer(rng, player, club, league, role);
  // The money move is the whole point of the Gulf card: it pays far over the
  // odds, which is exactly what makes the rest of the trade worth stating.
  const floor =
    kind === 'money'
      ? currentWage * float(rng, 2.8, 3.6)
      : currentWage * float(rng, 1.05, 1.35);
  if (kind === 'money') return roundMoney(Math.min(Math.max(market, floor), MAX_WAGE));
  // An ordinary move is a raise, but the buying club still has to justify it —
  // a mid-table side does not pay double its own top earner just because that
  // is what you were on. Without this ceiling the raise compounded with every
  // event move, so the pace that serves the most cards quietly became the
  // richest: peak season pay ran €9.7M on deep against €6.3M on standard, with
  // the wage rather than the football doing the climbing.
  return roundMoney(Math.min(Math.max(market, floor), market * 1.35, MAX_WAGE));
}

/**
 * The country a never-capped player could declare for instead.
 *
 * Same confederation — a grandparent does not move you between continents in
 * the eligibility rules — and meaningfully stronger than the one he has, so the
 * card is about ambition rather than a free upgrade nobody would think twice
 * about. Deterministic (the best available), because a random pick would make
 * the same career offer a different country on replay.
 */
function switchableNation(world: World, current: Country): string | null {
  let best: Country | null = null;
  for (const country of world.countries) {
    if (country.id === current.id) continue;
    if (country.confederation !== current.confederation) continue;
    if (country.reputation <= current.reputation + 12) continue;
    if (!best || country.reputation > best.reputation) best = country;
  }
  return best?.id ?? null;
}

/**
 * Destinations for events that move the player from inside the card.
 * Null when nothing plausible exists, which gates the event off entirely.
 */
function resolveJoinTargets(
  state: CareerState,
  world: World,
  index: WorldIndex,
  club: Club,
  league: League,
): EventContext['joinTargets'] {
  const player = state.player!;

  // Nobody leaves a club he has not played for. The transfer window is
  // structurally between seasons and cannot break this, but an event card can
  // fire in the first season at a new club, and half the deck carries an inline
  // move — so a player could sign in the summer, draw a card in October and be
  // gone before he had played a full season anywhere. Emptying the targets
  // gates every one of those cards off at once, because they all require a
  // destination to exist.
  //
  // Both clubs have to clear it, and on loan they are different clubs. `club`
  // here is where he turns out, which during a loan is the borrowing side; the
  // club a permanent move would take him away from is the one holding his
  // registration. Checking only the first let a player sign for a club, be
  // loaned out immediately, complete the loan season and be sold by an event
  // card — having never played a minute for the club selling him.
  const registration = state.contract?.clubId;
  const settled =
    countSeasonsAtClub(state.seasons, club.id) >= 1 &&
    (registration === undefined || countSeasonsAtClub(state.seasons, registration) >= 1);
  if (!settled) {
    return { rival: [], first: [], escape: [], foreign: [], money: [] };
  }

  const rng = rngFor(state.seed, `join-targets:${state.seasons.length}`);

  // Where he stands after last season, which is what decides whether asking to
  // leave is a step up or a step down. Without this a player could star for a
  // Champions League side all year and be shown the door to a smaller club.
  const form = formScore(marketFormOf(state.seasons[state.seasons.length - 1] ?? null));

  /**
   * Reputation, tilted toward — or away from — clubs bigger than his own, and
   * weighted by how much of the market a league actually commands.
   *
   * `leaguePull` is the same factor the transfer window uses. Without it these
   * cards drew from reputation alone, so the best Dutch and Portuguese clubs —
   * level on reputation with a mid-table Bundesliga side — turned up as often
   * as one, which is not the market the window shows one card earlier.
   */
  const ladder = (c: Club): number => {
    const step = clamp((c.reputation - club.reputation) / 14, -1.5, 1.5);
    return c.reputation * clamp(1 + step * form * 1.6, 0.2, 2.4) * leaguePull(index.leagueOfClub(c.id));
  };

  /**
   * The gate the transfer window applies to every suitor, applied here too.
   *
   * An event card is a second door onto the same market, and a rule enforced
   * on one door only is not a rule. Portugal, the Netherlands and Belgium bid
   * with their title race and their European places or not at all.
   */
  const mayBid = (c: Club): boolean => clubMayBid(c, index.leagueOfClub(c.id), world);

  /**
   * After a season worth talking about, the clubs well below him stop being
   * plausible suitors at all — unless taking them away leaves no choice, in
   * which case a door that exists beats a door that reads correctly.
   */
  const upward = (pool: readonly Club[]): readonly Club[] => {
    if (form <= 0.2) return pool;
    const raised = pool.filter((c) => c.reputation >= club.reputation - 6);
    return raised.length >= 2 ? raised : pool;
  };

  /**
   * Two distinct clubs from a pool, so "ask to leave" offers a real choice —
   * and two that belong to the same football world.
   *
   * The second pick is held to the first's league strength, the same rule the
   * transfer screen uses. Without it a card offered Ligue 1 next to Serie B and
   * asked which one you fancied. Spin-off clubs are exempt: the Gulf card is
   * deliberately from somewhere else.
   */
  const pickTwo = (pool: readonly Club[], weight: (c: Club) => number): string[] => {
    const first = weightedPick(rng, pool, weight);
    if (!first) return [];
    const firstLeague = index.leagueOfClub(first.id);
    const coherent = pool.filter((c) => {
      if (c.id === first.id) return false;
      const l = index.leagueOfClub(c.id);
      if (l.market === 'spinoff' || firstLeague.market === 'spinoff') return true;
      if (Math.abs(l.strength - firstLeague.strength) > WINDOW_SPREAD) return false;
      // Club standing as well as league, for the same reason the transfer
      // screen checks both: Sporting and Cremonese pass a league test and still
      // read as two different careers side by side.
      return Math.abs(c.reputation - first.reputation) <= WINDOW_REPUTATION_SPREAD;
    });
    const second = weightedPick(rng, coherent, weight);
    return second ? [first.id, second.id] : [first.id];
  };

  // Rival: a same-country club of comparable standing building something.
  const rivals = world.clubs.filter((c) => {
    if (c.id === club.id) return false;
    const l = index.leagueOfClub(c.id);
    return (
      l.countryId === league.countryId &&
      l.market === 'core' &&
      Math.abs(c.reputation - club.reputation) <= 10 &&
      c.wealth >= club.wealth - 10 &&
      mayBid(c) &&
      isRealisticTarget(player, c, l, 4) &&
      withinOfferReach(player, c, l)
    );
  });
  // One named rival: the card is about him, so a second would make no sense.
  const rival = weightedPick(rng, rivals, (c) => c.wealth);

  // First club: where the academy years were spent, if it would take him back.
  // Single by definition — there is only one club that raised him.
  const firstClubId = state.seasons[0]?.clubId ?? null;
  const firstClub = firstClubId ? index.club(firstClubId) : null;
  const first =
    firstClub &&
    firstClub.id !== club.id &&
    index.leagueOfClub(firstClub.id).market === 'core' &&
    mayBid(firstClub) &&
    // Sentiment does not sign players, and it especially does not sign ageing
    // ones. A small club will take its old boy back and put him in the side; a
    // big one has no use for a thirty-four-year-old who is now well short of
    // its standard, however much the crowd would enjoy the photograph.
    //
    // Gated on the role he would actually hold there rather than on a rating
    // tolerance, because that scales with the club by construction: the same
    // declining veteran clears a promoted second-tier side and fails at a
    // Champions League one, which is the whole of the rule.
    roleRank(roleCeiling(player, firstClub, index.leagueOfClub(firstClub.id))) >= roleRank('squad')
      ? [firstClub.id]
      : [];

  // Escape: anyone at his level who would take him tomorrow. This is the door
  // half the event deck needs — no door, no card.
  const escape = pickTwo(
    upward(
      world.clubs.filter((c) => {
        const l = index.leagueOfClub(c.id);
        return (
          c.id !== club.id &&
          l.market === 'core' &&
          mayBid(c) &&
          isRealisticTarget(player, c, l, 3) &&
          withinOfferReach(player, c, l)
        );
      }),
    ),
    ladder,
  );

  // Abroad: for the tax exile.
  const foreign = pickTwo(
    upward(
      world.clubs.filter((c) => {
        const l = index.leagueOfClub(c.id);
        return (
          l.countryId !== league.countryId &&
          l.market === 'core' &&
          mayBid(c) &&
          isRealisticTarget(player, c, l, 3) &&
          withinOfferReach(player, c, l)
        );
      }),
    ),
    ladder,
  );

  // The money: spin-off league clubs that would pay well over the odds.
  //
  // Age-gated here as well as on the card, because these ids feed every event
  // that carries a money move, not just the Gulf one. Without it a card could
  // route a twenty-nine-year-old to Shanghai through a door the transfer window
  // has closed — which is exactly how the age gate was being bypassed.
  const money =
    player.age >= SPINOFF_MIN_AGE
      ? pickTwo(
          // The card is titled "the offer from the Gulf", so the Gulf is what
          // it deals: Saudi clubs only (by rule). The other spin-off
          // leagues still arrive through the ordinary twilight window.
          world.clubs.filter((c) => {
            const l = index.leagueOfClub(c.id);
            return l.market === 'spinoff' && l.countryId === 'ksa';
          }),
          (c) => c.wealth,
        )
      : [];

  return { rival: rival ? [rival.id] : [], first, escape, foreign, money };
}

/**
 * Months of a season, August through May. Only *events* carry a month — a
 * transfer window is between seasons and has no matchday to sit on, which is
 * why one used to show up stamped "November".
 */
const SEASON_MONTHS = ['aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'] as const;
const LATE_MONTHS = ['apr', 'may'] as const;
/** Registration is only open in the summer and in January. */
const WINDOW_MONTHS = ['aug', 'jan'] as const;

function buildEventDecision(event: EventDef, context: EventContext, step: number, pace: Pace): Decision {
  // Key moments live in the run-in; everything else lands somewhere in the
  // season. Deterministic from event + step, so replays agree.
  const isKeyMoment = event.id === 'decisive_penalty' || event.id === 'decisive_save' || event.id === 'injury_at_peak';
  // A card that signs you for another club cannot happen in March: registration
  // is shut. Any event carrying a move is stamped with a window month, which is
  // the same rule the transfer screen already follows.
  const movesClub = event.options.some((o) => o.outcomes.some((x) => x.effect.joinClub));
  const month = movesClub
    ? WINDOW_MONTHS[(event.id.length + step) % WINDOW_MONTHS.length]!
    : isKeyMoment
      ? LATE_MONTHS[step % LATE_MONTHS.length]!
      : SEASON_MONTHS[(event.id.length * 5 + step * 3) % SEASON_MONTHS.length]!;

  /*
   * Which tournament the coming summer holds, so the club-versus-country card
   * can name it. "Your country wants you for a major tournament" is not
   * something anybody says — it is the World Cup, or the Euros, or the Asian
   * Cup, and which one it is changes what the choice is worth. The slot is
   * resolved to a real name on screen from the player's own nationality, the
   * same way the career table names his cup.
   */
  const tournament = tournamentThisYear(context.seasonYear);

  const shared = {
    club: context.club.id,
    month,
    // His own country, so an option that names it — "Stay with {country}" on the
    // grandfather card — resolves. It lived only on the decision params, not the
    // option params, so the *body* named the country and the *button* printed a
    // raw "{country}". Found in the 3,600-career read: options carry their own
    // params, and this was not among them.
    country: context.country.id,
    ...(context.pendingTrophy ? { trophy: context.pendingTrophy } : {}),
    ...(tournament ? { tournament } : {}),
    // The country he could declare for, so the card can name it and the effect
    // can find it later. Resolved here rather than at apply time because the
    // player must be able to read which country before he chooses.
    ...(context.switchTo ? { newCountry: context.switchTo } : {}),
  };

  return {
    id: `${event.id}|${step}`,
    kind: 'career_event',
    titleKey: `events.${event.id}.title`,
    bodyKey: `events.${event.id}.body`,
    params: { ...shared },
    options: event.options.map((option) => ({
      id: `${event.id}:${option.id}`,
      labelKey: `events.${event.id}.options.${option.id}`,
      params: { ...shared },
      outcomes: option.outcomes.map((outcome, i) => ({
        probability:
          outcome.odds !== undefined
            ? Math.round(outcome.odds * 100)
            : option.outcomes.length > 1 && i === 1 && option.outcomes[0]!.odds !== undefined
              ? Math.round((1 - option.outcomes[0]!.odds) * 100)
              : undefined,
        labelKey: `events.${event.id}.results.${outcome.effect.resultKey}`,
        tone: outcome.effect.resultTone,
        // The rule: every downside says why. Negative branches only — see
        // `OutcomeHint.whyKey`, and the content suite asserts one exists for
        // every negative outcome in the deck, in both languages.
        ...(outcome.effect.resultTone === 'negative'
          ? { whyKey: `events.${event.id}.why.${outcome.effect.resultKey}` }
          : {}),
        // What it actually does, in numbers — the prose is saved for the
        // result card, once the player has committed.
        /*
         * Money on an event card says what the money *is*.
         *
         * `describeEffect` can only ever produce "You spend €480K" — it sees an
         * amount and nothing else — and a run of cards read as charging a
         * player six figures without a word about what for. The card knows:
         * an agency's cut, a programme's fee, a cheque to a cause, the money a
         * boot deal pays. So a card that moves cash names it, and the content
         * suite fails the build on one that does not.
         */
        effects: retargetLines(event, describeEffect(resolveEffect(outcome.effect, context.wage, pace), {
          role: context.role,
          isGoalkeeper: context.player.position === 'GK',
          improving: stillImproving(context.player),
        })),
      })),
    })),
  };
}

/**
 * Swap the generic money line for the card's own.
 *
 * `effects.cash_up` / `effects.cash_down` can only say "you gain" or "you
 * spend", because that is all `describeEffect` is given. Every card that moves
 * money knows what the money is, and now says so: `events.<id>.income` and
 * `events.<id>.cost`. Same amount, same slot, a noun in front of it.
 */
function retargetLines(
  event: EventDef,
  effects: { key: string; params?: Record<string, string | number> }[],
): { key: string; params?: Record<string, string | number> }[] {
  return effects.map((effect) => {
    if (effect.key === 'effects.cash_up') return { ...effect, key: `events.${event.id}.income` };
    if (effect.key === 'effects.cash_down') return { ...effect, key: `events.${event.id}.cost` };
    // A card that is one afternoon says when the minutes change: afterwards.
    // See `EventDef.afterMatch`.
    if (event.afterMatch && effect.key === 'effects.minutes_up') {
      return { ...effect, key: 'effects.minutes_up_after' };
    }
    if (event.afterMatch && effect.key === 'effects.minutes_down') {
      return { ...effect, key: 'effects.minutes_down_after' };
    }
    return effect;
  });
}

/**
 * Does the manager go?
 *
 * Sackings follow results, so the odds key off what the club just did rather
 * than off a flat rate: relegation is close to a certainty, a season with no
 * silverware at a club expected to win some is a real risk, and a good season
 * is near-safe. On top of that every job has a natural half-life — nobody stays
 * a decade — so a long tenure raises the odds on its own.
 *
 * The new style is drawn from the five he does not already play, because a
 * change that changes nothing is not a change.
 */
function rollManagerChange(
  state: CareerState,
  world: World,
  club: Club,
  record: SeasonRecord,
): Record<string, ManagerStyle> | undefined {
  const rng = rngFor(state.seed, `manager:${club.id}:${state.seasons.length}`);
  const tenure = countSeasonsAtClub(state.seasons, club.id);

  let odds = 0.1 + Math.min(0.14, tenure * 0.025);
  if (record.relegated) odds = 0.75;
  else if (record.trophies.length > 0) odds = 0.05;
  else if (club.reputation >= 80) odds += 0.18;

  if (!chance(rng, odds)) return state.managerChanges;

  const styles = MANAGER_STYLES.filter((style) => style !== club.managerStyle);
  const next = styles[int(rngFor(state.seed, `manager-style:${club.id}:${state.seasons.length}`), 0, styles.length - 1)]!;
  return { ...state.managerChanges, [club.id]: next };
}

/**
 * A club that went up or down actually plays there next season.
 *
 * Recorded against the career rather than the world, which is shared and
 * immutable. Nothing else in the engine needs to know: `indexWorld` is built
 * with this map, so every question about which league a club is in — its wage
 * scale, its continental place, whether a window may offer it — answers with
 * the career's own history from the next season on.
 *
 * A club can only move to a division that exists in its own country. Where the
 * content pack has no tier to move into (a one-division country, or the bottom
 * of the pyramid), nothing happens: the season still reads "relegated" on the
 * record, because it did, but there is nowhere to put them.
 */
function applyDivisionChange(
  state: CareerState,
  world: World,
  club: Club,
  league: League,
  result: { relegated: boolean; promoted: boolean },
): Record<string, string> | undefined {
  if (!result.relegated && !result.promoted) return state.leagueMoves;
  const wantedTier = league.tier + (result.relegated ? 1 : -1);
  const destination = world.leagues.find(
    (l) => l.countryId === league.countryId && l.tier === wantedTier,
  );
  if (!destination) return state.leagueMoves;
  return { ...state.leagueMoves, [club.id]: destination.id };
}

/**
 * Consecutive seasons just played at a club.
 *
 * Counts where he actually turned out, so a loan spell resets service at the
 * parent — which is right: standing is the crowd knowing him and the manager
 * trusting him, and neither accrues to somebody who spent the year elsewhere.
 *
 * Exported because the UI shows what it buys and the offer audit checks against
 * it, and three private copies of this had already drifted into two different
 * answers.
 */
export function countSeasonsAtClub(seasons: readonly SeasonRecord[], clubId: string): number {
  let count = 0;
  for (let i = seasons.length - 1; i >= 0; i -= 1) {
    if (seasons[i]!.clubId === clubId) count += 1;
    else break;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Season simulation
// ---------------------------------------------------------------------------

function playSeason(state: CareerState, world: World): CareerState {
  const player = state.player!;
  const contract = state.contract!;
  const index = indexWorld(world, state.leagueMoves, state.managerChanges);
  // On loan, everything about the season — squad, league, trophies, wages,
  // coaching — comes from the club he is actually turning out for.
  const parentClub = index.club(contract.clubId);
  const club = state.loan ? index.club(state.loan.clubId) : parentClub;
  const league = index.leagueOfClub(club.id);
  const country = index.country(player.countryId);

  const seasonIndex = state.seasons.length;
  const channel = `season:${seasonIndex}`;
  const modifiers = state.modifiers;

  // ---- role -------------------------------------------------------------
  let role: SquadRole =
    modifiers.roleOverride ??
    state.loan?.guaranteedRole ??
    determineRole(player, {
      club,
      league,
      promisedRole: countSeasonsAtClub(state.seasons, club.id) === 0 ? contract.promisedRole : null,
      suspended: modifiers.suspended,
      seasonsAtClub: countSeasonsAtClub(state.seasons, club.id),
    });
  if (modifiers.roleShift !== 0) role = shiftRole(role, modifiers.roleShift);
  // Ability is the ceiling, and nothing above routes around it. An event card
  // that promotes you, a loan guarantee, a contract clause and a good run in
  // the side are all capped by what you are actually good enough to be here:
  // a 68-rated player does not become a Champions League club's important
  // player because a card said so. Suspension still overrides everything.
  if (!modifiers.suspended) {
    // A season on loan is capped by the same lift the card was written under —
    // `roleCapOnLoan`, two rungs, the standing a club obliged to play him
    // grants. Anywhere else it is one rung of in-season headroom or one for
    // long service. Using the ordinary cap here clawed back a promise the
    // engine itself had made: cards reading "Regular Starter — you would start
    // every week" resolved to impact-sub seasons.
    const served = countSeasonsAtClub(state.seasons, club.id);
    role = minRole(
      role,
      state.loan
        ? // The lift a borrowing club grants, which depends on where that club
          // sits in its own division — see `LOAN_LIFT`. Same function the card
          // was written with, so the guarantee and the season agree.
          roleCapOnLoan(player, club, league, clubStanding(club, league.id, world))
        : roleCap(player, club, league, served),
    );
    /*
     * The spin-off guarantee is absolute for the season he arrives. The offer
     * promised at least an Important Player (`promisableRole` floors it), and
     * nothing walks that back — not the ability cap, not an event card's role
     * shift. The signing IS the product; a Gulf club does not bench its
     * marquee arrival because a card said "fewer minutes". From the second
     * season ability decides again, like everywhere else.
     */
    if (league.market === 'spinoff' && served === 0 && roleRank(role) < roleRank('important')) {
      role = 'important';
    }
  } else {
    role = 'fringe';
  }
  /**
   * A debut season is a fringe season, whatever the ladder says.
   *
   * Two rules about a sixteen-year-old's first year were written at different
   * times and disagreed. `DEBUT_APPEARANCES` already caps him at three to eight
   * games — cup ties, dead rubbers, the last twenty minutes of a win — because
   * a boy who joins a small enough club clears its bar and the ladder would
   * otherwise hand him thirty appearances. But the *role* was still read off
   * that ladder, so the screen labelled him Squad Player or Impact Sub, and
   * `appearanceRange` says a squad player plays 25–39. A career opened by
   * telling the player he was in and around the side and then showing him five
   * games.
   *
   * He is in the academy. `fringe` is what that is, it is what the appearance
   * rule has always meant, and it costs him nothing: the bench penalty on
   * growth does not apply before 24, and form-driven growth needs ten games.
   */
  if (seasonIndex === 0) role = 'fringe';

  // ---- injury -----------------------------------------------------------
  const risk = injuryRisk(player, modifiers.injuryRiskMultiplier * trainingInjuryMultiplier(state.investments.trainingStaff));
  const injured = chance(rngFor(state.seed, `${channel}:injury`), risk);
  const injury = injured ? rollInjury(rngFor(state.seed, `${channel}:injury-type`), player) : null;

  // ---- club season ------------------------------------------------------
  const trophyResult = simulateTrophies(rngFor(state.seed, `${channel}:trophies`), {
    club,
    league,
    modifiers,
    continental: continentalEntry(club, league, world),
    playerOverall: player.overall,
    field: trophyField(world),
    // The standing of the division he is playing in this season — after a
    // promotion or relegation that is not the division the data assigns the
    // club, and relegation/promotion odds follow the real one.
    standing: clubStanding(club, league.id, world),
    // Where the club was a year ago. Must match the preview's value exactly.
    justPromoted: (() => {
      const previousSeason = state.seasons[state.seasons.length - 1] ?? null;
      return previousSeason !== null && previousSeason.promoted && previousSeason.clubId === club.id;
    })(),
    // Single-tier countries have no division to be relegated into; a season
    // stamped "relegated" that then stays put is a story fault.
    hasLowerDivision: world.leagues.some(
      (l) => l.countryId === league.countryId && l.tier === league.tier + 1,
    ),
  });

  /*
   * A banned season is a banned season. The record's contract — types.ts:
   * "no minutes, no silverware, no growth" — was only one-third enforced:
   * growth already froze, but the season still simulated 3–12 appearances for
   * a fringe role, and the trophy roll still put medals on a player who was
   * not allowed on the pitch. A 3,200-career screen-level sweep caught both
   * within its first hundred careers.
   */
  const clubStats = modifiers.suspended
    ? EMPTY_STATS
    : simulateSeason(rngFor(state.seed, `${channel}:stats`), {
        player,
        club,
        league,
        role,
        injuryWeeks: injury?.weeks ?? 0,
        continentalRounds: trophyResult.continentalRounds,
        temporaryDelta: modifiers.temporaryDelta,
        firstSeason: seasonIndex === 0,
      });

  // ---- international ----------------------------------------------------
  const national = simulateNationalTeam(rngFor(state.seed, `${channel}:national`), {
    player,
    country,
    league,
    year: state.year,
    suspended: modifiers.suspended,
    forceCallUp: modifiers.forceCallUp,
    skipCallUp: modifiers.skipCallUp,
  });

  const combined = national.stats ? addStats(clubStats, national.stats) : clubStats;
  // The club's season still happens around a banned player — it can still be
  // relegated or promoted, which is why `trophyResult` is computed either way —
  // but no medal is credited to a man who never played, and no award either.
  // No minutes, no medal. A season with nothing in the appearances column —
  // a transfer that never became a debut, a year lost to the treatment table —
  // used to still collect the club's silverware, which put a cup on a career
  // table beside a row reading 0 (0). The international half stands on its own
  // record: caps are counted separately and a tournament is a different season.
  const playedForTheClub = clubStats.appearances > 0;
  const trophies = modifiers.suspended
    ? []
    : [...(playedForTheClub ? trophyResult.trophies : []), ...national.trophies];

  const awards = modifiers.suspended
    ? []
    : simulateAwards(rngFor(state.seed, `${channel}:awards`), {
        player,
        league,
        club: clubStats,
        stats: combined,
        trophies,
        wonInternational: national.playedTournament,
      });

  // ---- money ------------------------------------------------------------
  const annualWage = contract.wage * 52;
  const endorsements = endorsementIncome(
    rngFor(state.seed, `${channel}:endorsements`),
    player,
    league.strength,
    state.investments.lifestyle,
  );
  const spend = annualSpend(state.investments, annualWage);
  const venture = ventureReturn(rngFor(state.seed, `${channel}:venture`), state.investments.ventures);
  // A doping ban suspends the pay as well as the football — clubs do not pay
  // banned players, and the sponsors are gone by the second headline. The
  // consequence line on the card says so ("a season lost, unpaid"); a card
  // must never hide a real cost. Upkeep still drains savings: the private
  // staff and the lifestyle are contracts of his own.
  const grossThisSeason = modifiers.suspended ? 0 : annualWage + endorsements;
  const netThisSeason = modifiers.suspended ? 0 : netOf(annualWage, country) + endorsements;

  // ---- development ------------------------------------------------------
  // Age and talent draw the cycle; what happens in the season nudges it — what
  // money buys, where he is coached, how he played, and whether he played at
  // all.
  const growth = developPlayer(rngFor(state.seed, `${channel}:growth`), player, {
    role,
    focus: null,
    cycle: state.developmentCycle,
    suspended: modifiers.suspended,
    multiplier:
      modifiers.growthMultiplier *
      trainingGrowthMultiplier(state.investments.trainingStaff) *
      lifestyleGrowthMultiplier(state.investments.lifestyle) *
      // Where he is actually being coached. Only bites while he is young; see
      // `coachingMultiplier`.
      coachingMultiplier(club.training, player.age) *
      // And how the season actually went. This is what connects tactical fit
      // to the player: fit moves effective ability, effective ability moves the
      // rating, and until now the rating moved nothing at all.
      formGrowthMultiplier(clubStats.rating, clubStats.appearances) *
      // Whether he played at all. See `minutesGrowthMultiplier`: this used to
      // bite only after his twenty-fourth birthday, which made a bench at a
      // giant free for a teenager, made the loan ladder decorative, and was
      // the reason chasing the badge beat reading the role.
      minutesGrowthMultiplier(role),
  });

  let nextPlayer: Player = {
    ...player,
    age: player.age + 1,
    attributes: growth.attributes,
    overall: growth.overall,
  };
  if (injury?.lasting) {
    // The lasting injury spends from the same one-season budget the ageing
    // curve already drew on: whatever the curve took this year, the injury can
    // only take the rest, so the two never sum past MAX_TOTAL_SEASON_DROP.
    const curveDrop = Math.max(0, player.overall - growth.overall);
    const injuryHit = Math.min(injury.lasting, Math.max(0, MAX_TOTAL_SEASON_DROP - curveDrop));
    if (injuryHit > 0) nextPlayer = nudgeOverall(nextPlayer, -injuryHit);
  }
  /*
   * The floor under a whole year, whatever combination dug it.
   *
   * The per-season caps bound the ageing curve and the injury — and a player
   * still fell 82 → 64 across one row of the career table, because event
   * cards move ability too and their cost lands *between* seasons, outside
   * both caps. What the table shows, and what a player reads, is last row's
   * rating against this row's — so that is the number the rule holds: from
   * one season's close to the next, no career loses more than
   * MAX_TOTAL_SEASON_DROP plus one card's worth.
   *
   * A position switch is exempt: 89 as a CAM genuinely is 67 as a CDM, the
   * table prints the new position on the row, and the floor "correcting" the
   * reprice was minting real attribute points out of thin air (and then
   * losing some of them to the 99 cap, so the row broke the floor anyway).
   */
  const lastRow = state.seasons[state.seasons.length - 1];
  if (
    lastRow !== undefined &&
    lastRow.position === player.position &&
    lastRow.overallEnd - nextPlayer.overall > MAX_TOTAL_SEASON_DROP + 1
  ) {
    nextPlayer = nudgeOverall(nextPlayer, lastRow.overallEnd - MAX_TOTAL_SEASON_DROP - 1 - nextPlayer.overall);
  }
  nextPlayer = { ...nextPlayer, marketValue: marketValue(nextPlayer, league.strength) };

  const pendingFee = state.pendingFee ?? 0;

  const squad = buildSquad(world, club, state.year, 4);

  const record: SeasonRecord = {
    index: seasonIndex,
    year: state.year + 1,
    age: player.age,
    clubId: club.id,
    leagueId: league.id,
    onLoanFrom: state.loan ? state.loan.parentClubId : null,
    position: player.position,
    role,
    overallStart: player.overall,
    // The rating he actually ends the season on — the ageing curve, the
    // lasting injury and the season-drop floor all included — so the row, the
    // status bar and the next season's opening figure are one number. It used
    // to record the growth path alone, which put an injury's cost on no row at
    // all and let the table show a cliff the floor had already forbidden.
    overallEnd: nextPlayer.overall,
    stats: clubStats,
    nationalStats: national.stats,
    trophies,
    awards,
    injuryWeeks: injury?.weeks ?? 0,
    injuryId: injury?.id ?? null,
    injuryLasting: injury?.lasting ?? 0,
    suspended: modifiers.suspended,
    earnings: grossThisSeason,
    transferFee: pendingFee,
    relegated: trophyResult.relegated,
    promoted: trophyResult.promoted,
    headlines: [],
    squad,
  };

  // The press reacts to the finished season, so this runs on the completed
  // record rather than on the pieces that made it.
  const previous = state.seasons[state.seasons.length - 1] ?? null;
  const previousLeague = previous ? index.league(previous.leagueId) : null;
  record.headlines = generateHeadlines(rngFor(state.seed, `${channel}:media`), {
    player,
    club,
    league,
    country,
    season: record,
    previous,
    outlets: world.outlets,
    mediaRelationship: 60,
    // "Took the money" is the drop in league quality, not the destination:
    // the same story fires for anyone who trades visibility for wages.
    // Never fired for a loan: dropping a level to play is development, not a
    // payday, and the old copy called every loanee a mercenary.
    tookTheMoney:
      previousLeague !== null &&
      previous!.clubId !== club.id &&
      state.loan === null &&
      previous!.onLoanFrom === null &&
      previousLeague.strength - league.strength >= 0.25,
  });


  const totals = {
    appearances: state.totals.appearances + combined.appearances,
    goals: state.totals.goals + combined.goals,
    assists: state.totals.assists + combined.assists,
    cleanSheets: state.totals.cleanSheets + combined.cleanSheets,
    trophies: state.totals.trophies + trophies.length,
    awards: state.totals.awards + awards.length,
    grossEarnings: state.totals.grossEarnings + grossThisSeason,
    netEarnings: state.totals.netEarnings + netThisSeason,
    transferFees: state.totals.transferFees,
    peakOverall: Math.max(state.totals.peakOverall, growth.overall),
    peakMarketValue: Math.max(state.totals.peakMarketValue, nextPlayer.marketValue),
    lastingInjuryDamage: state.totals.lastingInjuryDamage + (injury?.lasting ?? 0),
  };

  /*
   * The sacking, and whether it happened to *him*.
   *
   * `rollManagerChange` is asked about the club whose season this was, which on
   * loan is the borrowing club — a manager he will not be working under next
   * August. Only a change at the club he is contracted to is news he can act
   * on, and only that one is carried forward for the card to report.
   */
  const managerChanges = rollManagerChange(state, world, club, record);
  const employerId = contract.clubId;
  const styleBefore = state.managerChanges?.[employerId] ?? index.club(employerId).managerStyle;
  const styleAfter = managerChanges?.[employerId];
  const managerNews =
    styleAfter !== undefined && styleAfter !== styleBefore
      ? { clubId: employerId, from: styleBefore, to: styleAfter }
      : undefined;

  const next: CareerState = {
    ...state,
    year: state.year + 1,
    player: nextPlayer,
    developmentCycle: growth.cycle,
    contract: { ...contract, yearsRemaining: Math.max(0, contract.yearsRemaining - 1) },
    loan: state.loan ? { ...state.loan, seasonsRemaining: state.loan.seasonsRemaining - 1 } : null,
    cash: Math.max(0, state.cash + netThisSeason - spend - state.investments.ventures + venture.value),
    investments: { ...state.investments, ventures: venture.wiped ? 0 : state.investments.ventures },
    seasons: [...state.seasons, record],
    recentSeasons: [...state.recentSeasons, record],
    leagueMoves: applyDivisionChange(state, world, club, league, trophyResult),
    managerChanges,
    totals,
    // Modifiers are single-season by design; anything lasting became an
    // attribute change instead. A forced transfer is the exception:
    // it exists to be read by the window that opens *after* this season.
    modifiers: { ...EMPTY_MODIFIERS, forcedTransfer: modifiers.forcedTransfer },
  };
  delete next.pendingFee;
  delete next.pendingTrophy;
  if (managerNews) next.pendingManagerChange = managerNews;
  else delete next.pendingManagerChange;

  return maybeRetire(next, world);
}

/**
 * Seasons a player must have played at a club before anybody comes for him.
 *
 * Two. One season is "he has settled"; the window arriving after it reads as
 * the game not noticing he had just signed. Counted in seasons at the club, so
 * it holds however he arrived — a window, an event card, or a loan made
 * permanent.
 */
const SEASONS_BEFORE_INTEREST = 2;

/**
 * How much worse the new manager has to suit him before he is asked about it.
 *
 * `tacticalFit` spans 0.88–1.12, so three points of it is a quarter of the whole
 * range — a real change of idea about what he is for, not a shrug. Below that
 * the club still plays differently and the top bar still says so; it is simply
 * not a reason to hand a player a transfer window.
 */
const MANAGER_FIT_DROP = 0.03;

/**
 * The change of manager the player should be asked about, or null.
 *
 * A new manager is the most common reason a real career turns, and until now it
 * turned in silence: the style changed, tactical fit moved with it, the squad
 * role followed the season after, and nothing on any screen said a manager had
 * been sacked. This is the card that says so — what they played,
 * what they play now, and does he want out.
 *
 * It is asked here, inside the transfer window, rather than as an event card,
 * because every rule the answer needs already lives here: the renewal, the
 * run-down, the retirement option, the last-resort search, and the coherence
 * checks that keep a window one football world. An event card carrying club
 * offers would be a second, quietly different market.
 */
function qualifyingManagerNews(
  state: CareerState,
  world: World,
): { from: ManagerStyle; to: ManagerStyle } | null {
  const news = state.pendingManagerChange;
  const player = state.player;
  const contract = state.contract;
  if (!news || !player || !contract) return null;
  // He has moved since, or he is out on loan and the sacking is at a club he
  // will not be working under next August.
  if (state.loan || contract.clubId !== news.clubId) return null;

  const index = indexWorld(world, state.leagueMoves, state.managerChanges);
  const club = index.club(news.clubId);
  const league = index.leagueOfClub(club.id);
  // The same club under the manager who has just gone. `managerStyle` is the
  // only field that differs, and every fit calculation reads exactly that.
  const before: Club = { ...club, managerStyle: news.from };

  // Only when it costs him something. A manager who happens to suit him better
  // is good news, and good news does not need a transfer window attached: the
  // top bar says what the club plays and the season will say the rest.
  const lostARung = roleRank(roleCeiling(player, club, league)) < roleRank(roleCeiling(player, before, league));
  const worseFit = tacticalFit(player, club) < tacticalFit(player, before) - MANAGER_FIT_DROP;
  return lostARung || worseFit ? { from: news.from, to: news.to } : null;
}

function tryOpenTransferWindow(state: CareerState, world: World): CareerState | null {
  const contract = state.contract!;
  const player = state.player!;
  if (state.loan) return null;
  const expiring = contract.yearsRemaining <= 0;
  const managerNews = qualifyingManagerNews(state, world);

  // A window that only opened at expiry would make every single move a free
  // transfer, so no fee would ever be paid and the Valuation leaderboard would
  // read zero for everyone. Clubs also come in mid-contract for players who
  // have visibly outgrown where they are.
  if (!expiring && !state.modifiers.forcedTransfer && !managerNews) {
    // A window every single summer reads as noise. Interest needs a gap since
    // the last one, and comes at realistic odds even for an outgrown player.
    if (state.lastWindowSeason !== undefined && state.seasons.length - state.lastWindowSeason < 2) {
      return null;
    }
    /**
     * And a gap since he *arrived*, not merely since the last window.
     *
     * The counter above only moves when a transfer window opens, so a move made
     * from an event card — the rival's approach, the escape, the money offer —
     * left it untouched. A player who signed for Newcastle on one card was
     * shown the transfer window on the very next one, a single season into a
     * three-year deal, which reads as the game having forgotten he just moved.
     *
     * Counting seasons at the club covers every way of arriving, which is the
     * point: the rule is about how long he has been there, and it should not
     * depend on which kind of card put him there.
     */
    if (countSeasonsAtClub(state.seasons, contract.clubId) < SEASONS_BEFORE_INTEREST) return null;
    const scoped = indexWorld(world, state.leagueMoves, state.managerChanges);
    const club = scoped.club(contract.clubId);
    const outgrown = player.overall - starterBarOf(club, scoped.leagueOfClub(club.id));
    // The base was 5%, which meant a player performing exactly at his club's
    // level essentially never had anyone come for him — so the *only* window he
    // ever saw was his contract running out, and the market read as a series of
    // deadlines rather than a series of decisions. At 36% a plain window comes
    // round every few seasons, even inside a long contract. Being visibly too
    // good for your club still doubles it.
    const odds = clamp(0.36 + outgrown * 0.035, 0, 0.62);
    if (!chance(rngFor(state.seed, `interest:${state.seasons.length}`), odds)) return null;
  }

  const index = indexWorld(world, state.leagueMoves, state.managerChanges);
  const club = index.club(contract.clubId);
  const league = index.leagueOfClub(club.id);
  const rng = rngFor(state.seed, `window:${state.seasons.length}`);

  /**
   * The two different things "he is on his way out" can mean.
   *
   * `cycleOver` is the club's own decision not to keep him — the non-renewal
   * rule, and this game's honest failure state. It belongs
   * at the *end* of a contract: a club that has stopped picking a player does
   * not renew him. It cannot tear up the years he has left, and reading the two
   * as one thing meant it did: a player three years into a deal, dropped for a
   * season, opened a window headed "leave, or leave".
   *
   * `pushedOut` is an event that has already happened — the fallout card, the
   * transfer request — and that one really does end his time at the club
   * whatever the contract says, because the card said so.
   */
  const cycleOver = endOfCycle(state, state.pace);
  const pushedOut = state.modifiers.forcedTransfer;

  // A club that still rates a player always tries to keep him — there is no
  // world in which a young starter is simply allowed to walk without an offer.
  // The only reasons a renewal is missing are that he is being pushed out, or
  // that he has fallen too far below the standard of the squad.
  const wantsToKeep = !pushedOut && !cycleOver && isRealisticTarget(player, club, league, 3);
  /**
   * A club opens renewal talks near the end of a deal, not in the middle of it.
   *
   * Newcastle offered a five-year renewal to a player with **three years still
   * to run**, which is not how contracts work and is not what this project says
   * it does — "contracts that renew only near expiry" is in the design compass.
   * It also quietly broke the run-down route: running a deal down is gated to
   * the final year, so a mid-contract card offered the renewal without the
   * alternative, and the wealth route's signature move was invisible exactly
   * when the renewal was there to be refused.
   *
   * Mid-contract the club still keeps him — he simply stays on the deal he
   * signed, which `buildTransferDecision` now offers as its own option.
   */
  const nearExpiry = contract.yearsRemaining <= RENEWAL_MAX_YEARS_LEFT;
  const renewal =
    wantsToKeep && nearExpiry
      ? buildRenewalOffer(rng, player, club, league, countSeasonsAtClub(state.seasons, club.id))
      : null;

  const window = (lastResort: boolean) =>
    buildTransferDecision({
      rng,
      context: {
        player,
        world,
        leagueOf: (clubId) => index.leagueOfClub(clubId),
        clubOf: (clubId) => index.club(clubId),
        contract,
        exclude: [club.id],
        lastSeason: state.seasons[state.seasons.length - 1] ?? null,
        lastResort,
      },
      currentClub: club,
      currentLeague: league,
      mustMove: (expiring && !wantsToKeep) || pushedOut,
      renewal,
      /**
       * Staying is staying — the deal he signed, with no new terms behind it.
       *
       * Deliberately **not** conditioned on the club's enthusiasm. He is under
       * contract: a club that has gone off him cannot make him leave in the
       * middle of a deal, it can only decline to renew at the end of one. Both
       * earlier versions of this line got that wrong in the same direction —
       * first by gating on `wantsToKeep`, then by folding the non-renewal rule
       * into `forcedOut` — and both produced a window with nothing but exits on
       * it for a player with years still to run.
       *
       * What the card does with it is `buildTransferDecision`'s business: a
       * renewal replaces it, and in the final year running the deal down says
       * the same thing with the free transfer attached.
       */
      canStayOnCurrentDeal: !expiring && !pushedOut,
      // Walking away is a decision only a veteran gets to make. Offering it at
      // thirty-two turned a bad season into the end of a career.
      allowRetire: player.age >= MIN_RETIREMENT_AGE,
    });

  let decision = window(false);
  const suitors = (built: Decision) => built.options.filter((o) => o.id.startsWith('transfer:')).length;

  /**
   * Nobody in his band wants him. Before the retirement age that is a drop
   * down the pyramid or a move to a league that pays instead of asking
   * questions — not the end. The engine looks again with the floor removed.
   *
   * The second look is triggered by **too few suitors**, not by no options at
   * all. Measured on the option list it never fired for a player his club still
   * wanted: the renewal filled the card, the card was therefore not empty, and
   * a window that had produced nobody to join went out with a single button on
   * it. What the retry is for is finding somebody to join, so that is what it
   * asks — and it now asks whenever the card came up short of a full three
   * (fewer than two suitors beside the renewal), which is how a manager-change
   * window on a thin market found its missing second offer instead of settling
   * for a two-button card. It is accepted only when it genuinely adds suitors.
   */
  // Below the retirement age an empty card is always retried — the
  // register-him-somewhere fallback exists precisely so a player too young to
  // retire is never forced out by a window nobody attended. At 35 and over the
  // empty window is allowed to stand: a veteran the whole market has stopped
  // calling retires, which is the one honest way the `frozen_out` ending — and
  // `retirement.no_offers` — can still happen.
  if (player.age < MIN_RETIREMENT_AGE && (suitors(decision) < 2 || decision.options.length === 0)) {
    const wider = window(true);
    if (suitors(wider) > suitors(decision) || decision.options.length === 0) decision = wider;
  }
  if (decision.options.length === 0) {
    return finishCareer(state, world, 'retirement.no_offers');
  }
  /**
   * Still nobody, and he does not have to move: no window at all.
   *
   * A card headed "the transfer window is open" whose only answer is to stay
   * where he is is not a decision, it is a tap. Interest was rolled and the
   * market then produced nobody worth printing — the honest telling of that is
   * a summer in which nothing happened. `lastWindowSeason` is deliberately not
   * stamped, because no window opened: he is eligible again next summer rather
   * than being made to serve a cooling-off period for a card he never saw.
   */
  if (suitors(decision) === 0 && !pushedOut && !expiring) return null;

  /*
   * Same card, different news.
   *
   * When a manager change is what opened it, the window says so and names both
   * systems — "they pressed for the ball; he wants it played out" — instead of
   * the generic "clubs are asking about you". Everything under the headline is
   * unchanged, which is the point of building it here: the offers, the renewal,
   * the run-down and the retirement option are the same rules answering a
   * different question.
   */
  const headline: Decision = managerNews
    ? {
        ...decision,
        titleKey: 'decisions.manager_change.title',
        bodyKey: 'decisions.manager_change.body',
        params: {
          ...decision.params,
          club: club.id,
          from: managerNews.from,
          to: managerNews.to,
        },
      }
    : decision;

  return { ...state, lastWindowSeason: state.seasons.length, pending: headline };
}

/** Length of the first youth contract. */
const ACADEMY_CONTRACT_YEARS = 4;

/**
 * "End of cycle": the club has stopped picking him and, from 26 on, stops
 * renewing him too. One season as a non-picked substitute is enough; two
 * seasons of scraps also does it. This is the non-renewal rule, and it is the
 * game's honest failure state — the career does not end, it just stops being
 * his to control.
 */
function endOfCycle(state: CareerState, pace: Pace): boolean {
  const player = state.player;
  if (!player || player.age < 26) return false;
  // How many bad seasons it takes scales with how many cards a pace deals. One
  // dismal season out of a career you only touch every third year is much less
  // evidence than one out of a career you steer every season.
  const patience = NON_RENEWAL_PATIENCE[pace];
  const recent = state.seasons.slice(-patience.frozen);
  if (recent.length === 0) return false;
  const last = recent[recent.length - 1]!;
  if (recent.length >= patience.frozen && recent.slice(-patience.frozen).every((s) => s.role === 'fringe')) {
    return true;
  }
  const benched = state.seasons.slice(-patience.benched);
  return (
    benched.length >= patience.benched &&
    benched.every((s) => roleRank(s.role) <= roleRank('impact_sub')) &&
    last !== undefined
  );
}

/**
 * How many bad seasons a club tolerates before it stops renewing, by pace.
 *
 * Quick deals a card every second season, so each season is a much larger share
 * of what the player actually saw; being frozen out for two of them is a
 * lifetime. Deep deals two cards a season and the player has far more chances
 * to fix it, so it can afford to be stricter.
 */
const NON_RENEWAL_PATIENCE: Record<Pace, { frozen: number; benched: number }> = {
  quick: { frozen: 2, benched: 3 },
  standard: { frozen: 1, benched: 2 },
  deep: { frozen: 1, benched: 2 },
};

/** The two-or-three clubs a window would put in front of him right now. */
function trySpendingDecision(state: CareerState): CareerState | null {
  /*
   * A young man's decision about the first money he has ever had.
   *
   * The card says so — "there is more coming in than you know what to do with"
   * — and it was firing at a median age of **thirty-two**, because the bar was
   * two million euros and a twenty-two-year-old does not have two million
   * euros. A thirty-four-year-old being asked what to do with his first
   * savings is the card describing somebody else's career.
   *
   * So the bar is what a young professional actually banks, and the window is
   * the years the decision belongs to. What he buys — his own trainers, or a
   * life — is a bet on the fifteen years after it, which is precisely why it
   * has to be taken before those years, not during the last of them.
   */
  const seasons = state.seasons.length;
  const wealthy = state.cash > 400_000;
  const youngEnough = (state.player?.age ?? 99) < 25;
  const maxedOut =
    state.investments.trainingStaff === 3 && state.investments.lifestyle === 3;
  if (!wealthy || !youngEnough || maxedOut) return null;
  if (seasons % 2 !== 0) return null;

  return {
    ...state,
    pending: buildSpendingDecision(
      rngFor(state.seed, `spending:${seasons}`),
      state.cash,
      (state.contract?.wage ?? 0) * 52,
      state.investments,
    ),
  };
}

export { indexWorld, type WorldIndex };

/** Replay a career from its seed and recorded decisions. Used to verify scores. */
export function replay(
  seed: string,
  pace: Pace,
  identity: IdentityInput,
  optionIds: readonly string[],
  world: World,
): CareerState {
  let state = selectIdentity(createCareer(seed, pace), identity, world);
  for (const optionId of optionIds) {
    if (!state.pending) break;
    state = decide(state, optionId, world);
  }
  return state;
}
