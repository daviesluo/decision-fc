/**
 * Is the game fair?
 *
 * Three questions, each one asked because a plausible-sounding answer turned
 * out to be wrong when it was finally measured.
 *
 *   **Are the printed odds the real odds?** Every gamble states a percentage
 *   and the whole game rests on that number being true. Reading the resolver is
 *   not proof; this plays thousands of careers and compares what the card said
 *   against what then happened — card by card, and pooled over every gamble.
 *   Rolls the mercy rule forced are left out of that tally, and no career may
 *   ever see four red gambles in a row.
 *
 *   **Is the starting choice fair?** The one unfairness a player can never
 *   recover from is a creation screen where an option is quietly worse. Same
 *   seeds, same policy, only the choice varies — so any gap is the choice.
 *   This is the check that found the real problem: before the position-relative
 *   output term, a striker scored 3089 on the achievements board where a
 *   centre-back scored 1536, on identical seeds played identically.
 *
 *   **Can a card show an outcome the engine cannot produce?** The resolver
 *   reads two outcomes and the first one's odds. Anything else a content author
 *   writes — a third outcome, or a second with no odds on the first — prints on
 *   the card and never happens.
 *
 * Usage:
 *   pnpm fairness                 # the report
 *   pnpm fairness --assert        # …and fail the build if it has slipped
 *   pnpm fairness --par           # regenerate OUTPUT_PAR for summary.ts
 */

import { WORLD } from '../packages/content/src/index.js';
import { EVENTS } from '../packages/engine/src/career/events.js';
import {
  CARD_SLOTS,
  ENDINGS,
  createCareer,
  decide,
  indexWorld,
  mulberry32,
  roleRank,
  selectIdentity,
  PLAYABLE_POSITIONS,
  type CareerState,
  type Position,
} from '../packages/engine/src/index.js';
import { COUNTRIES } from '../packages/content/src/data/countries.js';

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const RUNS = Number(arg('runs') ?? 250);
const ODDS_RUNS = Number(arg('odds-runs') ?? 2500);
const ASSERT = process.argv.includes('--assert');
/**
 * Careers per policy for the endings sweep.
 *
 * Much larger than the other sweeps, and the number is not arbitrary: the
 * rarest ending in the game is `goat` at **0.105%** of careers (20,000-career
 * balance sweep), so a thousand careers expects one of them and proves nothing
 * when it sees none. 2,500 per policy expects five, which is enough to tell
 * "unreachable" from "rare" — and the sweep is seeded, so the answer is the
 * same on every run of a given engine. A failure here is a real change, never
 * a bad afternoon.
 *
 * It caught the deck expansion the first time it ran at 800: `goat` vanished
 * from the sample while the balance sweep still measured it at 0.105%. The
 * sample was too small, not the ending unreachable — which is exactly the
 * distinction this number exists to make.
 */
const ENDING_RUNS = Number(arg('ending-runs') ?? 2500);
const PAR = process.argv.includes('--par');

const indexFor = (s: CareerState) => indexWorld(WORLD, s.leagueMoves, s.managerChanges);
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};
const failures: string[] = [];
const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);

// ---------------------------------------------------------------------------
// 1. Cards that promise something the engine cannot deliver
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 0. Does choosing an option do what the option said?
// ---------------------------------------------------------------------------

/**
 * The audit that exists because three of these shipped at once, on one card.
 *
 * `applyLoanReturn` handled `buyout:` and let every other option fall through
 * to "went back to the parent club". So on the loan-expiry card the two priced
 * transfer offers did nothing, the next loan spell did nothing, and the return
 * option ignored the wage and contract length printed on its own face. A player
 * chose Lyon, twice, and was handed his old club with no explanation.
 *
 * None of it was catchable by anything else in this repository. There was no
 * type error — the options were well-formed. Nothing threw. No test covered it,
 * because a test has to be written for the branch somebody forgot to write. It
 * took a real player noticing his career had not moved.
 *
 * So the check is a property rather than a list of cases, and it is asked of
 * **every option of every decision** across many careers, by forking the state
 * and applying each one:
 *
 *   1. An option that names a club puts you at that club. That single rule is
 *      what the Lyon bug broke.
 *   2. An option that prints terms gives you at least those terms. Never worse
 *      than the card said — better is allowed, because a player under contract
 *      cannot be made worse off by a loan ending.
 *   3. An option that names the club you are already at does not move you.
 *
 * It is exhaustive by construction: a new decision kind, a new option prefix or
 * a new resolver branch is covered the moment it can appear in a career, with
 * nobody having to remember to add it here.
 */
