#!/usr/bin/env node
/**
 * Is what decisionfc.com serves what this tree builds?
 *
 * **This exists because of a production outage nothing else could see.** On
 * 2026-09-18 `apps/web/scripts/build-crests.mjs` was made part of `pnpm build`
 * and it needed Chromium; the Cloudflare deploy installs no browser, so four
 * deploys went red in a row while the live site sat three commits behind. Every
 * local gate was green, CI was green, and the only way it was found was curling
 * the site by hand. A deploy that fails is not the dangerous case — a deploy
 * that fails *while everything else says it is fine* is.
 *
 * What it compares is the **entry bundle and stylesheet filenames**, which Vite
 * names by a hash of their contents. That is exactly the right question and it
 * is self-correcting in both directions: a commit that changes nothing the app
 * ships produces the same filenames and reads as current, which it is; and a
 * commit that changes one character of one component produces a different
 * filename that only a real deploy can put on the site.
 *
 * It also checks the engine fingerprint inside the served bundle against
 * `tools/engine-build-id.ts`, which is the same number `pnpm verify:itch`
 * compares and the same one the leaderboard's replay check uses. That is
 * narrower than the filenames — it moves only when a rule moves — but it is the
 * one that says whether a career submitted from the live site will verify.
 *
 *   pnpm build && pnpm verify:live
 *   pnpm verify:live -- --wait=180     # poll while a deploy propagates
 *   SITE=https://staging.example pnpm verify:live
 *
 * It needs `apps/web/dist` to exist, so it runs after a build and never before.
 *
 * ## Two different bad answers, two different exit codes
 *
 * **Exit 1 — the site is serving something else.** A document came back and it
 * names a different bundle. That is the fault this tool exists for, and it is
 * worth a red build.
 *
 * **Exit 2 — the site would not answer at all.** Measured on the first run:
 * Cloudflare answered the GitHub Actions runner `403` for three solid minutes
 * while the same request from a laptop got `200`, because the runner's address
 * is in a datacentre range that Cloudflare's bot protection blocks. The site
 * was perfectly current the whole time. A checker that cannot see the site
 * knows nothing about it, and turning that into "the deploy failed" is a false
 * alarm — which is worse than no alarm, because it is the thing that teaches
 * somebody to ignore a red X. So the callers treat 2 as a warning and 1 as a
 * failure. If this is still warning in a month, the honest fix is a Cloudflare
 * rule that lets the checker through, not a quieter check.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { engineBuildId } from './engine-build-id';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = (process.env.SITE ?? 'https://decisionfc.com').replace(/\/$/, '');
const WAIT = Number(process.argv.find((a) => a.startsWith('--wait='))?.slice(7) ?? 0);

const distIndex = join(root, 'apps/web/dist/index.html');
if (!existsSync(distIndex)) {
  console.error('\n  ✗ verify-live: apps/web/dist/index.html is missing.');
  console.error('    Run `pnpm build` first — this compares the live site against a build.\n');
  process.exit(1);
}

interface Shell {
  js: string | null;
  css: string | null;
}

/** The two hashed filenames the shell is made of. */
function shellOf(html: string): Shell {
  return {
    js: html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0] ?? null,
    css: html.match(/assets\/index-[A-Za-z0-9_-]+\.css/)?.[0] ?? null,
  };
}

const local = shellOf(readFileSync(distIndex, 'utf8'));
if (!local.js || !local.css) {
  console.error('\n  ✗ verify-live: the local build has no hashed entry bundle or stylesheet.');
  console.error(`    js: ${local.js ?? '(none)'}   css: ${local.css ?? '(none)'}`);
  console.error('    The build output changed shape; fix the patterns in tools/verify-live.mjs.\n');
  process.exit(1);
}

async function main(): Promise<void> {
  // Cache-busted: a CDN edge that still holds the old document is precisely the
  // thing being looked for, and asking for it through a query string means the
  // answer is about the origin rather than about one edge's memory.
  async function liveShell(): Promise<Shell> {
    const res = await fetch(`${SITE}/?verify-live=${Date.now()}`, {
      headers: {
        'cache-control': 'no-cache',
        // Asking the way a browser asks. It is our own site and a public page,
        // and the point is to see what a player would see. It does not get past
        // the block described above — that is about the caller's address, not
        // the headers — but it removes the trivial explanation.
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en',
        'user-agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) throw new Error(`${SITE} answered ${res.status}`);
    return shellOf(await res.text());
  }

  const deadline = Date.now() + WAIT * 1000;
  let lastError: Error | null = null;
  const look = () =>
    liveShell().catch((error: unknown) => {
      lastError = error as Error;
      return null;
    });
  const isThisBuild = (shell: Shell | null) => shell !== null && shell.js === local.js && shell.css === local.css;

  let live = await look();
  while (!isThisBuild(live) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 15_000));
    process.stdout.write('.');
    live = await look();
  }

  if (!live) {
    console.error(`\n  ! verify-live: could not read ${SITE} — ${(lastError as Error | null)?.message ?? 'unknown error'}`);
    console.error('    Nothing is known about the deploy either way: this says the checker was');
    console.error('    refused, not that the site is stale. Cloudflare blocks datacentre');
    console.error('    addresses, which is what a CI runner has. Check it by hand, or let the');
    console.error('    checker through in Cloudflare.\n');
    process.exit(2);
  }

  if (live.js !== local.js || live.css !== local.css) {
    console.error(`\n  ✗ ${SITE} is not serving this build.`);
    console.error(`    this tree builds: ${local.js}  ${local.css}`);
    console.error(`    the site serves:  ${live.js ?? '(none)'}  ${live.css ?? '(none)'}`);
    console.error('\n    A deploy failed, or has not run. Check the Deploy to Cloudflare workflow —');
    console.error('    a red deploy leaves the previous version live and every other gate green.\n');
    process.exit(1);
  }

  // And the engine fingerprint inside the bundle the site actually serves.
  const bundle = await fetch(`${SITE}/${live.js}`).then((r) => (r.ok ? r.text() : ''));
  const current = engineBuildId();
  if (!bundle) {
    console.error(`\n  ✗ ${SITE} serves a document naming ${live.js}, and will not serve that file.`);
    console.error('    That is the site\'s own fault rather than an unreachable checker: it just');
    console.error('    answered the document from the same address.\n');
    process.exit(1);
  }
  if (!bundle.includes(current)) {
    console.error(`\n  ✗ ${SITE} serves the right filenames and a different engine.`);
    console.error(`    this commit: ${current}`);
    console.error('    That should be impossible — the same bundle cannot hold two engines.');
    console.error('    Suspect a CDN serving a stale file under a current name.\n');
    process.exit(1);
  }

  console.log(`\n  ✓ ${SITE} is serving this build: ${local.js}`);
  console.log(`    engine ${current}\n`);
}

// Not top-level `await`: tsx loads a `.ts` tool as CommonJS, where a module
// that awaits at the top level fails outright with ERR_REQUIRE_ASYNC_MODULE.
main().catch((error: unknown) => {
  console.error(`\n  ✗ verify-live: ${(error as Error).message}\n`);
  process.exit(1);
});
