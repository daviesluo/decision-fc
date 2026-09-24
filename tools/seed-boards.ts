/**
 * Fill the leaderboards with careers played by the engine that scores them.
 *
 * ## Why this exists
 *
 * Decided 2026-09-23. The boards held 566 careers scored by rules
 * that no longer exist — a medal used to pay the same whether you played for
 * it or watched — so a career finished today was ranked against inflated
 * history. Re-scoring them by replay was measured and does not work (5% of
 * old decision lists survive a rules change), so they are replaced: by careers
 * played through **the final engine**, so a player's rank means what it says.
 *
 * ## What it writes
 *
 * For every UTC day it is asked about, two kinds of row:
 *
 *   · **Careers** — a handful to a couple of dozen a day, at every pace,
 *     played by the decision policies in `policies.ts` with a human amount of
 *     noise, so the population reads like people rather than like `pnpm
 *     balance`'s coin-flippers (a random-play board would make every real
 *     player look like a genius).
 *   · **The daily challenge** — five to ten a day on that day's seed and pace,
 *     not more: the daily board should feel like a few other people got there
 *     first, not like a crowd was waiting.
 *
 * Every row's `created_at` is a moment on its day, weighted to the hours
 * people are awake, and **the boards only count a row once its moment has
 * passed** (`bg_ranks`, `packages/backend/sql/003-…`). So the daily board is
 * empty at 00:00 UTC and fills through the day, which is the point: it
 * climbs from midnight, it does not appear all at once.
 *
 * ## Why it is safe to run again and again
 *
 * A row's id is a hash of (kind, day, slot), so a slot is one row for ever:
 * running twice, or the scheduler firing late and the job catching up, inserts
 * nothing new. The career in the slot is deterministic too — same day, same
 * slot, same career — until the engine changes, and even then the slot keeps
 * its first row rather than gaining a second.
 *
 * Seeded rows carry `seeded = true`, so they can be counted, filtered or
 * removed at any time without touching a real player's row.
 *
 *   pnpm seed:boards -- --plan                  what it would write; no network
 *   pnpm seed:boards -- --days=2                today and tomorrow (the schedule)
 *   pnpm seed:boards -- --backfill              everything since launch, too
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY. ENGINE_ID (the deployed bundle's 12-hex
 * fingerprint, which is what the edge function stamps on real rows) is read
 * from the edge bundle's `current.json` when not given.
 */
import { createHash } from 'node:crypto';
import { WORLD } from '../packages/content/src/index.js';
import { COUNTRIES } from '../packages/content/src/data/countries.js';
import {
  createCareer,
  decide,
  makeSeed,
  mulberry32,
  selectIdentity,
  PLAYABLE_POSITIONS,
  type CareerState,
  type Pace,
  type Position,
} from '../packages/engine/src/index.js';
import { POLICIES } from './policies';

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const PLAN = process.argv.includes('--plan');
const BACKFILL = process.argv.includes('--backfill');
const DAYS = Number(arg('days') ?? 2);
/** The first day the boards existed. */
const LAUNCH = arg('from') ?? '2026-07-28';
/** Same as `DAILY_PACE` in apps/web/src/lib/daily.ts — the challenge is one pace. */
const DAILY_PACE: Pace = 'standard';

const PROJECT = process.env.SUPABASE_PROJECT_REF ?? 'dyuilyooirtpfyqplfve';
const BASE = process.env.SUPABASE_URL ?? `https://${PROJECT}.supabase.co`;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
/** A 32-bit seed for mulberry32 from any string. */
const seedOf = (text: string) => parseInt(sha256(text).slice(0, 8), 16);
/** A stable v4-shaped UUID for a slot, so a slot is one row however often this runs. */
function slotId(text: string): string {
  const h = sha256(`seed-boards|${text}`);
  const variant = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const pick = <T>(rng: () => number, items: readonly T[]): T => items[Math.floor(rng() * items.length)]!;
function weighted<T>(rng: () => number, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [item, w] of items) {
    roll -= w;
    if (roll <= 0) return item;
  }
  return items[items.length - 1]![0];
}

// ---------------------------------------------------------------------------
// Who plays
// ---------------------------------------------------------------------------

/**
 * Surnames typed into the identity screen. Mixed the way the audience is:
 * English and Chinese, and the football nations in between. Not displayed on
 * any board — the boards show ranks, not names — but stored with the row and
 * hashed into it, so they should look like something a person typed.
 */
