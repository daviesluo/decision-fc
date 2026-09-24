# Deployment and Backend

## 1. Web app hosting (Cloudflare Workers)

**Cloudflare Workers (static assets)** — `wrangler.jsonc` at the repo root. It
deploys from Git, so the repository and the live site cannot drift apart.

1. Cloudflare dashboard → Workers & Pages → Create → import this Git repository
2. Build command: `pnpm --filter @bg/web build` (output directory is read from
   `wrangler.jsonc`: `apps/web/dist`, SPA fallback enabled)
3. Every push deploys. Local deploys also work:
   `pnpm --filter @bg/web build && npx wrangler deploy`

**Check that a deploy actually reached anybody.** A deploy that fails leaves the
previous version live and every other gate green: on 2026-09-18 the build began
needing a browser Cloudflare does not install, four deploys went red in a row,
and the site sat three commits behind while CI was passing. `pnpm verify:live`
(after `pnpm build`) compares the entry bundle and stylesheet the site serves —
Vite names both by content hash — against what the tree builds. The deploy
workflow runs it straight after `wrangler deploy`, and
`.github/workflows/live.yml` runs it again every morning, which is what catches
a deploy that never started.

**Where CI looks, and why.** On its first run decisionfc.com answered the
GitHub runner `403` for three minutes while answering `200` to the same request
from a laptop — the zone's bot protection doing what it is for. So CI checks
the worker's own address, `football-career.daviesluo.workers.dev`, which serves
the same deployment and is not in that zone, and fails the build if it is
stale. It then tries decisionfc.com too, and there exit 2 ("the site would not
answer me") is a warning while exit 1 ("a different build is live there") still
fails. No WAF rule is needed.

**⚠️ Mainland China access**: edge networks of both platforms are unreliable
from the mainland (intermittent, high latency). Treat them as the overseas and
internal-testing environment. A production build for Chinese users needs a
domestic cloud (Tencent/Alibaba), an ICP-filed domain and a domestic CDN — the
same compliance chain the WeChat build needs, so run the two together.

---

## 2. Leaderboard backend (Supabase) — LIVE

The three global boards (achievements / career earnings / highest market value)
are served by Supabase project `dyuilyooirtpfyqplfve` (free tier). The third board ranks on `peak_market_value` — a Transfermarkt-style
career peak — rather than on cumulative fees; fees are still recorded.

**Most of the field is simulated, on purpose** (since 2026-09-23).
`.github/workflows/seed-boards.yml` runs `tools/seed-boards.ts` every six hours
with the service-role key from the same environment `deploy-edge.yml` uses,
writing today's and tomorrow's simulated careers and daily-challenge runs with
`seeded = true`. It refuses to write anything unless the edge bundle it builds
from `main` is the one the server has pinned. `bg_ranks` counts only rows whose
`created_at` has passed, which is what makes each day's challenge board fill
from midnight. After an engine change that moves a score, empty the seeded rows
and dispatch the workflow with `backfill` — see `packages/backend/sql/003-…`
and the seeded-rows invariant in handbook §1.

**The schema is now in the repository.** Everything below was first applied by
hand, straight to the database, which meant there was no way to read what the
database looked like and no way to recreate it. `packages/backend/sql/` fixes
that: one file per change, idempotent, applied in order, with the reasoning
next to each object. It is not a migration framework and does not want to be —
one project, one directory, read it top to bottom.

To apply a file, run it in the Supabase SQL editor. Re-applying is safe by
design. **Verify a grant by asking
the database rather than by reading the SQL** — `has_function_privilege(...)`
per role — because Supabase grants EXECUTE on every new public function to
`anon` and `authenticated` *directly*, so `revoke ... from public` looks like a
restriction and is not one. That was measured, not assumed: `bg_ranks` answered
an anon request with the whole score distribution until the revoke named both
roles.

| Piece | State |
|---|---|
| `bg_runs` table | Created (migration `bg_leaderboard_init`). RLS enabled, **no anon policies** — the edge function's service role is the only write path. |
| `bg_runs` indexes | Three descending board indexes, a unique `run_hash`, and `(seed, pace, legacy_score desc)` for the daily board. `bg_runs_country_idx` was dropped: `country_id` has never been filtered on and Supabase reported the index as never used. |
| `bg_rate` table + `bg_rate_take()` | The rate limit. One row per bucket per minute, keyed by a **salted hash** of the caller's address and swept after an hour, so it can say a bucket was busy and never who. Submissions are capped at 20 per minute per address, checked before the body is parsed and long before the replay. Fails **open**: a limiter that cannot be reached must not throw away a finished career. |
| `bg_ranks()` | All four boards in one round trip. It replaced four `count=exact` HEAD requests per submission — four full scans each time, invisible at a few hundred rows and linear from there. |
| `bg_events` table + `bg_event()` | The funnel. One integer per event name per day, nothing else; the only function the anon key may call. See `docs/tech-plan.md` §7. |
| `career-submit` edge function | `packages/backend/edge/handler.ts`, behind two thin entries — `index.deployed.ts` (what runs; hash-pinned bundle) and `index.ts` (local; bundle off disk). Replays every submission through the real engine and rejects any score the replay does not reproduce. **Deployed and live-tested** (verified accept, tampered-score 422, duplicate dedupe). |
| Engine bundle | `packages/backend/edge/engine-bundle.mjs`, built by `node tools/build-edge.mjs` from `@bg/engine` + `@bg/content`. **Generated and untracked** — build it before serving locally. Rebuilt and redeployed automatically on every push to `main` (below). |
| Client | `apps/web/src/lib/leaderboard.ts`. Fire-and-forget POST on career completion with an 8 s timeout; any failure falls back to the local percentile estimate in `game.ts`, so the summary screen never blocks on the network. |

**CORS stays open, on purpose.** An origin allowlist here would protect
nothing: anyone submitting from a script sets whatever `Origin` header they
like, so the only thing it constrains is a browser on another site — and the one
that matters is the itch.io iframe, where a real share of the players are.
Narrowing it would cost those players their leaderboard and buy no security.
What limits abuse is the rate limit and the replay.

**How the deployed function loads the engine.** The edge bundler rejects
remote imports, so the deployed variant does not use the
relative import in `index.ts`. Instead a minified copy of the bundle sits in
the project's public `edge-code` storage bucket (`engine-bundle-<hash>.mjs`);
at cold start the function fetches it, checks it against a **SHA-256 pin**, and
imports it through a `data:` URL. The pin means a tampered bucket object can
only make the function fail, never run foreign code.

**Redeploying is automatic, and nothing is promoted unproven.**
`.github/workflows/deploy-edge.yml` rebuilds the bundle on every push to `main`
that touches the engine, the content pack or the edge function — then, *before*
uploading or repointing anything, runs `tools/verify-bundle.ts` on that exact
minified artifact: four careers played by the commit's engine and replayed
through the candidate, with every leaderboard number required to match. Only
then does it upload, repoint and smoke-test. The object is named
after its own SHA-256, so the job is idempotent; the pin reaches the function
as the `BUNDLE_URL` / `BUNDLE_SHA256` secrets, with the literals in
`index.deployed.ts` as the hand-deploy fallback. It needs
`SUPABASE_ACCESS_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY` as repository secrets
and **fails without them**, because a green run that did nothing is how the
leaderboard silently went stale once already. A second job runs `npx tsx
tools/edge-smoke.ts` regardless: it plays a real career, submits it, and fails
if the server's replay cannot reproduce it. That job needs no secrets, so it
catches a broken deploy however it broke — and it acts on what it finds: on
green it records the working pin as `current.json` in the bucket, and on red it
repoints the function back to whatever that file last named. Leaving a broken
leaderboard live while a build is red is visible to whoever reads Actions and
invisible to everyone whose career is being rejected.

**How the anti-cheat works.** The engine is pure, deterministic TypeScript:
the same `seed + identity + decision list` always reproduces the same career
(unit-tested property — *replays a recorded decision list back to the same
result*). The client submits exactly those inputs plus the claimed scores; the
server replays them through the identical engine bundle and compares. There is
no way to post a score the engine itself will not produce. Deduplication is by
`run_hash` = SHA-256 of `seed | pace | identity | decisions`.

**Submission contract** (`POST /functions/v1/career-submit`):

```jsonc
{
  "seed": "…",                 // ≤ 64 chars
  "pace": "standard",           // quick | standard | deep (was blitz; see sql/004)
  "identity": { "lastName": "…", "shirtNumber": 10, "foot": "right",
                 "countryId": "eng", "position": "ST" },
  "decisions": ["academy:…", "…"],   // ≤ 400 entries, each ≤ 80 chars
  "claimed": { "legacy": 0, "gross": 0, "fees": 0, "peakValue": 0 }
}
// → { verified: true, boards: { legacy|wealth|value: { rank, total, percent } } }
```

`percentileFor()` in `apps/web/src/lib/game.ts` keeps a local approximation of
the three distributions (regenerated from the 20 000-career balance sweep) as
the offline fallback; its anchors are the contract the backend satisfies.

### China partition (later)

The WeChat build will use WeChat CloudBase (no ICP needed for its serverless
backend, native `wx` login) with the same table shape; the client picks its
endpoint by channel. Nothing in the engine changes.

---

## 3. WeChat build

See `docs/decision-record.md` Q5 (mini-program vs mini-game — undecided).

Whichever path wins, `packages/engine` and `packages/content` are pure TS with
zero platform dependencies and can be imported by Taro or Cocos **unchanged**.
Only the `apps/web/src/` layer is rewritten.

The compliance chain (software copyright → ICP filing → entity registration)
is shared by both paths and is the longest lead-time item in the whole
project — start it in parallel, not after the port.
