/**
 * Prove a freshly built engine bundle before anything is pinned to it.
 *
 *   npx tsx tools/verify-bundle.ts [path-to-bundle.mjs]
 *
 * The leaderboard's whole guarantee is that the server replays a career through
 * *the same engine the player used*. The bundle is the copy of that engine the
 * server runs, and it is built, minified and uploaded by CI — three steps that
 * can each silently produce something that loads fine and computes differently.
 *
 * Until this existed, the only check on that was `tools/edge-smoke.ts`, which
 * runs against the **live** function. That is a real test, but it happens after
 * promotion: by the time it goes red, every player's submission is already
 * being rejected. This runs on the candidate artifact, before it is pinned.
 *
 * What it asserts: play a career with the engine in this working tree, replay
 * the same seed + identity + decisions through the bundle, and require every
 * leaderboard number to match exactly. A bundle that fails here is the reason
 * to stop the deploy, not to roll one back.
 *
 * Exits non-zero on any mismatch.
 */
import { createCareer, decide, mulberry32, selectIdentity, type CareerState } from '@bg/engine';
import { WORLD } from '@bg/content';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const BUNDLE = resolve(
  process.argv[2] ?? 'packages/backend/edge/engine-bundle.mjs',
);

/**
 * Four careers, not one. A single decision policy walks a single path through
 * the deck, and the numbers that differ between two builds of the engine are
 * usually the ones on a branch neither career took. Different seeds, different
 * paces, different positions and different chooser policies between them touch
 * loans, transfers, national teams, injuries and retirement.
 */
const CASES = [
  { seed: 'verify-a', pace: 'standard' as const, position: 'ST' as const, policy: 'first' as const },
  { seed: 'verify-b', pace: 'quick' as const, position: 'CB' as const, policy: 'last' as const },
  { seed: 'verify-c', pace: 'deep' as const, position: 'GK' as const, policy: 'random' as const },
  { seed: 'verify-d', pace: 'standard' as const, position: 'CAM' as const, policy: 'random' as const },
];

function identityFor(position: (typeof CASES)[number]['position']) {
  return {
    lastName: 'Verify',
    shirtNumber: 9,
    foot: 'right' as const,
    countryId: 'eng',
    position,
    archetype: 'technical' as const,
  };
}

function play(test: (typeof CASES)[number]) {
  let state: CareerState = selectIdentity(
    createCareer(test.seed, test.pace),
    identityFor(test.position),
    WORLD,
  );
  const rng = mulberry32(20260729);
  const decisions: string[] = [];
  let guard = 0;
  while (state.pending && guard < 400) {
    const options = state.pending.options;
    const index =
      test.policy === 'first' ? 0
      : test.policy === 'last' ? options.length - 1
      : Math.floor(rng() * options.length);
    const chosen = options[index]!;
    decisions.push(chosen.id);
    state = decide(state, chosen.id, WORLD);
    guard += 1;
  }
  if (state.phase !== 'summary' || !state.retirement) {
    throw new Error(`${test.seed}: career did not reach retirement`);
  }
  return { state, decisions };
}

/** Exactly the numbers the edge function compares a submission against. */
function scoresOf(state: CareerState) {
  return {
    legacy: state.retirement!.legacyScore,
    gross: state.totals.grossEarnings,
    fees: state.totals.transferFees,
    peakValue: state.totals.peakMarketValue,
    peakOverall: state.totals.peakOverall,
    ending: state.retirement!.endingId,
    seasons: state.seasons.length,
  };
}

interface Bundle {
  replay: (seed: string, pace: string, identity: unknown, decisions: string[], world: unknown) => CareerState;
  WORLD: unknown;
}

async function main() {
  let bundle: Bundle;
  try {
    bundle = (await import(pathToFileURL(BUNDLE).href)) as Bundle;
  } catch (error) {
    console.error(`✗ could not load ${BUNDLE}: ${(error as Error).message}`);
    console.error('  Run `node tools/build-edge.mjs` first.');
    process.exit(1);
  }
  if (typeof bundle.replay !== 'function' || !bundle.WORLD) {
    console.error(`✗ ${BUNDLE} does not export both replay and WORLD`);
    process.exit(1);
  }

  console.log(`verifying ${BUNDLE}`);
  let failed = false;
  for (const test of CASES) {
    const { state, decisions } = play(test);
    const here = scoresOf(state);

    let there;
    try {
      const replayed = bundle.replay(
        test.seed,
        test.pace,
        identityFor(test.position),
        decisions,
        bundle.WORLD,
      );
      there = scoresOf(replayed);
    } catch (error) {
      console.error(`  ✗ ${test.seed}: the bundle threw — ${(error as Error).message}`);
      failed = true;
      continue;
    }

    const wrong = (Object.keys(here) as (keyof typeof here)[]).filter((k) => here[k] !== there[k]);
    if (wrong.length > 0) {
      console.error(`  ✗ ${test.seed} (${test.pace}, ${test.position}, ${decisions.length} decisions)`);
      for (const key of wrong) console.error(`      ${key}: engine ${here[key]} ≠ bundle ${there[key]}`);
      failed = true;
    } else {
      console.log(
        `  ✓ ${test.seed} (${test.pace}, ${test.position}) — ${here.seasons} seasons, legacy ${here.legacy}`,
      );
    }
  }

  if (failed) {
    console.error('\n✗ the bundle does not reproduce this engine. Do not deploy it.');
    process.exit(1);
  }
  console.log('\n✓ the bundle reproduces this engine exactly');
}

void main();
