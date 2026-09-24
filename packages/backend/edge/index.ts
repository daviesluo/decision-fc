/**
 * career-submit — leaderboard submission with server-side replay verification.
 *
 * POST { seed, pace, identity, decisions, claimed: { legacy, gross, fees } }
 *
 * The submitted career is replayed through the exact same simulation engine the
 * client runs. If the claimed scores do not reproduce, the submission is
 * rejected — there is no way to post a score the engine itself will not
 * produce. On success the run is stored and the response carries the player's
 * rank and top-percentile on the three all-time boards, plus a fourth ranking
 * the run against every career played on the same seed at the same pace, which
 * is what the daily challenge compares. Submissions are rate limited per
 * address before the replay runs. All of that lives in `handler.ts`; this file
 * only says where the engine comes from.
 *
 * ---------------------------------------------------------------------------
 * LOCAL VARIANT. `index.deployed.ts` is what actually runs on Supabase.
 *
 * This one imports the bundle straight off disk, which is what `supabase
 * functions serve` wants and what makes the function readable next to the rest
 * of the repo. The bundle is generated, not committed: run
 * `node tools/build-edge.mjs` before serving locally.
 * ---------------------------------------------------------------------------
 */

// Bundled from packages/engine + packages/content by tools/build-edge.mjs.
// @ts-expect-error — generated at build time, so it is absent in a fresh clone.
import { replay, WORLD } from './engine-bundle.mjs';
import { createHandler } from './handler.ts';

Deno.serve(createHandler(async () => ({ replay, WORLD })));
