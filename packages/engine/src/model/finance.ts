/**
 * Market value, transfer fees, wages, tax and spending.
 *
 * Money is a scoring line of its own, not a decoration. Two of the three
 * leaderboards read straight out of this file, and the routes that maximise
 * them are meant to conflict with the route that maximises trophies — a free
 * transfer is the best possible wage deal and the worst possible fee.
 */

import type { Club, Country, Investments, League, Player, SquadRole } from '../types.js';
import { clamp, float, remap, type Rng } from '../rng.js';

/** Market value in euros by OVR band, interpolated between anchors. */
const VALUE_ANCHORS: [overall: number, value: number][] = [
  [40, 25_000],
  [50, 120_000],
  [55, 300_000],
  [60, 700_000],
  [65, 1_800_000],
  [70, 4_500_000],
  [75, 11_000_000],
  [80, 28_000_000],
  [85, 62_000_000],
  [90, 110_000_000],
  [95, 175_000_000],
  [99, 260_000_000],
];

/** Peak resale age is the early twenties; value collapses past 32. */
function ageMultiplier(age: number): number {
  if (age <= 18) return 1.45;
  if (age <= 21) return 1.35;
  if (age <= 24) return 1.15;
  if (age <= 27) return 1.0;
  if (age <= 29) return 0.85;
  if (age <= 31) return 0.62;
  if (age <= 33) return 0.38;
  if (age <= 35) return 0.18;
  return 0.07;
}

export function marketValue(player: Player, leagueStrength: number): number {
  let base = VALUE_ANCHORS[0]![1];
  for (let i = 0; i < VALUE_ANCHORS.length - 1; i += 1) {
    const [lowOvr, lowValue] = VALUE_ANCHORS[i]!;
    const [highOvr, highValue] = VALUE_ANCHORS[i + 1]!;
    if (player.overall <= highOvr) {
      base = remap(player.overall, lowOvr, highOvr, lowValue, highValue);
      break;
    }
    base = highValue;
  }
  // Playing in a weak league suppresses value even at identical OVR — the
  // mechanism behind the Saudi trap.
  const exposure = 0.55 + leagueStrength * 0.45;
  return roundMoney(base * ageMultiplier(player.age) * exposure);
}

/**
 * Transfer fee. Contract length is the dominant term: letting a deal run down
 * is how a player converts club revenue into personal signing bonuses, at the
 * cost of the Value leaderboard.
 */
export function transferFee(
  rng: Rng,
  player: Player,
  contractYearsRemaining: number,
  buyer: Club,
  sellerStance: 'eager' | 'normal' | 'unwilling',
  releaseClause: number | null,
): number {
  if (contractYearsRemaining <= 0) return 0; // free transfer

  if (releaseClause !== null) return roundMoney(releaseClause);

  const yearsFactor =
    contractYearsRemaining >= 4 ? 1.25 :
    contractYearsRemaining === 3 ? 1.0 :
    contractYearsRemaining === 2 ? 0.75 : 0.45;

  const buyerFactor = remap(buyer.wealth, 20, 100, 0.8, 1.6);
  const stanceFactor = sellerStance === 'eager' ? 0.7 : sellerStance === 'unwilling' ? 1.8 : 1.0;
  const noise = float(rng, 0.9, 1.15);

  // The factor stack can theoretically reach ~4.8×; cap the result at a bit
  // over triple market value and an absolute record-fee ceiling so a 99-rated
  // 24-year-old cannot generate a billion-euro transfer.
  const raw = player.marketValue * yearsFactor * buyerFactor * stanceFactor * noise;
  return roundMoney(Math.min(raw, player.marketValue * 3.2, 350_000_000));
}

/**
 * The weekly wage a footballer can be paid, at either end.
 *
 * Exported because the money-move floors are applied *after* `wageOffer` has
 * already clamped, and a floor that ignores the ceiling is not a floor, it is a
 * new ceiling: multiplying a €700k earner's wage by three produced a €2.1M/week
 * squad player in Saudi Arabia. Every path that raises a wage clamps here.
 */
export const MIN_WAGE = 250;
export const MAX_WAGE = 1_800_000;

/**
 * Weekly wage on offer. Club wealth matters more than club reputation here,
 * which is exactly why a mid-table Saudi side can outbid a European giant.
 */
export function wageOffer(
  rng: Rng,
  player: Player,
  club: Club,
  league: League,
  role: SquadRole,
): number {
  // Value-to-wage conversion: roughly 0.55% of market value per week at the top.
  const fromValue = (player.marketValue / 1000) * remap(club.wealth, 20, 100, 0.9, 2.4);
  // The ability floor scales with the club's means: a second-division side
  // cannot pay a good player star money just because he is good.
  const floor = remap(player.overall, 45, 99, 400, 90_000) * remap(club.wealth, 20, 100, 0.3, 1.15);
  const roleFactor = ROLE_WAGE_FACTOR[role];
  // Steeper than linear, because the money in football is. A flat
  // `0.75 + strength * 0.5` only separated the Premier League from the 2.
  // Bundesliga by 30%, so a wealthy second-division club quoted the same wage
  // as a mid-table top-flight one and the two offers read as interchangeable.
  //
  // `wageIndex` is then what a league *pays* as opposed to what it is worth on
  // the pitch, and the two genuinely come apart: England pays over the odds at
  // both its levels, Ligue 1 pays under them, and the Gulf pays like nowhere
  // else on earth. Without it, moving to La Liga and moving to the Premier
  // League were financially the same decision.
  const leagueFactor = (0.45 + Math.pow(league.strength, 1.5) * 0.95) * (league.wageIndex ?? 1);
  const raw = Math.max(fromValue, floor) * roleFactor * leagueFactor * float(rng, 0.92, 1.12);
  return roundMoney(clamp(raw, MIN_WAGE, MAX_WAGE));
}

