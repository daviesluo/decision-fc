/**
 * Turning an effect into something the player can actually read.
 *
 * A card prints the mechanical consequence on the option itself — "70% +3 OVR
 * / 30% −2 OVR" — rather than a sentence about how it feels. That is the right
 * way round: prose belongs in the *result*, once the dice have landed. Before
 * choosing, the player needs numbers.
 *
 * Everything here is derived from the `Effect` object, so a card can never
 * advertise a consequence the engine will not deliver, and a newly written
 * event gets accurate labels without anyone writing copy for them.
 */

import type { SquadRole } from '../types.js';
import { roleRank } from '../model/role.js';
import type { Effect } from './effects.js';

export interface ConsequenceLabel {
  key: string;
  params?: Record<string, string | number>;
}

/**
 * Spell out what an option's outcome does, in words rather than arithmetic.
 * Order matters: the biggest, most career-shaping consequence first.
 */
export function describeEffect(
  effect: Effect,
  context: {
    role: SquadRole;
    isGoalkeeper: boolean;
    /**
     * Is the development curve still adding to him?
     *
     * A growth multiplier means two different things depending on where he is
     * on that curve, and the line said the first one to everybody: a
     * thirty-three-year-old taking his coaching badges was told he would
     * "develop faster this season". Past the peak the same multiplier buys a
     * slower decline, and that is what it says.
     */
    improving: boolean;
  },
): ConsequenceLabel[] {
  const out: ConsequenceLabel[] = [];

  if (effect.joinClub) out.push({ key: 'effects.transfer' });
  if (effect.suspended) out.push({ key: 'effects.suspended' });

  // A cost that is handed back later reads as one idea — "ability down for
  // now" — not as two lines of bookkeeping that cancel out.
  const temporaryLoss =
    effect.overall !== undefined &&
    effect.overall < 0 &&
    effect.deferredOverall !== undefined &&
    effect.deferredOverall === -effect.overall;

  if (temporaryLoss) {
    out.push({ key: 'effects.ovr_temp', params: { value: Math.abs(effect.overall!) } });
  } else {
    if (effect.overall) {
      out.push({
        key: effect.overall > 0 ? 'effects.ovr_up' : 'effects.ovr_down',
        params: { value: Math.abs(effect.overall) },
      });
    }
    if (effect.deferredOverall) {
      out.push({ key: 'effects.ovr_back', params: { value: Math.abs(effect.deferredOverall) } });
    }
  }
  if (effect.temporary) {
    out.push({ key: 'effects.ovr_temp', params: { value: Math.abs(effect.temporary) } });
  }

  /*
   * Attribute deltas are advertised in the only currency the player can see.
   *
   * The attribute strip left the header, so "shooting +2" promised a change to
   * a number that exists nowhere on screen (changed 2026-08-02). Content
   * now writes these effects as `overall`; if an `attributes` effect ever
   * returns, its deltas are summed here into one OVR-shaped line rather than
   * named — the engine still applies them per-attribute underneath.
   */
  const attributeSum = Object.values(effect.attributes ?? {}).reduce((n, d) => n + (d ?? 0), 0);
  if (attributeSum !== 0) {
    out.push({
      key: attributeSum > 0 ? 'effects.ovr_up' : 'effects.ovr_down',
      params: { value: Math.max(1, Math.round(Math.abs(attributeSum) / 2)) },
    });
  }

  // Playing time in plain words: what you become, not a percentage.
  if (effect.role) {
    const change = roleRank(effect.role) - roleRank(context.role);
    out.push({
      key: change > 0 ? 'effects.role_up' : change < 0 ? 'effects.role_down' : 'effects.role_same',
      params: { role: effect.role },
    });
  } else if (effect.roleShift) {
    out.push({ key: effect.roleShift > 0 ? 'effects.minutes_up' : 'effects.minutes_down' });
  }

  if (effect.changePosition) out.push({ key: 'effects.new_position' });

  // Every competition the option touches, named. Collapsing them into one
  // line printed only the first: the "what do you play for this year" card
  // showed "much better chance of silverware" against "worse chance of
  // silverware", which is not a choice anybody would agonise over — the
  // second option was in fact trading the league away for Europe, and said so
  // nowhere.
  const competitions: [number | undefined, string][] = [
    [effect.leagueTrophyMultiplier, 'league'],
    [effect.cupTrophyMultiplier, 'cup'],
    [effect.continentalTrophyMultiplier, 'continental'],
  ];
  const moved = competitions.filter(([m]) => m !== undefined && m !== 1);
  const allUp = moved.every(([m]) => m! > 1);
  const allDown = moved.every(([m]) => m! < 1);
  if (moved.length > 0 && (allUp || allDown)) {
    /*
     * Every competition moving the same way is one idea, so it gets one line.
     * Naming all three read as a list of trophies rather than as a
     * consequence, and the list is the same three every time.
     *
     * The line is now about the *season*, not about the title, whoever he plays
     * for. It used to split on whether the club was a contender and say "a
     * better chance of silverware" for those — which reads as nonsense over a
     * mid-table or relegation-threatened side, and even over a promotion-chasing
     * one, since they are not fighting for a trophy. "A better season" is true
     * of every club in every division, hence the ruling: the general
     * wording, not the title wording, everywhere.
     */
    out.push({ key: allUp ? 'effects.form_up' : 'effects.form_down' });
  } else {
    /*
     * Different directions is the one case where the competitions have to be
     * named: the option is trading one for another, and that trade is the
     * whole decision. Collapsing it printed only the first, so a card offering
     * the league in exchange for Europe read as a straight gain.
     */
    for (const [multiplier, competition] of moved) {
      out.push({
        key: multiplier! > 1 ? 'effects.odds_up_named' : 'effects.odds_down_named',
        params: { competition },
      });
    }
  }

  if (effect.forcePendingTrophy) out.push({ key: 'effects.trophy_won' });
  if (effect.skipPendingTrophy) out.push({ key: 'effects.trophy_lost' });
  if (effect.forceCallUp) out.push({ key: 'effects.call_up' });
  if (effect.skipCallUp) out.push({ key: 'effects.no_call_up' });
  if (effect.forceTransfer) out.push({ key: 'effects.must_move' });
  /* The card's body names the country; the consequence line never said that
     choosing it is what ties him to it for good. */
  if (effect.switchNation) out.push({ key: 'effects.switch_nation' });

  /*
   * Money, development, fitness and the wage — the four things a card could
   * change without ever saying so.
   *
   * `Effect` opens with "everything here is something the player can *see*
   * happen … there is deliberately no invisible meter", and four of its fields
   * were breaking that promise. Playing the game found them: the charity match
   * read as "risk an injury" against "do nothing", because the €150K the
   * second option costs was nowhere on the card; the sports-science programme
   * read as a free +2, because its €300K and its lower injury risk were both
   * silent; the boot deal's whole point — the money — never appeared. Ten
   * cards moved cash invisibly, four changed how fast the player developed,
   * two changed his wage.
   *
   * `{cash}` is a number in euros and stays one: the engine has no currency,
   * and the screen formats it in whatever the player has chosen.
   */
  if (effect.cash) {
    out.push({
      key: effect.cash > 0 ? 'effects.cash_up' : 'effects.cash_down',
      params: { cash: Math.abs(effect.cash) },
    });
  }
  if (effect.wageMultiplier && effect.wageMultiplier !== 1) {
    out.push({
      key: effect.wageMultiplier > 1 ? 'effects.wage_up' : 'effects.wage_down',
      params: { value: Math.round(Math.abs(effect.wageMultiplier - 1) * 100) },
    });
  }
  if (effect.growthMultiplier && effect.growthMultiplier !== 1) {
    const better = effect.growthMultiplier > 1;
    out.push({
      key: context.improving
        ? better
          ? 'effects.growth_up'
          : 'effects.growth_down'
        : better
          ? 'effects.decline_slower'
          : 'effects.decline_faster',
    });
  }
  if (effect.injuryRiskMultiplier && effect.injuryRiskMultiplier !== 1) {
    out.push({
      key: effect.injuryRiskMultiplier > 1 ? 'effects.injury_risk_up' : 'effects.injury_risk_down',
      params: { value: Math.round(Math.abs(effect.injuryRiskMultiplier - 1) * 100) },
    });
  }
  if (effect.dopingBan) out.push({ key: 'effects.doping_ban' });

  // Nothing mechanical to report: the caller falls back to the written line,
  // which says more than "nothing changes" ever could.
  return out;
}