console.log('\n  DOES CHOOSING AN OPTION DO WHAT THE OPTION SAID?');
{
  const broken = new Map<string, string>();
  let optionsChecked = 0;

  /** Where the engine considers the player to be playing right now. */
  const clubOf = (s: CareerState) => s.loan?.clubId ?? s.contract?.clubId ?? null;

  for (let i = 0; i < Math.max(60, Math.floor(RUNS / 3)); i += 1) {
    const setup = mulberry32(i * 2654435761);
    let state: CareerState = selectIdentity(
      createCareer(`promise-${i}`, 'standard'),
      {
        lastName: 'Test',
        shirtNumber: 9,
        foot: setup() < 0.25 ? 'left' : 'right',
        countryId: COUNTRIES[Math.floor(setup() * COUNTRIES.length)]!.id,
        position: PLAYABLE_POSITIONS[Math.floor(setup() * PLAYABLE_POSITIONS.length)] as Position,
        archetype: (['pace', 'technical', 'physical'] as const)[Math.floor(setup() * 3)]!,
      },
      WORLD,
    );

    const rng = mulberry32(i * 40503 + 11);
    let guard = 0;
    while (state.pending && guard < 600) {
      const pending = state.pending;
      const before = clubOf(state);

      for (const option of pending.options) {
        optionsChecked += 1;
        // The id shape, not the club id, is what says "this is a loan" — a loan
        // moves where he plays without touching who employs him.
        const isLoan = option.id.startsWith('loan:');
        const label = `${pending.kind}/${option.id.split(':')[0]}`;

        let after: CareerState;
        try {
          after = decide(state, option.id, WORLD);
        } catch (error) {
          broken.set(label, `${label} — threw: ${(error as Error).message}`);
          continue;
        }

        if (option.clubId) {
          const landed = isLoan ? after.loan?.clubId : after.contract?.clubId;
          if (option.clubId !== before && landed !== option.clubId) {
            broken.set(
              label,
              `${label} — offered ${option.clubId} and left him at ${landed ?? 'nobody'}`,
            );
          }
          // Staying put has to mean staying put.
          if (option.clubId === before && after.contract?.clubId !== before && !after.loan) {
            broken.set(label, `${label} — named his own club and moved him to ${after.contract?.clubId}`);
          }
        }

        /**
         * Terms printed on the card are a floor, never a fiction.
         *
         * `decide` signs the deal *and plays the seasons up to the next card*,
         * so a three-year contract correctly reads two afterwards. The years
         * already served have to be subtracted or this flags every contract in
         * the game — which is exactly what it did when first written, and the
         * reason the count is against `seasons.length` rather than a constant.
         */
        if (option.offer && !isLoan && after.contract) {
          const c = after.contract;
          const offer = option.offer;
          const served = after.seasons.length - state.seasons.length;
          if (c.wage < offer.wage) {
            broken.set(label, `${label} — promised ${offer.wage}/wk and paid ${c.wage}`);
          }
          if (c.yearsRemaining < offer.years - served) {
            broken.set(
              label,
              `${label} — promised ${offer.years}y, played ${served}, and has ${c.yearsRemaining}y left`,
            );
          }
          /**
           * The rest of what a card puts in print.
           *
           * The wage and the length are the numbers a player reads first, which
           * is why they were checked first — but the squad role is the whole
           * point of the ladder, and the release clause is the thing that
           * decides whether a bigger club can come for him later. A card that
           * printed either and did not deliver it would be the same bug in a
           * quieter place.
           *
           * Only asserted when the move actually happened: a renewal that was
           * declined, or an option the resolver correctly treated as staying
           * put, has no new contract to compare against.
           */
          if (c.clubId === option.clubId) {
            if (roleRank(c.promisedRole) < roleRank(offer.promisedRole)) {
              broken.set(
                label,
                `${label} — promised ${offer.promisedRole} and wrote ${c.promisedRole} into the contract`,
              );
            }
            if (offer.releaseClause !== null && c.releaseClause !== offer.releaseClause) {
              broken.set(
                label,
                `${label} — printed a ${offer.releaseClause} release clause and stored ${c.releaseClause}`,
              );
            }
          }
          // A fee on the card is money that has to appear on the career.
          if (offer.fee > 0 && c.clubId === option.clubId) {
            const paid = after.totals.transferFees - state.totals.transferFees;
            if (paid <= 0) {
              broken.set(label, `${label} — printed a ${offer.fee} fee and recorded none`);
            }
          }
        }
      }

      state = decide(state, pending.options[Math.floor(rng() * pending.options.length)]!.id, WORLD);
      guard += 1;
    }
  }

  if (broken.size === 0) {
    console.log(`    ✓ ${optionsChecked.toLocaleString()} options, every one did what it said`);
  } else {
    for (const message of broken.values()) console.log(`    ✗ ${message}`);
    failures.push(`${broken.size} kind(s) of option do not do what the card says`);
  }
}

