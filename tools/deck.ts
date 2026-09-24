/**
 * Is every card worth reading?
 *
 * `pnpm fairness` already holds the floor: a card must have two or three
 * options, an option must not print an outcome the engine cannot produce, and
 * the odds shown must be the odds rolled. All three are about *honesty*. None
 * of them asks the question a player asks, which is **would anybody ever pick
 * the other one**.
 *
 * That question needs the options in one currency, so this converts every
 * effect a card can carry into a single number of career points and compares
 * them. The exchange rates are rough on purpose — the tool is looking for
 * options that are three times better than their alternative, not for ones
 * that are five per cent better — and they are stated in `WORTH` so an
 * argument about them is an argument about a constant.
 *
 * It reports four shapes:
 *
 *   DOMINATED   one option beats another so heavily that picking the loser is
 *               a mistake, and a card with a mistake on it is not a decision.
 *   FLAT        every option lands in the same place and none of them is a
 *               gamble. A card nobody can play wrong is a tap.
 *   FREE LUNCH  the best option on the card, and it cannot cost anything.
 *               Nothing to weigh, whatever the size of the gap.
 *   FREE ROLL   a gamble whose worst branch is no worse than the safe option.
 *               There is nothing to weigh.
 *   NO PREMIUM  a gamble worth exactly what the safe option is worth. Risk
 *               without a reason is a coin flip with nothing on it.
 *
 * None of these is automatically a bug — `mysterious_substance` is *meant* to
 * be a temptation with a terrible tail, and `decisive_penalty` is *meant* to be
 * a coin flip because that is what a penalty is. So this prints rather than
 * fails, and the argument goes in the commit message.
 *
 *   npx tsx tools/deck.ts
 */
import { EVENTS } from '../packages/engine/src/career/events.js';
import type { Effect } from '../packages/engine/src/career/effects.js';

/**
 * What one of each thing is worth, in career points.
 *
 * Anchored on ability, because ability is what the whole game is denominated
 * in: it sets the squad place, the wage follows the place, and the boards
 * follow both. A rung of squad standing for one season is worth a bit less
 * than a permanent point of ability, and a week's wage is worth very little
 * next to either — which is the honest ordering, and the reason the money
 * cards had to be counted in weeks before they meant anything at all.
 */
const WORTH = {
  /** A permanent point of OVR. */
  overall: 10,
  /** A point handed back after the current period. */
  deferred: 7,
  /** A point lost for one season only. */
  temporary: 4,
  /** One rung of squad standing, for one season. */
  rung: 6,
  /** A single named attribute point — narrower than an OVR point. */
  attribute: 4,
  /** One week of the current wage. */
  week: 0.35,
  /** A season at ×1.1 development, which is roughly a third of a point. */
  growthTenth: 3,
  /** A season at ×1.1 injury risk. */
  injuryTenth: 2.5,
  /** A ten-per-cent change to the wage the contract carries forward. */
  wageTenth: 6,
  /** Losing the season: fringe, no development, no national squad. */
  suspended: 55,
  /** A doping ban, which is the first line of the obituary. */
  dopingBan: 40,
  /** A trophy multiplier moved by 0.5 in one competition. */
  trophyHalf: 9,
  /** Winning or losing the silverware the pre-simulation flagged. */
  pendingTrophy: 22,
  /** A tournament with the national side. */
  callUp: 12,
  /** Changing clubs — neither good nor bad on its own; the offer is priced. */
  transfer: 0,
  /** Being made to move next summer. */
  forcedMove: 8,
  /** Learning a new position, which buys years at the far end. */
  newPosition: 6,
} as const;