const SURNAMES = [
  'Smith', 'Jones', 'Taylor', 'Brown', 'Walker', 'Wright', 'Hughes', 'Evans', 'Carter', 'Murphy',
  'Kelly', 'Reid', 'Walsh', 'Clarke', 'Hall', 'Price', 'Bennett', 'Foster', 'Kane', 'Saka',
  'García', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Romero', 'Torres', 'Navarro', 'Silva', 'Santos',
  'Costa', 'Pereira', 'Oliveira', 'Rossi', 'Bianchi', 'Ricci', 'Moretti', 'Conti', 'Müller', 'Schmidt',
  'Weber', 'Wagner', 'Becker', 'Hoffmann', 'Dubois', 'Martin', 'Bernard', 'Lefèvre', 'Mbappé', 'Kanté',
  'De Jong', 'Van Dijk', 'Jansen', 'Peeters', 'Nakamura', 'Tanaka', 'Suzuki', 'Kim', 'Park', 'Son',
  'Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Zhao', 'Huang', 'Zhou', 'Wu',
  'Xu', 'Sun', 'Ma', 'Hu', 'Guo', 'Lin', 'He', 'Gao', 'Luo', 'Zheng',
  '王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '林', '郭', '何', '罗', '梁',
  'Messi', 'Ronaldo', 'Zidane', 'Beckham', 'Gerrard', 'Pirlo', 'Xavi', 'Iniesta', 'Henry', 'Rooney',
  'Kaka', 'Figo', 'Totti', 'Raúl', 'Owen', 'Lampard', 'Drogba', 'Salah', 'Haaland', 'Pedri',
];
/** Numbers people pick, most-picked first. */
const SHIRTS: readonly (readonly [number, number])[] = [
  [10, 16], [7, 14], [9, 12], [11, 7], [8, 6], [23, 4], [17, 4], [19, 3], [4, 3], [5, 3],
  [6, 3], [1, 3], [3, 2], [2, 2], [14, 2], [18, 2], [20, 2], [21, 2], [22, 2], [30, 1], [99, 1], [77, 1],
];
/*
 * The weights below are not guesses. They are what the 131 real careers
 * submitted between the scoring change and 2026-09-23 actually chose — the
 * only players scored by the rules this board now uses — so the simulated
 * field is shaped like the real one, and a real player's rank against it
 * means what it would mean against people.
 *
 * The one that matters most is pace: three real careers in four were played
 * on Deep. A field simulated at the intro screen's default would have been a
 * Standard field, and every real Deep player would have looked top-quarter.
 *
 * **Where the field sits, and why there.** Measured over launch-to-tomorrow:
 * achievements median ≈ 2,350. Real players split into two groups — people
 * trying it (Standard, median 1,721) and a few regulars replaying Deep many
 * times ("Player" ×25, one surname ×19; median 3,282). The field sits between
 * them on purpose. Measured on the live board the day it was seeded, a
 * typical first career ranks in the top 68% — the lower half, as it would
 * among the real players alone — and a regular's in the top 32%; neither is
 * flattered. The policies cannot play as well as a practised regular anyway,
 * so the top of the board is left for people.
 */
/** People choose attackers: ST 47, LW 32, RW 19, CAM 13, GK 11 of 131. */
const POSITION_WEIGHT: Partial<Record<Position, number>> = {
  ST: 36, LW: 24, RW: 15, CAM: 10, GK: 8, CM: 3, CDM: 2, CB: 2, RB: 1.5, LB: 1,
};
/**
 * Deep 99, Standard 32, Quick 0 of 131 — but that zero is not a preference.
 * The table refused every Quick career until `sql/004` (its check still said
 * `blitz`), so how many people play Quick is unknown. A small share is kept
 * until real Quick careers can be counted.
 */
const PACES: readonly (readonly [Pace, number])[] = [['deep', 72], ['standard', 24], ['quick', 4]];
/** Technical 76, pace 39, physical 16 of 131. */
const ARCHETYPES: readonly (readonly ['pace' | 'technical' | 'physical', number])[] = [
  ['technical', 58], ['pace', 30], ['physical', 12],
];
/**
 * Nationalities, the same way: the football countries people pick, then a
 * long tail across every other country in the game.
 */
const COUNTRY_WEIGHT: Record<string, number> = { esp: 21, fra: 14, eng: 13, arg: 11, bra: 9, ger: 8, ita: 6, por: 5, ned: 4, chn: 4 };
/**
 * How the population plays. Weighted towards the two policies that try to win
 * — people play to win — with a tail of the ones that do not.
 */
const POLICY_WEIGHT: Record<string, number> = { shrewd: 40, ambitious: 40, loyal: 10, unambitious: 5, random: 5 };
/** How often a person does something other than what their plan says. */
const NOISE = 0.1;

/**
 * When people play, by UTC hour. Europe's evening and China's evening both
 * sit inside 11:00–22:00 UTC, which is where the weight is; the small hours
 * still get somebody.
 */
const HOUR_WEIGHT = [2, 1, 1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 10, 10, 10, 9, 7, 5, 3];