/**
 * The second half of the same question: is the card a decision at all?
 *
 * The promise audit above asks whether an option does what it says. This asks
 * whether the player was ever given a choice to make. Both faults it looks for
 * shipped, and neither broke a type, threw, or failed a test:
 *
 *   - A "transfer window" with nobody to join. The rule that drops offers which
 *     lose to the renewal on every axis was drawing exactly as many suitors as
 *     the card had room for, so dropping them left one button saying *stay*.
 *     One career in six saw it.
 *   - A loan card with one destination, because the boy's own country could not
 *     field two clubs below his that would play him.
 *
 * Written as a sweep rather than a unit test because both were properties of
 * *whole careers* — nothing about either card in isolation looked wrong.
 */
console.log('\n  IS EVERY CARD ACTUALLY A DECISION?');
{
  const broken = new Map<string, string>();
  let cards = 0;

  for (let i = 0; i < Math.max(120, RUNS); i += 1) {
    const rng = mulberry32(i * 2654435761 + 17);
    let state: CareerState = selectIdentity(
      createCareer(`decision-${i}`, (['standard', 'quick', 'deep'] as const)[i % 3]!),
      {
        lastName: 'Test',
        shirtNumber: 9,
        foot: 'right',
        countryId: COUNTRIES[i % COUNTRIES.length]!.id,
        position: PLAYABLE_POSITIONS[i % PLAYABLE_POSITIONS.length] as Position,
        archetype: (['pace', 'technical', 'physical'] as const)[i % 3]!,
      },
      WORLD,
    );

    let guard = 0;
    while (state.pending && guard < 600) {
      const card = state.pending;
      cards += 1;
      const note = (message: string) => broken.set(`${card.kind}:${message.slice(0, 24)}`, message);

      if (card.options.length > CARD_SLOTS) {
        note(`a ${card.kind} card offered ${card.options.length} options, and a card is ${CARD_SLOTS}`);
      }
      if (card.options.length < 2) {
        note(
          `a ${card.kind} card offered one answer (${card.options.map((o) => o.id).join(', ')}) — that is a tap, not a decision`,
        );
      }
      if (card.kind === 'transfer' && !card.options.some((o) => o.id.startsWith('transfer:'))) {
        note('a transfer window opened with nobody to join');
      }
      /*
       * A line that names a rung has to be backed by a rung.
       *
       * `effects.role_up` / `role_down` print a squad role by name — "up to
       * Regular Starter" — and a name is an absolute claim. Only an absolute
       * `role` effect can keep it: a relative shift moves one rung from
       * whatever *this* season recomputes from ability, and when ability has
       * grown the result can be the same rung as last year or better. Two
       * event cards ended with sentences about being dropped while carrying a
       * shift, and the career table, which is the honest record, showed no
       * drop at all.
       *
       * The generic playing-time lines are deliberately not caught here: they
       * say "than you would have had", which a shift always delivers.
       */
      for (const option of card.options) {
        for (const outcome of option.outcomes) {
          for (const effect of outcome.effects ?? []) {
            if (effect.key !== 'effects.role_up' && effect.key !== 'effects.role_down') continue;
            if (typeof effect.params?.role !== 'string') {
              note(`${option.id} names a squad role with no role to name`);
            }
          }
        }
      }
      // Two options that resolve identically are one option wearing two labels.
      const ids = new Set(card.options.map((o) => o.id));
      if (ids.size !== card.options.length) note(`a ${card.kind} card printed the same option twice`);

      state = decide(state, card.options[Math.floor(rng() * card.options.length)]!.id, WORLD);
      guard += 1;
    }
  }

  if (broken.size === 0) {
    console.log(`    ✓ ${cards.toLocaleString()} cards, every one of them a real choice`);
  } else {
    for (const message of broken.values()) console.log(`    ✗ ${message}`);
    failures.push(`${broken.size} kind(s) of card are not decisions`);
  }
}

