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
 * Writes use the service role (available to edge functions as an env secret);
 * the table has RLS enabled with no anon policies, so this function is the only
 * write path.
 *
 * ---------------------------------------------------------------------------
 * DEPLOYED VARIANT — this file is what actually runs on Supabase.
 * The edge bundler rejects remote imports, so the
 * engine bundle is fetched from the project's public storage bucket at cold
 * start, SHA-256-pinned, and imported through a data: URL. Rebuilding and
 * redeploying it after an engine change is automatic on every push to main —
 * see .github/workflows/deploy-edge.yml and docs/maintainers-handbook.md §3.3.
 * ---------------------------------------------------------------------------
 */

import { createHandler, type Engine } from './handler.ts';

// Which bundle to load, and what it must hash to. CI sets both as function
// secrets on every deploy (.github/workflows/deploy-edge.yml); the literals are
// the fallback for a hand-deploy and the record of what was last shipped.
// Reading them from the environment is not a weaker pin: anyone who can set a
// function secret can already deploy arbitrary function code.
const BUNDLE_URL =
  Deno.env.get('BUNDLE_URL') ??
  'https://dyuilyooirtpfyqplfve.supabase.co/storage/v1/object/public/edge-code/engine-bundle-3c49664abae3.mjs';
const BUNDLE_SHA256 =
  Deno.env.get('BUNDLE_SHA256') ??
  '3c49664abae3144a5bfd60d54d3cee2bfc46e2309fceb4f5088a9bebd0ea2741';

let enginePromise: Promise<Engine> | null = null;
function engine(): Promise<Engine> {
  enginePromise ??= (async () => {
    const response = await fetch(BUNDLE_URL);
    if (!response.ok) throw new Error(`bundle fetch failed: ${response.status}`);
    const source = await response.text();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    if (hex !== BUNDLE_SHA256) throw new Error('bundle hash mismatch');
    // Base64 in chunks: spreading the whole bundle into String.fromCharCode
    // blows V8's argument limit once the bundle is big enough.
    const bytes = new TextEncoder().encode(source);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    const b64 = btoa(binary);
    return (await import(`data:text/javascript;base64,${b64}`)) as Engine;
  })();
  return enginePromise;
}

Deno.serve(createHandler(engine));
