/**
 * The vocabulary an event option speaks in.
 *
 * Events never touch career state directly. They return an `Effect`, the
 * resolver applies it, and every change a decision can make to a career is
 * therefore visible in one type — which is what keeps a large content pack
 * reviewable.
 *
 * Everything here is something the player can *see* happen: ability, minutes,
 * silverware odds, where he plays. There is deliberately no invisible meter.
 */

import type { AttributeKey, SquadRole } from '../types.js';

export interface Effect {
  /** Signed OVR nudge, spread across position-relevant attributes. */
  overall?: number;
  /**
   * Ability handed back after the current period — the other half of a card
   * that costs you something now to pay you later ("learn a new position").
   */
  deferredOverall?: number;
  /** OVR penalty that applies to the next season only, then lapses. */
  temporary?: number;
  /** Direct attribute adjustments, when an event targets something specific. */
  attributes?: Partial<Record<AttributeKey, number>>;
  /**
   * Cash delta in euros; negative spends.
   *
   * Prefer `cashWeeks` on anything a card offers or charges. A flat figure is
   * a fortune to a seventeen-year-old on £600 a week and pocket change to the
   * same player at thirty on £300,000 — the same card either decides the
   * decade or is not read at all.
   */
  cash?: number;
  /**
   * Cash delta counted in weeks of the player's current wage, resolved against
   * that wage before the card is built — so what the option shows is what the
   * option pays, at every stage of a career.
   *
   * Weeks are also how footballers talk about money, which is why the numbers
   * on these cards are chosen in weeks rather than converted from euros.
   */
  cashWeeks?: number;
  role?: SquadRole;
  roleShift?: number;
  leagueTrophyMultiplier?: number;
  cupTrophyMultiplier?: number;
  continentalTrophyMultiplier?: number;
  growthMultiplier?: number;
  injuryRiskMultiplier?: number;
  suspended?: boolean;
  /** Force a transfer decision at the end of this season. */
  forceTransfer?: boolean;
  /** Key-moment override: win/lose the trophy the pre-simulation flagged. */
  forcePendingTrophy?: boolean;
  skipPendingTrophy?: boolean;
  /** National-team overrides for the club-vs-country card. */
  forceCallUp?: boolean;
  skipCallUp?: boolean;
  /**
   * Move clubs from inside the event card. The concrete destination is
   * resolved when the decision is built — see `EventContext.joinTargets`.
   */
  joinClub?: 'rival' | 'first' | 'escape' | 'foreign' | 'money';
  /** Caught doping: a permanent mark on the career. */
  dopingBan?: true;
  /**
   * Switch national team to the country resolved on the card.
   *
   * Only ever offered to a player who has never been capped, because a cap
   * ties you in real football too — which is what makes it a now-or-never
   * decision rather than a free optimisation.
   */
  switchNation?: true;
  /** Advance a storyline so its later chapters become eligible. */
  advanceChapter?: string;
  /** Wage multiplier applied to the current contract, e.g. a successful holdout. */
  wageMultiplier?: number;
  /** Change the player's position; the OVR recalculation is the real cost. */
  changePosition?: boolean;
  /** i18n key summarising what happened, shown on the result card. */
  resultKey: string;
  resultTone: 'positive' | 'negative' | 'neutral';
}