/**
 * Can every ending actually be reached?
 *
 * An ending is the one sentence a player takes away from a career, and the game
 * has twenty-five of them. The failure mode is not that one is *hard* — it is
 * that one is impossible, or that a broad ending quietly eats a rarer one and
 * nobody ever sees it. Both have happened here:
 *
 *   - `resolveEnding` used to take the first match in list order, so
 *     `serial_winner` was reached in 24% of careers and shown in 3%, and a
 *     player banned for doping who had won enough retired as *Serial Winner*.
 *   - `frozen_out` was first written as "retired before thirty with under eight
 *     seasons", which a career that starts at sixteen and cannot walk away
 *     before thirty-five is incapable of producing.
 *
 * So this measures both halves — how often each ending's condition holds, and
 * how often it is the one shown — under two ways of playing, because the
 * loyalty endings are unreachable by a player who answers at random and that is
 * not the same thing as unreachable.
 */
console.log('\n  CAN EVERY ENDING BE REACHED?');
{
  const qualified = new Map<string, number>();
  const shown = new Map<string, number>();
  let careers = 0;

  for (const policy of ['random', 'loyal'] as const) {
    for (let i = 0; i < ENDING_RUNS; i += 1) {
      const rng = mulberry32(i * 2654435761 + (policy === 'loyal' ? 99 : 5));
      let state: CareerState = selectIdentity(
        createCareer(`ending-${policy}-${i}`, (['standard', 'quick', 'deep'] as const)[i % 3]!),
        {
          lastName: 'Test',
          shirtNumber: 9,
          foot: 'right',
          countryId: COUNTRIES[i % COUNTRIES.length]!.id,
          position: PLAYABLE_POSITIONS[i % PLAYABLE_POSITIONS.length] as Position,
          archetype: (['pace', 'technical', 'physical'] as const)[i % 3]!,
        },
        WORLD,
      );
      let guard = 0;
      while (state.pending && guard < 400) {
        const options = state.pending.options;
        // The loyal policy exists to reach the one-club and never-left-home
        // endings: a career answered at random moves clubs, so those two would
        // read as impossible when they are only unlikely.
        const stay = options.findIndex((o) => o.id.startsWith('stay:') || o.id.startsWith('return:'));
        const pick = policy === 'loyal' && stay >= 0 ? stay : Math.floor(rng() * options.length);
        state = decide(state, options[pick]!.id, WORLD);
        guard += 1;
      }
      careers += 1;
      const report = state.retirement;
      if (!report) continue;
      bump(shown, report.endingId);
      for (const ending of ENDINGS) {
        if (ending.id === 'squad_player') continue;
        if (ending.when(state, report.legacyScore, WORLD, report.reasonKey)) bump(qualified, ending.id);
      }
    }
  }

  const unreachable: string[] = [];
  const swallowed: string[] = [];
  for (const ending of ENDINGS) {
    const q = qualified.get(ending.id) ?? 0;
    const s = shown.get(ending.id) ?? 0;
    if (ending.id !== 'squad_player' && q === 0) unreachable.push(`${ending.id} — no career ever met its condition`);
    else if (q >= 5 && s === 0) swallowed.push(`${ending.id} — reached ${q} times, shown none`);
  }
  const seen = [...shown.keys()].length;
  if (unreachable.length === 0 && swallowed.length === 0) {
    console.log(`    ✓ ${seen} of ${ENDINGS.length} endings shown across ${careers.toLocaleString()} careers, none unreachable`);
  } else {
    for (const message of [...unreachable, ...swallowed]) console.log(`    ✗ ${message}`);
    failures.push(`${unreachable.length + swallowed.length} ending(s) cannot be reached or are always swallowed`);
  }
}

console.log('\n  CAN A CARD SHOW AN OUTCOME THAT CANNOT HAPPEN?');
{
  const broken: string[] = [];
  for (const event of EVENTS) {
    for (const option of event.options) {
      const id = `${event.id}:${option.id}`;
      // `applyCareerEvent` destructures exactly two outcomes and branches on the
      // first one's odds. Both shapes below print a line that can never land.
      if (option.outcomes.length > 2) broken.push(`${id} — ${option.outcomes.length} outcomes, only two can be reached`);
      if (option.outcomes.length === 2 && option.outcomes[0]!.odds === undefined) {
        broken.push(`${id} — two outcomes and no odds on the first, so the second never happens`);
      }
    }
  }
  const options = EVENTS.reduce((n, e) => n + e.options.length, 0);
  if (broken.length === 0) {
    console.log(`    ✓ every one of the ${options} options can produce everything it prints`);
  } else {
    for (const b of broken) console.log(`    ✗ ${b}`);
    failures.push(`${broken.length} option(s) print an unreachable outcome`);
  }
}

