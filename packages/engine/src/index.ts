/**
 * @bg/engine — deterministic football career simulation.
 *
 * The whole engine is pure: no DOM, no platform APIs, no clock, no I/O. That is
 * what lets it run unchanged in a browser, in a Node balance sweep, in a server
 * function verifying a leaderboard submission, and — if the WeChat build ends
 * up on the Mini Game canvas runtime — there too.
 *
 * Typical use:
 *
 *   let state = createCareer(makeSeed(Date.now()), 'standard')
 *   state = selectIdentity(state, identity, world)
 *   while (state.pending) state = decide(state, chosenOptionId, world)
 *   // state.phase === 'summary', state.retirement holds the verdict
 */

export * from './types.js';
export * from './rng.js';

export {
  POSITION_WEIGHTS,
  computeOverall,
  positionGroup,
  isGoalkeeper,
  startingAttributes,
} from './model/attributes.js';

export {
  coachingMultiplier,
  developPlayer,
  rollDevelopmentProfile,
} from './model/growth.js';
export {
  marketValue,
  transferFee,
  wageOffer,
  signingBonus,
  netOf,
  roundMoney,
  annualSpend,
  endorsementIncome,
  trainingGrowthMultiplier,
  trainingInjuryMultiplier,
  lifestyleGrowthMultiplier,
} from './model/finance.js';
export {
  tacticalFit,
  styleFit,
  FIT_NEAR_BEST,
  starterBar,
  determineRole,
  appearanceRange,
  roleRank,
  shiftRole,
  // Exported for `engine.test.ts`, which asserts the squad ladder directly.
  roleCeiling,
  // Exported for the loan flow's tests: the card's promise and the season's
  // ceiling are the same function, and that is the property worth pinning.
  roleCapOnLoan,
  LOAN_GUARANTEE,
  promisableRole,
  roleForDelta,
  nextRung,
  ROLE_ORDER,
  isRealisticTarget,
  withinOfferReach,
  adjacentPositions,
} from './model/role.js';
export { INJURY_TYPES, injuryRisk, rollInjury } from './model/injury.js';
export {
  marketLevel,
  marketFormOf,
  formScore,
  spinoffAllowed,
  leagueInMarket,
  marketWeight,
  clubStanding,
  clubMayBid,
  outsideBigFive,
  type ClubStanding,
  standingFactor,
  suitorFloor,
  loanDestinationWeight,
  type MarketContext,
  type MarketForm,
} from './model/market.js';

export { simulateSeason, addStats, EMPTY_STATS } from './sim/season.js';
export {
  simulateTrophies,
  continentalEntry,
  trophyField,
  leagueOdds,
  cupOdds,
  continentalOdds,
  type TrophyField,
} from './sim/trophies.js';
export { simulateAwards } from './sim/awards.js';
export { simulateNationalTeam, callUpThreshold } from './sim/national.js';
export { generateHeadlines, type Headline, type MediaContext } from './sim/media.js';
export { buildSquad } from './sim/squad.js';
export {
  statLineFor,
  isPercentage,
  EMPTY_SEASON_STATS,
} from './sim/statline.js';
export { loanOffered, loanWentWell, loanGrowthModifier } from './career/loans.js';
export {
  crestFor,
  type CrestSpec,
  type CrestShape,
  type CrestPattern,
  type CrestDevice,
} from './model/crest.js';

export { CARD_SLOTS, suitableStyles } from './career/decisions.js';
export { EVENTS, eligibleEvents, type EventDef, type EventContext } from './career/events.js';
export type { Effect } from './career/effects.js';
export { computeLegacy, resolveEnding, ENDINGS } from './career/summary.js';
export {
  createCareer,
  selectIdentity,
  countSeasonsAtClub,
  currentRole,
  decide,
  replay,
} from './career/machine.js';
export { indexWorld, type WorldIndex } from './career/world-index.js';