// ---------------------------------------------------------------------------
// Days and slots
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const dayStart = (day: string) => Date.parse(`${day}T00:00:00Z`);
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * How many careers a day gets. A gentle ramp from launch — a new site is
 * quieter — to about twenty a day, which is the order of what real players
 * have been submitting since the scoring change.
 */
function careersOn(day: string, rng: () => number): number {
  const age = Math.max(0, (dayStart(day) - dayStart(LAUNCH)) / DAY_MS);
  const ramp = Math.min(1, 0.45 + age / 50);
  return Math.round((12 + rng() * 14) * ramp);
}
const dailiesOn = (rng: () => number) => 5 + Math.floor(rng() * 6);

/** A moment on the day, weighted to waking hours. */
function momentOn(day: string, rng: () => number): number {
  const hour = weighted(rng, HOUR_WEIGHT.map((w, h) => [h, w] as const));
  return dayStart(day) + hour * 3_600_000 + Math.floor(rng() * 3_600_000);
}

interface Row {
  id: string;
  created_at: string;
  seed: string;
  pace: Pace;
  identity: Record<string, unknown>;
  decisions: string[];
  run_hash: string;
  engine: string;
  legacy_score: number;
  gross_earnings: number;
  transfer_fees: number;
  peak_market_value: number;
  peak_overall: number;
  ending_id: string;
  country_id: string;
  seasons: number;
  verified: true;
  seeded: true;
}

/** The same hash the edge function stores, so a seeded row is shaped like a real one. */
function runHash(seed: string, pace: string, identity: Record<string, unknown>, decisions: string[]): string {
  const id = identity;
  const key = `${id.lastName}|${id.shirtNumber}|${id.foot}|${id.countryId}|${id.position}|${id.archetype}`;
  return sha256(`${seed}|${pace}|${key}|${decisions.join(',')}`);
}

/**
 * How a person answers a card that is not about a club: by reading it.
 *
 * The policies in `policies.ts` only know how to weigh clubs — on an event
 * card every option scores the same to them and they take the first, which no
 * person does. So this reads what the screen prints and nothing more: each
 * outcome's odds (a certain outcome counts in full) and whether it is good or
 * bad news. Losses are weighted at 0.6 of a gain: people who play this game
 * take the brave option more often than a loss-averse reader would, and of the
 * weights tried (1.3, 1.0, 0.6) this one put the field closest to the real
 * players. The effect is small — a couple of per cent on the median — because
 * in this game the club you pick decides far more than the cards do.
 */
function readCard(state: CareerState): string {
  const options = state.pending!.options;
  let best = options[0]!;
  let bestScore = -Infinity;
  for (const option of options) {
    let score = 0;
    for (const outcome of option.outcomes) {
      const weight = outcome.probability === undefined ? 1 : outcome.probability / 100;
      score += weight * (outcome.tone === 'positive' ? 1 : outcome.tone === 'negative' ? -0.6 : 0);
    }
    if (score > bestScore) {
      best = option;
      bestScore = score;
    }
  }
  return best.id;
}

function play(slot: string, seed: string, pace: Pace, at: number, engine: string): Row | null {
  const rng = mulberry32(seedOf(slot));
  const identity = {
    lastName: pick(rng, SURNAMES),
    shirtNumber: weighted(rng, SHIRTS),
    foot: rng() < 0.22 ? 'left' : 'right',
    countryId: weighted(rng, COUNTRIES.map((c) => [c.id, COUNTRY_WEIGHT[c.id] ?? 0.6] as const)),
    position: weighted(rng, PLAYABLE_POSITIONS.map((p) => [p, POSITION_WEIGHT[p] ?? 1] as const)),
    archetype: weighted(rng, ARCHETYPES),
  } as const;
  const policyName = weighted(rng, Object.entries(POLICY_WEIGHT));
  const policy = POLICIES.find((p) => p.name === policyName)!.play;

  let state: CareerState = selectIdentity(createCareer(seed, pace), identity, WORLD);
  const decisions: string[] = [];
  let guard = 0;
  while (state.pending && guard < 400) {
    const options = state.pending.options;
    const aboutClubs = options.some((o) => o.clubId);
    const id = rng() < NOISE ? pick(rng, options).id : aboutClubs ? policy(state, rng) : readCard(state);
    decisions.push(id);
    state = decide(state, id, WORLD);
    guard += 1;
  }
  const report = state.retirement;
  if (state.phase !== 'summary' || !report) return null;
  return {
    id: slotId(slot),
    created_at: new Date(at).toISOString(),
    seed,
    pace,
    identity,
    decisions,
    run_hash: runHash(seed, pace, identity, decisions),
    engine,
    legacy_score: report.legacyScore,
    gross_earnings: state.totals.grossEarnings,
    transfer_fees: state.totals.transferFees,
    peak_market_value: state.totals.peakMarketValue,
    peak_overall: state.totals.peakOverall,
    ending_id: report.endingId,
    country_id: identity.countryId,
    seasons: state.seasons.length,
    verified: true,
    seeded: true,
  };
}