// ---------------------------------------------------------------------------
// 2. Are the printed odds the real odds?
// ---------------------------------------------------------------------------

console.log('\n  ARE THE PRINTED ODDS THE REAL ODDS?');
{
  interface Tally {
    printed: number;
    taken: number;
    hit: number;
  }
  const tally = new Map<string, Tally>();

  /*
   * Rolls the mercy rule forced are not evidence about the printed odds.
   *
   * After three gambles land red in a row the fourth lands on its good branch
   * whatever the dice say (`redStreak`, `machine.ts`). That roll was never made
   * at the printed odds, so counting it measures the rule rather than the card —
   * and it did: on 2026-09-23, over this sweep's 2,500 careers, 646 of 23,506
   * gambles were forced (2.7%) and every one of them was tallied as a roll. It
   * lifted each card's "actual" by about a point, too little for the
   * card-by-card band below to see and plain in the pooled check (z = 4.1).
   * Left out, the same careers pool to z = 0.7.
   *
   * "Forced" is counted from what the player was shown — a gamble picked after
   * three red results in a row — rather than read off the engine's own counter,
   * and the two are then required to agree, so the tally cannot quietly skip the
   * wrong rolls. The same count checks the rule's one promise: no career ever
   * sees four red gambles in a row.
   */
  let gambles = 0;
  let forced = 0;
  let longestRedRun = 0;
  const fourReds = new Set<string>();
  let disagreements = 0;
  let firstDisagreement = '';

  for (let i = 0; i < ODDS_RUNS; i += 1) {
    const setup = mulberry32(i * 2654435761);
    let state: CareerState = selectIdentity(
      createCareer(`odds-${i}`, 'standard'),
      {
        lastName: 'Test',
        shirtNumber: 9,
        foot: setup() < 0.25 ? 'left' : 'right',
        countryId: COUNTRIES[Math.floor(setup() * COUNTRIES.length)]!.id,
        position: PLAYABLE_POSITIONS[Math.floor(setup() * PLAYABLE_POSITIONS.length)] as Position,
        archetype: (['pace', 'technical', 'physical'] as const)[Math.floor(setup() * 3)]!,
      },
      WORLD,
    );

    const rng = mulberry32(i * 40503 + 11);
    let guard = 0;
    /** Gambles in a row, up to now, whose result was shown in red. */
    let reds = 0;
    while (state.pending && guard < 600) {
      const options = state.pending.options;
      const chosen = options[Math.floor(rng() * options.length)]!;
      const bettable = chosen.outcomes.length === 2 && chosen.outcomes.every((o) => o.probability !== undefined);
      const first = chosen.outcomes[0]!;
      const underMercy = bettable && reds >= 3;
      if ((state.redStreak ?? 0) !== reds) {
        disagreements += 1;
        firstDisagreement ||= `odds-${i}: the engine counted ${state.redStreak ?? 0}, the screen showed ${reds}`;
      }

      state = decide(state, chosen.id, WORLD);
      guard += 1;

      if (!bettable) continue;
      gambles += 1;
      reds = state.lastResult?.tone === 'negative' ? reds + 1 : 0;
      longestRedRun = Math.max(longestRedRun, reds);
      if (reds >= 4) fourReds.add(`odds-${i}`);
      if (underMercy) {
        forced += 1;
        continue;
      }

      const row = tally.get(chosen.id) ?? { printed: first.probability!, taken: 0, hit: 0 };
      row.taken += 1;
      // `lastResult.key` is the outcome's own labelKey, so this is the card's
      // own line coming back — no separate mapping to drift out of step.
      if (state.lastResult?.key === first.labelKey) row.hit += 1;
      tally.set(chosen.id, row);
    }
  }

  const rows = [...tally.entries()]
    .filter(([, t]) => t.taken >= 80)
    .map(([id, t]) => ({ id, printed: t.printed, actual: (t.hit / t.taken) * 100, n: t.taken }))
    .sort((a, b) => Math.abs(b.actual - b.printed) - Math.abs(a.actual - a.printed));

  console.log('    option                                    printed   actual      n   drift');
  let lying = 0;
  for (const r of rows) {
    const drift = r.actual - r.printed;
    /*
     * Standard errors of a binomial at this sample. Inside the band, the card
     * is telling the truth and the difference is the dice.
     *
     * **Four, not three, and the reason is that this checks fifty options at
     * once.** A 3σ band fails one option in 370 by chance alone, so across a
     * deck this size a clean build failed roughly one run in seven — and it
     * did, on `agent_change:switch` at 60.3% against a printed 55% over 794
     * samples, which vanished the moment the sweep was run ten times longer
     * (the option did not even reach the worst seven). A gate that cries wolf
     * that often stops being read, which is worse than not having it. At 4σ
     * the whole deck raises a false alarm about one run in 300, and a card
     * that genuinely lies about its odds misses by far more than four.
     */
    const se = 100 * Math.sqrt(((r.printed / 100) * (1 - r.printed / 100)) / r.n);
    const bad = Math.abs(drift) > 4 * se;
    if (bad) lying += 1;
    console.log(
      `    ${r.id.padEnd(42)} ${String(r.printed).padStart(4)}%  ${r.actual.toFixed(1).padStart(6)}%  ` +
        `${String(r.n).padStart(5)}  ${drift >= 0 ? '+' : ''}${drift.toFixed(1)}${bad ? '  ✗ beyond 4σ' : ''}`,
    );
  }
  if (rows.length === 0) console.log('    (no gamble reached a usable sample — raise --odds-runs)');
  if (lying > 0) failures.push(`${lying} gamble(s) do not happen at the odds they print`);

  /*
   * The same question asked once, of every gamble together.
   *
   * The band above is wide because it asks forty questions at once, and that
   * makes it blind to a small lift every card shares — which is exactly the
   * shape a leak like the forced rolls takes. So the deck is pooled as well:
   * every ordinary roll of every gamble, the rarely dealt ones below the row
   * threshold included, against the number of first outcomes the printed odds
   * promise between them. One question, so 3σ, which gives it about the false
   * alarm rate the whole table has at 4σ; and the sweep is seeded, so a failure
   * is a change in the engine, never a bad afternoon.
   */
  let rolls = 0;
  let landed = 0;
  let promised = 0;
  let variance = 0;
  for (const t of tally.values()) {
    const p = t.printed / 100;
    rolls += t.taken;
    landed += t.hit;
    promised += t.taken * p;
    variance += t.taken * p * (1 - p);
  }
  if (rolls > 0) {
    const z = (landed - promised) / Math.sqrt(variance);
    const drift = ((landed - promised) / rolls) * 100;
    const bad = Math.abs(z) > 3;
    console.log(
      `    ${`pooled, all ${tally.size} gambles`.padEnd(42)} ${((promised / rolls) * 100).toFixed(1).padStart(4)}%  ` +
        `${((landed / rolls) * 100).toFixed(1).padStart(6)}%  ${String(rolls).padStart(5)}  ` +
        `${drift >= 0 ? '+' : ''}${drift.toFixed(1)}  z = ${z.toFixed(2)}${bad ? '  ✗ beyond 3σ' : ''}`,
    );
    if (bad) {
      failures.push(
        `pooled over every gamble, the first outcome lands ${drift.toFixed(1)} points off the printed odds (z = ${z.toFixed(2)}, want |z| ≤ 3)`,
      );
    }
  }

  const forcedShare = gambles > 0 ? (forced / gambles) * 100 : 0;
  console.log(
    `    ${forced.toLocaleString()} of ${gambles.toLocaleString()} gambles (${forcedShare.toFixed(1)}%) were forced by the mercy rule and are not in the tally`,
  );
  if (fourReds.size === 0) {
    console.log(`    ✓ no career saw four red gambles in a row (the longest run was ${longestRedRun})`);
  } else {
    console.log(`    ✗ ${fourReds.size} career(s) saw four red gambles in a row: ${[...fourReds].slice(0, 5).join(', ')}`);
    failures.push(`${fourReds.size} career(s) saw four red gambles in a row — the mercy rule did not hold`);
  }
  if (disagreements > 0) {
    console.log(`    ✗ the engine's red streak disagreed with the results shown ${disagreements} time(s) — ${firstDisagreement}`);
    failures.push(`the engine's red streak disagreed with the results it showed ${disagreements} time(s)`);
  }
}

