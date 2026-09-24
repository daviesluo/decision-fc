/**
 * Live check that the deployed `career-submit` function still verifies real
 * careers — the one test that proves the deployed engine bundle matches the
 * engine this repo builds.
 *
 *   npx tsx tools/edge-smoke.ts
 *
 * Plays a career through the local engine, submits it, and asserts four
 * things: a genuine run verifies, all four boards come back ranked — including
 * the same-seed board the daily challenge is built on — a tampered score is
 * rejected with 422, and the run is stored. Then one genuine career on every
 * other pace the engine has, because a pace the table will not store only
 * fails when a career on that pace is submitted (sql/004). It cleans up after
 * itself when a service-role key is available (`SUPABASE_SERVICE_ROLE_KEY`),
 * so the leaderboard is not polluted with synthetic runs.
 *
 * Exits non-zero on any failure, which is what makes it usable as the last
 * step of the deploy workflow. A drifted bundle fails here rather than in
 * front of a player whose career has just been rejected.
 */
import { createCareer, decide, mulberry32, PACE_DECISIONS, selectIdentity, type CareerState, type Pace } from '@bg/engine';
import { WORLD } from '@bg/content';

const PROJECT = process.env.SUPABASE_PROJECT_REF ?? 'dyuilyooirtpfyqplfve';
const BASE = process.env.SUPABASE_URL ?? `https://${PROJECT}.supabase.co`;
const ANON =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5dWlseW9vaXJ0cGZ5cXBsZnZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTI2MjQsImV4cCI6MjA5NDc4ODYyNH0.-JBC17ANObqRGEvEdJljgnxkbt6erOEvOlkFUkfKrx0';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// A seed nobody would ever roll, so the cleanup below can never touch a real run.
const SEED = `smoke-${process.env.GITHUB_SHA?.slice(0, 12) ?? 'local'}`;
const IDENTITY = {
  lastName: 'Smoke',
  shirtNumber: 9,
  foot: 'right' as const,
  countryId: 'eng',
  position: 'ST' as const,
  archetype: 'technical' as const,
};

function playCareer(pace: Pace) {
  let state: CareerState = selectIdentity(createCareer(SEED, pace), IDENTITY, WORLD);
  const rng = mulberry32(20260728);
  const decisions: string[] = [];
  let guard = 0;
  while (state.pending && guard < 400) {
    const options = state.pending.options;
    const chosen = options[Math.floor(rng() * options.length)]!;
    decisions.push(chosen.id);
    state = decide(state, chosen.id, WORLD);
    guard += 1;
  }
  if (state.phase !== 'summary' || !state.retirement) throw new Error('career did not reach retirement');
  return { state, decisions };
}

async function post(claimed: Record<string, number>, decisions: string[], pace: Pace = 'standard') {
  const response = await fetch(`${BASE}/functions/v1/career-submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANON}`,
      apikey: ANON,
    },
    body: JSON.stringify({ seed: SEED, pace, identity: IDENTITY, decisions, claimed }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

const claimsOf = (state: CareerState) => ({
  legacy: state.retirement!.legacyScore,
  gross: state.totals.grossEarnings,
  fees: state.totals.transferFees,
  peakValue: state.totals.peakMarketValue,
});

async function main() {
  const { state, decisions } = playCareer('standard');
  const claimed = claimsOf(state);
  console.log(`  career: ${state.seasons.length} seasons, legacy ${claimed.legacy}, peak value ${claimed.peakValue}`);

  let failed = false;
  const check = (ok: boolean, label: string, detail?: unknown) => {
    console.log(`  ${ok ? '✓' : '✗'} ${label}${ok || detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
    if (!ok) failed = true;
  };

  const real = await post(claimed, decisions);
  check(real.status === 200 && real.body.verified === true, 'a genuine career verifies', real.body);
  type Boards = Record<'legacy' | 'wealth' | 'value' | 'sameWorld', { rank?: number; total?: number }>;
  const boards = real.body.boards as Partial<Boards> | undefined;
  check(
    (['legacy', 'wealth', 'value'] as const).every((key) => typeof boards?.[key]?.rank === 'number'),
    'all three all-time boards come back ranked',
    boards,
  );
  // The fourth board ranks this career against the other careers played on the
  // same seed at the same pace — the daily challenge's board. The smoke test
  // uses a seed nobody else can roll, so the honest expectation is a field of
  // exactly one: this run, first. A missing board means the deployed handler
  // predates it; a total of zero means the same-seed query is wrong.
  check(
    typeof boards?.sameWorld?.rank === 'number' && (boards.sameWorld.total ?? 0) >= 1,
    'the same-world board comes back, and counts this run',
    boards?.sameWorld,
  );

  const tampered = await post({ ...claimed, legacy: claimed.legacy + 5000 }, decisions);
  check(tampered.status === 422, 'an inflated score is rejected with 422', tampered.status);

  // Every other pace the engine has, once each. Only Standard was ever
  // submitted here, and the table's check still said `blitz` for the pace the
  // engine calls `quick` — so every Quick career verified, failed the insert
  // and came back 500, and this test passed throughout (sql/004). A pace that
  // cannot be stored answers 500, so a 200 here means it was stored.
  for (const pace of Object.keys(PACE_DECISIONS) as Pace[]) {
    if (pace === 'standard') continue;
    const other = playCareer(pace);
    const answer = await post(claimsOf(other.state), other.decisions, pace);
    check(answer.status === 200 && answer.body.verified === true, `a genuine ${pace} career verifies and is stored`, answer.body);
  }

  // Leave the board as it was found.
  if (SERVICE) {
    const cleanup = await fetch(`${BASE}/rest/v1/bg_runs?seed=eq.${encodeURIComponent(SEED)}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    });
    check(cleanup.ok, 'the smoke-test run is deleted again', cleanup.status);
  } else {
    console.log('  ? no service-role key — leaving the smoke run in the table');
  }

  process.exit(failed ? 1 : 0);
}

void main();
