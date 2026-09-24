/**
 * Everything `career-submit` does, minus how it gets hold of the engine.
 *
 * There are two entry points — `index.ts` imports a locally built bundle,
 * `index.deployed.ts` fetches a hash-pinned one at cold start — and until this
 * file existed they each carried their own copy of the request validation, the
 * replay comparison, the insert and the ranking queries: about 180 lines
 * maintained twice, with nothing to stop them drifting. The only genuine
 * difference between the two is one function, so that is the only thing they
 * still hold.
 *
 * The engine is passed in as a loader rather than a value because the deployed
 * variant cannot have it before the first request.
 */

export interface Engine {
  replay: (seed: string, pace: string, identity: unknown, decisions: string[], world: unknown) => any;
  WORLD: unknown;
}

/**
 * Open on purpose, and it is worth saying why rather than leaving it to look
 * like an oversight.
 *
 * An origin allowlist here would protect nothing: anyone submitting a career
 * from a script sets whatever `Origin` header they like, so the only thing it
 * constrains is a *browser* on another site — and the one browser on another
 * site that matters is the itch.io iframe, which is where a real chunk of the
 * players are. Narrowing this would cost those players their leaderboard and
 * buy no security at all. What actually limits abuse is the rate limit below
 * and the replay: a submission is only stored if the engine reproduces it.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

interface Submission {
  seed: string;
  pace: 'quick' | 'standard' | 'deep';
  identity: {
    lastName: string;
    shirtNumber: number;
    foot: 'left' | 'right';
    countryId: string;
    position: string;
    archetype: string;
  };
  decisions: string[];
  /** `peakValue` is optional so clients that predate the board still verify. */
  claimed: { legacy: number; gross: number; fees: number; peakValue?: number };
}

/**
 * Stable dedup key so the same finished career cannot be submitted twice.
 * Identity is part of the key: the same seed and decision list produce a
 * different career for a different starting position or country, and those
 * must land as distinct runs, not dedupe into one.
 */