// ---------------------------------------------------------------------------
// 3. Is the character you create a fair start?
// ---------------------------------------------------------------------------

/** One "play well" policy for everyone: the biggest club and the best role. */
function appeal(state: CareerState, i: number): number {
  const option = state.pending!.options[i]!;
  if (!option.clubId) return -Infinity;
  const index = indexFor(state);
  let club;
  try {
    club = index.club(option.clubId);
  } catch {
    return -Infinity;
  }
  const league = index.leagueOfClub(club.id);
  return (
    club.reputation + league.strength * 25 + (option.offer ? roleRank(option.offer.promisedRole) : 0) * 4
  );
}

function play(seed: number, over: { position?: Position; archetype?: 'pace' | 'technical' | 'physical'; countryId?: string }) {
  const setup = mulberry32(seed * 2654435761);
  const foot = setup() < 0.25 ? 'left' : 'right';
  const country = COUNTRIES[Math.floor(setup() * COUNTRIES.length)]!;
  const position = PLAYABLE_POSITIONS[Math.floor(setup() * PLAYABLE_POSITIONS.length)] as Position;
  const archetype = (['pace', 'technical', 'physical'] as const)[Math.floor(setup() * 3)]!;

  let state: CareerState = selectIdentity(
    createCareer(`start-${seed}`, 'standard'),
    {
      lastName: 'Test',
      shirtNumber: 9,
      foot,
      countryId: over.countryId ?? country.id,
      position: over.position ?? position,
      archetype: over.archetype ?? archetype,
    },
    WORLD,
  );
  let guard = 0;
  let keyMoment = false;
  while (state.pending && guard < 600) {
    if (KEY_MOMENTS.has(state.pending.id.split('|')[0]!)) keyMoment = true;
    const options = state.pending.options;
    let best = 0;
    for (let i = 1; i < options.length; i += 1) if (appeal(state, i) > appeal(state, best)) best = i;
    state = decide(state, options[best]!.id, WORLD);
    guard += 1;
  }
  if (state.phase !== 'summary' || !state.retirement) return null;
  return {
    legacy: state.retirement.legacyScore,
    earnings: state.totals.grossEarnings,
    peak: state.totals.peakOverall,
    seasons: state.seasons,
    keyMoment,
  };
}