function worth(effect: Effect): number {
  let total = 0;
  total += (effect.overall ?? 0) * WORTH.overall;
  total += (effect.deferredOverall ?? 0) * WORTH.deferred;
  total += (effect.temporary ?? 0) * WORTH.temporary;
  total += (effect.roleShift ?? 0) * WORTH.rung;
  for (const delta of Object.values(effect.attributes ?? {})) total += (delta ?? 0) * WORTH.attribute;
  total += (effect.cashWeeks ?? 0) * WORTH.week;
  // A flat euro figure is priced at a mid-career wage, which is the only way to
  // compare it with the cards that are written in weeks.
  total += ((effect.cash ?? 0) / 60_000) * WORTH.week;
  if (effect.growthMultiplier) total += (effect.growthMultiplier - 1) * 10 * WORTH.growthTenth;
  if (effect.injuryRiskMultiplier) total -= (effect.injuryRiskMultiplier - 1) * 10 * WORTH.injuryTenth;
  if (effect.wageMultiplier) total += (effect.wageMultiplier - 1) * 10 * WORTH.wageTenth;
  if (effect.suspended) total -= WORTH.suspended;
  if (effect.dopingBan) total -= WORTH.dopingBan;
  for (const multiplier of [
    effect.leagueTrophyMultiplier,
    effect.cupTrophyMultiplier,
    effect.continentalTrophyMultiplier,
  ]) {
    if (multiplier !== undefined) total += (multiplier - 1) * 2 * WORTH.trophyHalf;
  }
  if (effect.forcePendingTrophy) total += WORTH.pendingTrophy;
  if (effect.skipPendingTrophy) total -= WORTH.pendingTrophy;
  if (effect.forceCallUp) total += WORTH.callUp;
  if (effect.skipCallUp) total -= WORTH.callUp;
  if (effect.forceTransfer) total -= WORTH.forcedMove;
  if (effect.changePosition) total += WORTH.newPosition;
  return total;
}

interface Judged {
  id: string;
  /** Expected value across the option's branches. */
  expected: number;
  /** The worst branch, which is what a cautious player is really weighing. */
  worst: number;
  best: number;
  gamble: boolean;
}

const judge = (event: (typeof EVENTS)[number]): Judged[] =>
  event.options.map((option) => {
    const branches = option.outcomes.map((outcome) => ({
      value: worth(outcome.effect),
      odds: outcome.odds ?? 1,
    }));
    const expected =
      branches.length === 2
        ? branches[0]!.value * branches[0]!.odds + branches[1]!.value * (1 - branches[0]!.odds)
        : branches[0]!.value;
    return {
      id: option.id,
      expected,
      worst: Math.min(...branches.map((b) => b.value)),
      best: Math.max(...branches.map((b) => b.value)),
      gamble: branches.length === 2,
    };
  });

/** A card that moves a club is priced by the offer on it, not by this table. */
const CARRIES_AN_OFFER = (event: (typeof EVENTS)[number]) =>
  event.options.some((o) => o.outcomes.some((x) => x.effect.joinClub));

/**
 * Cards whose value this table cannot see, and why.
 *
 * Both are real decisions whose worth depends on something outside the effect:
 * which competition *this* club could actually win, and which of two national
 * sides would actually pick him. Scoring them at zero and calling them flat
 * would be the tool being wrong out loud, which is worse than the tool being
 * quiet.
 */
const PRICED_ELSEWHERE = new Set(['club_priority', 'foreign_grandfather']);

/**
 * Which kinds of thing an option moves.
 *
 * Two options that land on the same number are only a non-decision if they get
 * there the same way. Standing against development, money against fitness, a
 * fortnight of the close season against a summer of rest — those are trades,
 * and a player weighing them is doing exactly what the card wants. Comparing
 * only the totals called five of the best cards in the deck flat.
 */
function kinds(option: ReturnType<typeof judgeRaw>): string {
  return [...option].sort().join('/');
}

function judgeRaw(effects: Effect[]): Set<string> {
  const out = new Set<string>();
  for (const effect of effects) {
    if (effect.overall || effect.deferredOverall || effect.temporary || effect.attributes) out.add('ability');
    if (effect.role || effect.roleShift) out.add('standing');
    if (effect.cash || effect.cashWeeks) out.add('money');
    if (effect.wageMultiplier) out.add('wage');
    if (effect.growthMultiplier) out.add('growth');
    if (effect.injuryRiskMultiplier) out.add('fitness');
    if (effect.suspended || effect.dopingBan) out.add('ban');
    if (
      effect.leagueTrophyMultiplier ||
      effect.cupTrophyMultiplier ||
      effect.continentalTrophyMultiplier ||
      effect.forcePendingTrophy ||
      effect.skipPendingTrophy
    ) {
      out.add('silverware');
    }
    if (effect.forceCallUp || effect.skipCallUp || effect.switchNation) out.add('country');
    if (effect.forceTransfer || effect.changePosition) out.add('career');
  }
  return out;
}