/** Every row for one UTC day: its careers and its daily challenge. */
function rowsFor(day: string, engine: string): Row[] {
  const rng = mulberry32(seedOf(`day|${day}`));
  const rows: Row[] = [];
  const careers = careersOn(day, rng);
  for (let i = 0; i < careers; i += 1) {
    const at = momentOn(day, rng);
    const pace = weighted(rng, PACES);
    // The client's own seed shape — `makeSeed` over a timestamp — so a
    // seeded run's seed cannot be told from a real one's.
    const seed = makeSeed(at + Math.floor(rng() * 1e6));
    const row = play(`career|${day}|${i}`, seed, pace, at, engine);
    if (row) rows.push(row);
  }
  const dailies = dailiesOn(rng);
  for (let i = 0; i < dailies; i += 1) {
    const at = momentOn(day, rng);
    const row = play(`daily|${day}|${i}`, `daily-${day}`, DAILY_PACE, at, engine);
    if (row) rows.push(row);
  }
  return rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function deployedEngine(): Promise<string> {
  if (process.env.ENGINE_ID) return process.env.ENGINE_ID;
  const res = await fetch(`${BASE}/storage/v1/object/public/edge-code/current.json`);
  if (!res.ok) throw new Error(`current.json answered ${res.status}`);
  const pin = (await res.json()) as { hash?: string };
  if (!pin.hash) throw new Error('current.json names no bundle hash');
  return pin.hash.slice(0, 12);
}

async function main(): Promise<void> {
  const today = dayOf(Date.now());
  const days: string[] = [];
  const first = BACKFILL ? dayStart(LAUNCH) : dayStart(today);
  const last = dayStart(today) + (DAYS - 1) * DAY_MS;
  for (let t = first; t <= last; t += DAY_MS) days.push(dayOf(t));

  const engine = PLAN ? 'plan' : await deployedEngine();
  if (!PLAN && !SERVICE) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');

  let written = 0;
  let generated = 0;
  const all: Row[] = [];
  for (const day of days) {
    const rows = rowsFor(day, engine);
    generated += rows.length;
    all.push(...rows);
    const daily = rows.filter((r) => r.seed.startsWith('daily-')).length;
    if (PLAN) {
      const legacy = rows.map((r) => r.legacy_score).sort((a, b) => a - b);
      console.log(
        `  ${day}  ${String(rows.length - daily).padStart(3)} careers  ${String(daily).padStart(2)} daily` +
          `  legacy p50 ${legacy[Math.floor(legacy.length / 2)] ?? '-'}` +
          `  first ${rows[0]?.created_at.slice(11, 16) ?? '-'} last ${rows.at(-1)?.created_at.slice(11, 16) ?? '-'}`,
      );
      continue;
    }
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const res = await fetch(`${BASE}/rest/v1/bg_runs`, {
        method: 'POST',
        headers: {
          apikey: SERVICE,
          Authorization: `Bearer ${SERVICE}`,
          'Content-Type': 'application/json',
          // A slot that already has its row keeps it. See the header.
          Prefer: 'resolution=ignore-duplicates,return=minimal',
        },
        body: JSON.stringify(batch),
      });
      if (!res.ok) throw new Error(`insert for ${day} answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
      written += batch.length;
    }
    process.stdout.write(`  ${day}: ${rows.length} rows (${daily} daily)\n`);
  }
  const q = (values: number[], at: number) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(at * sorted.length))] ?? 0;
  };
  const legacy = all.map((r) => r.legacy_score);
  const careersOnly = all.filter((r) => !r.seed.startsWith('daily-')).map((r) => r.legacy_score);
  const earned = all.map((r) => r.gross_earnings);
  console.log(
    `\n  field: achievements p10 ${q(legacy, 0.1)} · p50 ${q(legacy, 0.5)} · p90 ${q(legacy, 0.9)}` +
      ` · earnings p50 €${(q(earned, 0.5) / 1e6).toFixed(1)}M` +
      ` · careers only p50 ${q(careersOnly, 0.5)}` +
      (['deep', 'standard', 'quick'] as const)
        .map((pace) => {
          const scores = all.filter((r) => r.pace === pace && !r.seed.startsWith('daily-')).map((r) => r.legacy_score);
          return ` · ${pace} ${q(scores, 0.5)} (n=${scores.length})`;
        })
        .join(''),
  );
  console.log(
    PLAN
      ? `\n  plan: ${generated} rows over ${days.length} day(s); nothing written.`
      : `\n  ✓ ${written} rows offered for ${days.length} day(s) with engine ${engine}; slots already filled were left alone.`,
  );
}

main().catch((error: unknown) => {
  console.error(`\n  ✗ seed-boards: ${(error as Error).message}\n`);
  process.exit(1);
});