/**
 * The three cards a career is told about afterwards: the penalty that decided
 * it, the save that decided it, the injury three weeks before the final.
 *
 * They are gated on the trophy engine having flagged silverware, which is
 * right — a moment needs something to be at stake — but the gate also excluded
 * the domestic cup, which is the trophy an ordinary club actually reaches, and
 * their weights were ordinary weights in a deck of fifty. Measured, **12.8%**
 * of careers ever met one: four players in five never saw the card the whole
 * game is built to be remembered for. The floor below is the regression guard,
 * not a target.
 */
const KEY_MOMENTS = new Set(['decisive_penalty', 'decisive_save', 'injury_at_peak']);
const KEY_MOMENT_FLOOR = 0.25;

const money = (v: number) => `€${(v / 1e6).toFixed(1)}M`;

/** Spread between the best and worst variant, as a percentage of the worst. */
function sweep(label: string, variants: { name: string; over: Parameters<typeof play>[1] }[]): number {
  console.log(`\n  ${label}`);
  console.log('    variant        legacy   earnings   peak OVR      n');
  const medians: number[] = [];
  for (const v of variants) {
    const rows = [];
    for (let i = 0; i < RUNS; i += 1) {
      const r = play(i, v.over);
      if (r) rows.push(r);
    }
    const m = median(rows.map((r) => r.legacy));
    medians.push(m);
    console.log(
      `    ${v.name.padEnd(13)} ${String(m).padStart(6)}   ${money(median(rows.map((r) => r.earnings))).padStart(8)}` +
        `   ${String(median(rows.map((r) => r.peak))).padStart(8)}   ${String(rows.length).padStart(4)}`,
    );
  }
  const lo = Math.min(...medians);
  const hi = Math.max(...medians);
  const spread = lo > 0 ? ((hi - lo) / lo) * 100 : Infinity;
  console.log(`    → ${spread.toFixed(0)}% between best and worst`);
  return spread;
}