const rows: string[] = [];
const counts = { dominated: 0, flat: 0, freeLunch: 0, freeRoll: 0, noPremium: 0, fine: 0 };

for (const event of EVENTS) {
  if (CARRIES_AN_OFFER(event) || PRICED_ELSEWHERE.has(event.id)) continue;
  const options = judge(event);
  const shapes = event.options.map((option) => kinds(judgeRaw(option.outcomes.map((o) => o.effect))));
  const best = options.reduce((a, b) => (b.expected > a.expected ? b : a));
  const worstOption = options.reduce((a, b) => (b.expected < a.expected ? b : a));
  const spread = best.expected - worstOption.expected;
  const anyGamble = options.some((o) => o.gamble);

  const line = (kind: string, note: string) => {
    rows.push(
      `  ${kind.padEnd(11)} ${event.id.padEnd(24)} ${note}\n` +
        options
          .map(
            (o) =>
              `${' '.repeat(14)}${o.id.padEnd(22)} ev ${o.expected.toFixed(1).padStart(6)}` +
              (o.gamble ? `  [${o.worst.toFixed(0)} … ${o.best.toFixed(0)}]` : ''),
          )
          .join('\n'),
    );
  };

  /*
   * An option that cannot cost you anything and is worth more than every
   * other one on the card. A gamble that cannot lose is one shape of it; a
   * *certainty* that only gives is the other, and the second is the one that
   * kept getting through — "learn the new position" bought a rung and a new
   * position against an option that did nothing at all, and the gap was only
   * twelve points, so a threshold written for dominated options never saw it.
   * Size is not the test. Having nothing to weigh is the test.
   */
  /*
   * The rule, and the strict version is the right one: **an option has
   * to be able to cost you something.** Not "the gap is small", not "the other
   * option is a different kind of good" — if the best thing on the card has no
   * branch that hurts, the card has a right answer and is not a decision.
   *
   * A softer version of this test was tried, exempting cards whose alternative
   * was worth something rather than nothing. It passed "fly the family out" —
   * money and faster development, against an option that only loses — and
   * one playthrough found it, which is the answer on whether the
   * softer version was good enough.
   */
  const freeLunch = options.find(
    (o) => o.worst >= 0 && options.every((other) => other === o || other.expected < o.expected),
  );

  // A safe option nobody would take against a gamble that cannot lose to it.
  const freeRoll = options.find(
    (o) => o.gamble && options.some((other) => other !== o && !other.gamble && o.worst >= other.expected),
  );
  const noPremium = options.find(
    (o) =>
      o.gamble &&
      options.some(
        (other) => other !== o && !other.gamble && Math.abs(o.expected - other.expected) < 2 && o.worst < other.expected,
      ),
  );

  if (spread >= 18) {
    counts.dominated += 1;
    line('DOMINATED', `${best.id} is ${spread.toFixed(0)} points clear of ${worstOption.id}`);
  } else if (!anyGamble && spread < 4 && new Set(shapes).size === 1) {
    counts.flat += 1;
    line('FLAT', `every option lands within ${spread.toFixed(1)} points, the same way, and nothing is a gamble`);
  } else if (freeLunch) {
    counts.freeLunch += 1;
    line('FREE LUNCH', `${freeLunch.id} is the best option and cannot cost anything`);
  } else if (freeRoll) {
    counts.freeRoll += 1;
    line('FREE ROLL', `${freeRoll.id} cannot do worse than the safe option`);
  } else if (noPremium) {
    counts.noPremium += 1;
    line('NO PREMIUM', `${noPremium.id} risks ${(noPremium.expected - noPremium.worst).toFixed(0)} points for nothing`);
  } else {
    counts.fine += 1;
  }
}

console.log('\n  IS EVERY CARD WORTH READING?\n');
console.log(rows.join('\n\n'));
console.log(
  `\n  ${counts.fine} cards are a real weighing-up · ${counts.dominated} dominated · ` +
    `${counts.flat} flat · ${counts.freeLunch} free lunch · ${counts.freeRoll} free roll · ` +
    `${counts.noPremium} no premium\n`,
);