/**
 * What each rung of the squad ladder is worth in wage. A star is paid to be the
 * reason people come; a fringe player is paid to be available.
 */
const ROLE_WAGE_FACTOR: Record<SquadRole, number> = {
  star: 1.25,
  important: 1.08,
  regular: 0.95,
  squad: 0.72,
  impact_sub: 0.56,
  fringe: 0.45,
};

/**
 * Signing bonus. Free agents capture much of what would have been the fee.
 *
 * The fee lifts the bonus but cannot run away with it. A record fee at a club
 * that pays modest wages — €214M to PSV for a player on €25k a week, which the
 * offer audit found once in 15,435 — produced a bonus of seven times his annual
 * salary. That is not a contract, it is the fee term leaking into a number that
 * is fundamentally a multiple of what a player earns. Four years' wage is the
 * ceiling, comfortably inside the audit's five.
 */
export function signingBonus(wage: number, fee: number, isFreeTransfer: boolean): number {
  const base = wage * 26;
  if (isFreeTransfer) return roundMoney(base * 3.2);
  return roundMoney(Math.min(base * 0.8 + fee * 0.04, wage * 52 * 4));
}

export function netOf(gross: number, country: Country): number {
  return Math.round(gross * (1 - country.taxRate));
}

// ---------------------------------------------------------------------------
// Spending
// ---------------------------------------------------------------------------

/** Yearly cost of each spending tier, as a share of gross annual wage. */
const TIER_COST = [0, 0.06, 0.14, 0.25];

/**
 * The share a tier costs, clamped to the table.
 *
 * Exported so the savings card can print what the next tier will actually take
 * out of a wage rather than saying "a slice of it, every year", which is not a
 * price and cannot be weighed against anything.
 */
export function tierCost(tier: number): number {
  return TIER_COST[clamp(Math.round(tier), 0, TIER_COST.length - 1)] ?? 0;
}

export function annualSpend(investments: Investments, annualWage: number): number {
  const tiers =
    (TIER_COST[investments.trainingStaff] ?? 0) +
    (TIER_COST[investments.lifestyle] ?? 0);
  return Math.round(annualWage * tiers);
}

/** Training staff is the main way money converts back into playing ability. */
export function trainingGrowthMultiplier(tier: number): number {
  return [1.0, 1.09, 1.19, 1.3][clamp(Math.round(tier), 0, 3)]!;
}

export function trainingInjuryMultiplier(tier: number): number {
  return [1.0, 0.85, 0.72, 0.6][clamp(Math.round(tier), 0, 3)]!;
}

/** Lifestyle buys exposure and endorsement value, and costs professionalism. */
export function lifestyleGrowthMultiplier(tier: number): number {
  return [1.0, 0.97, 0.92, 0.85][clamp(Math.round(tier), 0, 3)]!;
}

export function lifestyleExposureBonus(tier: number): number {
  return [0, 4, 9, 15][clamp(Math.round(tier), 0, 3)]!;
}

/**
 * Endorsement income. Scales with visibility rather than pure ability, so a
 * good-looking career in a big league out-earns a better one in an obscure
 * league — which is how it works.
 */
export function endorsementIncome(
  rng: Rng,
  player: Player,
  leagueStrength: number,
  lifestyleTier: number,
): number {
  if (player.overall < 68) return 0;
  const abilityTerm = Math.pow(Math.max(0, player.overall - 66) / 33, 2.2);
  const visibility = 0.4 + leagueStrength * 0.6;
  const lifestyleTerm = 1 + lifestyleExposureBonus(lifestyleTier) / 100;
  return roundMoney(abilityTerm * 26_000_000 * visibility * lifestyleTerm * float(rng, 0.8, 1.25));
}

/** Ventures compound when they work and go to zero when they do not. */
export function ventureReturn(rng: Rng, staked: number): { value: number; wiped: boolean } {
  if (staked <= 0) return { value: 0, wiped: false };
  if (rng() < 0.07) return { value: 0, wiped: true };
  return { value: roundMoney(staked * float(rng, 0.95, 1.35)), wiped: false };
}

/**
 * Round to a readable figure so the UI never shows €1,234,567.
 *
 * **Money that is being spent rounds too.** This clamped at zero — `Math.max(0,
 * value)` — which was written for a wage or a fee, where a negative number is
 * nonsense. Then `resolveEffect` started converting a card's `cashWeeks` into
 * euros through here, and every card that *costs* money silently became free:
 * fourteen weeks of a €4k wage went in as −€56,000 and came out as **0**, so
 * `describeEffect` printed no cost (zero is falsy) and the resolver charged
 * none.
 *
 * That is the worst shape of bug this game has, twice over: a downside written
 * into the deck that never happened, and a card that therefore reads as free
 * upside. It is the fault found by hand on the family card — "把家人
 * 接过来那张卡也是只有好处没有downside" — and the reason `pnpm deck` could not
 * see it either, because the deck priced the same zero.
 *
 * Rounding is now applied to the magnitude and the sign put back.
 */
export function roundMoney(value: number): number {
  const v = Math.abs(value);
  const sign = value < 0 ? -1 : 1;
  if (v >= 10_000_000) return sign * Math.round(v / 1_000_000) * 1_000_000;
  if (v >= 1_000_000) return sign * Math.round(v / 100_000) * 100_000;
  if (v >= 100_000) return sign * Math.round(v / 10_000) * 10_000;
  if (v >= 10_000) return sign * Math.round(v / 1_000) * 1_000;
  return sign * Math.round(v / 100) * 100;
}