console.log('\n  DOES A CAREER GET A MOMENT WORTH TELLING?');
{
  let seen = 0;
  let played = 0;
  for (let i = 0; i < RUNS * 4; i += 1) {
    const r = play(i, {});
    if (!r) continue;
    played += 1;
    if (r.keyMoment) seen += 1;
  }
  const share = played > 0 ? seen / played : 0;
  console.log(`    a decisive penalty, save or injury reached ${(share * 100).toFixed(1)}% of ${played} careers`);
  if (share >= KEY_MOMENT_FLOOR) {
    console.log(`    ✓ above the ${(KEY_MOMENT_FLOOR * 100).toFixed(0)}% floor`);
  } else {
    console.log(`    ✗ below the ${(KEY_MOMENT_FLOOR * 100).toFixed(0)}% floor`);
    failures.push(`only ${(share * 100).toFixed(1)}% of careers meet a key moment`);
  }
}

console.log('\n  IS THE CHARACTER YOU CREATE A FAIR START?');
const positionSpread = sweep(
  'POSITION',
  PLAYABLE_POSITIONS.map((p) => ({ name: p, over: { position: p as Position } })),
);
const archetypeSpread = sweep(
  'ARCHETYPE',
  (['pace', 'technical', 'physical'] as const).map((a) => ({ name: a, over: { archetype: a } })),
);
/*
 * A spread of nations rather than all sixty-odd, because the gate runs on every
 * pull request: two of the biggest, two mid-sized European, and three outside
 * the traditional powers.
 *
 * `--countries=all` walks every nationality in the world instead. That is the
 * run to make when the question is "is any nationality a bad pick" rather than
 * "has anything moved" — a player picks his country once, at sixteen, on a
 * screen that tells him what caps will cost, and if some flag were quietly
 * worth twenty per cent less than another that screen would be lying.
 */
const ALL_COUNTRIES = process.argv.includes('--countries=all');
const countrySpread = sweep(
  'COUNTRY',
  (ALL_COUNTRIES
    ? COUNTRIES.map((c) => c.id)
    : ['eng', 'esp', 'bra', 'nor', 'irl', 'jpn', 'nga']
  ).map((id) => ({ name: id, over: { countryId: id } })),
);

// ---------------------------------------------------------------------------
// --par: regenerate the position table `summary.ts` scores against
// ---------------------------------------------------------------------------

if (PAR) {
  console.log('\n  OUTPUT PAR PER POSITION (paste into summary.ts)');
  const out: string[] = [];
  for (const p of PLAYABLE_POSITIONS) {
    let raw = 0;
    let apps = 0;
    for (let i = 0; i < RUNS; i += 1) {
      const r = play(i, { position: p as Position });
      if (!r) continue;
      for (const s of r.seasons) {
        raw +=
          s.stats.goals * 3.2 +
          s.stats.assists * 2.1 +
          s.stats.cleanSheets * 2.2 +
          s.stats.saves * 0.11 +
          (s.stats.tackles + s.stats.interceptions + s.stats.aerialsWon) * 0.08 +
          s.stats.keyPasses * 0.15 +
          s.stats.appearances * 0.35;
        apps += s.stats.appearances;
      }
    }
    out.push(`  ${p}: ${apps > 0 ? (raw / apps).toFixed(2) : '1.00'},`);
  }
  console.log(`const OUTPUT_PAR: Record<Position, number> = {\n${out.join('\n')}\n};`);
}

// ---------------------------------------------------------------------------

if (ASSERT) {
  /**
   * Set a little above where the game currently sits, so this catches a real
   * regression without flaking on sampling noise.
   *
   * Position was the one genuinely broken thing this tool found: 101% before
   * the position-relative output term and the two new awards, 52% after. The
   * remaining gap is **not** a scoring artefact and is deliberately left alone —
   * it is the transfer market paying more for goals, so a striker moves to
   * bigger clubs, wins more, and peaks a rating point or two higher. That is
   * football. What is fixed is that a defender's whole job now scores, and that
   * every position has an individual honour it can actually win.
   */
  if (positionSpread > 60) failures.push(`position decides ${positionSpread.toFixed(0)}% of the score (want ≤60%)`);
  if (archetypeSpread > 30) failures.push(`archetype decides ${archetypeSpread.toFixed(0)}% of the score (want ≤30%)`);
  if (countrySpread > 30) failures.push(`country decides ${countrySpread.toFixed(0)}% of the score (want ≤30%)`);

  if (failures.length > 0) {
    console.log('\n  ✗ the game is not being fair to somebody:');
    for (const f of failures) console.log(`      ${f}`);
    console.log('');
    process.exit(1);
  }
  console.log('\n  ✓ honest odds, reachable outcomes, and no rigged starting choice\n');
} else {
  console.log('');
}