async function runHash(s: Submission): Promise<string> {
  const id = s.identity;
  const identityKey =
    `${id.lastName}|${id.shirtNumber}|${id.foot}|${id.countryId}|${id.position}|${id.archetype}`;
  const data = new TextEncoder().encode(`${s.seed}|${s.pace}|${identityKey}|${s.decisions.join(',')}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Which rules scored this row.
 *
 * `bg_runs.engine` has existed since the table did and has held the literal
 * `'v1'` on all 566 rows, because it was a column default and nothing ever
 * wrote it. So the boards could not answer the one question that matters after
 * a balance change: *were these scores produced by the same game?*
 *
 * On 2026-09-17 they stopped being. A medal became worth the minutes behind it
 * and a season on a bench stopped paying for development, which moved the
 * random-play median legacy from 1,750 to 1,584 — every row recorded before
 * that was scored under more generous rules and outranks an identical career
 * played today.
 *
 * This does not fix that. It makes it visible, and it makes the next one
 * visible while it is happening. The fingerprint is the deployed bundle's own
 * SHA-256, which CI sets as a function secret on every deploy and which the
 * function already refuses to start without matching — so it is the server's
 * word about which engine ran, not the client's.
 *
 * What to *do* about the mixed history was a product decision, not this file's.
 * On 2026-09-23 the old-rules rows were archived and replaced by careers played
 * through the current engine (`tools/seed-boards.ts`,
 * `sql/003-a-board-played-by-the-final-engine.sql`).
 */
const ENGINE_ID = (Deno.env.get('BUNDLE_SHA256') ?? 'unknown').slice(0, 12);

async function rest(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

/** Every leaderboard count in one round trip. See `packages/backend/sql`. */
interface RankRow {
  total: number;
  above_legacy: number;
  above_gross: number;
  above_value: number;
  seed_total: number;
  seed_above: number;
}

async function ranks(
  legacy: number,
  gross: number,
  value: number,
  seed: string,
  pace: string,
): Promise<RankRow> {
  const response = await rest('rpc/bg_ranks', {
    method: 'POST',
    body: JSON.stringify({
      p_legacy: legacy,
      p_gross: gross,
      p_value: value,
      p_seed: seed,
      p_pace: pace,
    }),
  });
  if (!response.ok) throw new Error(`ranks failed: ${response.status}`);
  return (await response.json()) as RankRow;
}

/**
 * How many submissions one address may make per minute.
 *
 * Generous by a wide margin: finishing a career takes minutes of real play, so
 * a human cannot approach this. What it stops is a script asking the server to
 * replay four hundred decisions a thousand times over, which before this was
 * free and unlimited — the endpoint runs the game engine on demand for anyone
 * who can reach it.
 */
const SUBMITS_PER_MINUTE = 20;

/**
 * The caller, as a salted hash, for the limiter's bucket.
 *
 * Never the address itself. The database is given a hash and keeps it for an
 * hour, so the limiter cannot say who did anything — only that some bucket was
 * busy, which is all it needs to know.
 */
async function callerBucket(request: Request): Promise<string> {
  /*
   * **The first hop of `x-forwarded-for` is not the caller**, and this was
   * measured rather than argued. Three requests carrying
   * `X-Forwarded-For: 10.1.1.1 / 10.2.2.2 / 10.3.3.3` produced three separate
   * buckets, each counting one: the proxy *appends*, so the first entry is
   * whatever the caller sent and the limit was bypassed by rotating a string.
   *
   * `cf-connecting-ip` is written by Cloudflare on every request and cannot be
   * forged from outside; the last hop of `x-forwarded-for` is the fallback,
   * because that is the one the nearest trusted proxy wrote.
   */
  const cloudflare = request.headers.get('cf-connecting-ip')?.trim();
  const hops = (request.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((hop) => hop.trim())
    .filter(Boolean);
  const ip = cloudflare || hops[hops.length - 1] || 'unknown';
  /*
   * The salt is a secret once one has been set.
   *
   * A hash is only a one-way function of an address if the salt is not public,
   * and this one is in the repository. `RATE_SALT` is read first so it can be
   * set as a function secret (`supabase secrets set RATE_SALT=…`) without a
   * code change; the constant is the fallback and is honest about being one.
   * The exposure it leaves is bounded by retention: `bg_rate` keeps five
   * minutes (see `packages/backend/sql/002-…`).
   */
  const salt = Deno.env.get('RATE_SALT') ?? 'decision-fc-submit';
  const data = new TextEncoder().encode(`${ip}|${salt}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sub:${hex.slice(0, 32)}`;
}

/**
 * Take one slot. **Fails open.**
 *
 * If the limiter itself is unreachable the submission goes through. That is the
 * right way round: this exists to cap abuse, not to decide whether a finished
 * career counts, and a database hiccup must never be able to throw away
 * somebody's twenty-year career.
 */
async function underLimit(request: Request): Promise<boolean> {
  try {
    const response = await rest('rpc/bg_rate_take', {
      method: 'POST',
      body: JSON.stringify({
        p_bucket: await callerBucket(request),
        p_limit: SUBMITS_PER_MINUTE,
        p_window_seconds: 60,
      }),
    });
    if (!response.ok) return true;
    return (await response.json()) !== false;
  } catch {
    return true;
  }
}

export function createHandler(engine: () => Promise<Engine>) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

    // Before the body is even parsed, so a flood of malformed requests is
    // capped too, and well before the replay, which is the expensive part.
    if (!(await underLimit(request))) {
      return new Response(JSON.stringify({ error: 'too many submissions' }), {
        status: 429,
        headers: { ...CORS, 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }

    let body: Submission;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid json' }, 400);
    }

    // Every field is bounded before it reaches the engine: replay cost scales
    // with the decision list, and unbounded strings would land in the database.
    const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];
    const ARCHETYPES = ['pace', 'technical', 'physical'];
    if (
      typeof body?.seed !== 'string' ||
      body.seed.length === 0 ||
      body.seed.length > 64 ||
      !['quick', 'standard', 'deep'].includes(body?.pace) ||
      !Array.isArray(body?.decisions) ||
      body.decisions.length > 400 ||
      body.decisions.some((d) => typeof d !== 'string' || d.length === 0 || d.length > 80) ||
      typeof body?.identity?.lastName !== 'string' ||
      body.identity.lastName.length > 40 ||
      typeof body?.identity?.shirtNumber !== 'number' ||
      !Number.isFinite(body.identity.shirtNumber) ||
      !['left', 'right'].includes(body?.identity?.foot) ||
      typeof body?.identity?.countryId !== 'string' ||
      body.identity.countryId.length > 8 ||
      !POSITIONS.includes(body?.identity?.position) ||
      // The player type changes the career the engine produces, so a missing or
      // unknown one would replay into a different run and fail verification.
      !ARCHETYPES.includes(body?.identity?.archetype) ||
      typeof body?.claimed?.legacy !== 'number' ||
      typeof body?.claimed?.gross !== 'number' ||
      typeof body?.claimed?.fees !== 'number' ||
      // Older clients predate the peak-valuation board; they are still accepted
      // and simply do not have that number checked.
      (body?.claimed?.peakValue !== undefined && typeof body.claimed.peakValue !== 'number')
    ) {
      return json({ error: 'malformed submission' }, 400);
    }

    // ---- the anti-cheat: replay and compare -------------------------------
    let final;
    try {
      const { replay, WORLD } = await engine();
      final = replay(body.seed, body.pace, body.identity, body.decisions, WORLD);
    } catch (error) {
      return json({ error: `replay failed: ${(error as Error).message}` }, 422);
    }
    if (final.phase !== 'summary' || !final.retirement) {
      return json({ error: 'decision list does not reach retirement' }, 422);
    }

    const actual = {
      legacy: final.retirement.legacyScore,
      gross: final.totals.grossEarnings,
      fees: final.totals.transferFees,
      peakValue: final.totals.peakMarketValue,
    };
    if (
      actual.legacy !== body.claimed.legacy ||
      actual.gross !== body.claimed.gross ||
      actual.fees !== body.claimed.fees ||
      (body.claimed.peakValue !== undefined && actual.peakValue !== body.claimed.peakValue)
    ) {
      return json({ error: 'claimed scores do not reproduce', actual }, 422);
    }

    // ---- store (idempotent on run_hash) -----------------------------------
    const hash = await runHash(body);
    const insert = await rest('bg_runs', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({
        seed: body.seed,
        pace: body.pace,
        identity: body.identity,
        decisions: body.decisions,
        run_hash: hash,
        // Which rules scored it. See `ENGINE_ID`.
        engine: ENGINE_ID,
        legacy_score: actual.legacy,
        gross_earnings: actual.gross,
        transfer_fees: actual.fees,
        peak_market_value: actual.peakValue,
        peak_overall: final.totals.peakOverall,
        ending_id: final.retirement.endingId,
        country_id: body.identity.countryId,
        seasons: final.seasons.length,
      }),
    });
    if (!insert.ok && insert.status !== 409) {
      return json({ error: `store failed: ${insert.status}` }, 500);
    }

    // ---- ranks ------------------------------------------------------------
    const counts = await ranks(actual.legacy, actual.gross, actual.peakValue, body.seed, body.pace);
    const board = (above: number, total: number) => ({
      rank: above + 1,
      total,
      percent: total > 0 ? Math.max(0.01, Number((((above + 1) / total) * 100).toFixed(2))) : 100,
    });

    // The fourth board is everybody who played *this* world: same seed, same
    // pace. On the daily challenge that is the whole field and it is the board
    // the feature exists for; on a one-off seed it is a field of one and the
    // client does not show it. The server needs no clock and no opinion about
    // which seed today's is, so there is nothing here for a client to lie
    // about.
    return json({
      verified: true,
      boards: {
        legacy: board(counts.above_legacy, counts.total),
        wealth: board(counts.above_gross, counts.total),
        value: board(counts.above_value, counts.total),
        sameWorld: board(counts.seed_above, counts.seed_total),
      },
    });
  };
}
