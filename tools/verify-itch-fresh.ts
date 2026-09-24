#!/usr/bin/env node
/**
 * Does the itch.io zip in the repository still match the engine in it?
 *
 * `itch/decision-fc-itch.zip` is tracked, because it is uploaded by hand
 * and "everything to upload is in `itch/`" is how the release is written down.
 * Nothing kept it current. The next engine change silently made it stale, and
 * the way that surfaces is a stranger on itch.io reporting a bug that was fixed
 * three weeks earlier — which is the worst possible place to find out.
 *
 * **What it compares, and why that is enough.** The build stamps every bundle
 * with `__ENGINE_BUILD__`: a hash of the *minified* engine and content, the
 * same fingerprint the leaderboard uses to decide whether a save can still be
 * ranked (`apps/web/vite.config.ts`). It moves when anything that could change
 * a number changes, and deliberately does not move when a comment is reworded.
 * So the zip carrying a different id from the current source means the zip
 * plays a different game, which is exactly the question.
 *
 * It does **not** rebuild anything. A rebuild would be a minute of CI and would
 * also produce a new binary to compare, which is a worse test: zips are not
 * byte-reproducible, so the only honest comparison is of what is inside them.
 *
 * **It ignores engine code nothing reaches**, and that is the fingerprint's
 * semantics rather than a hole in this check. The id is a hash of the bundle
 * built from `entry.ts`, which exports `replay` and `WORLD` — so esbuild
 * tree-shakes anything a replay cannot touch, and adding an unused export does
 * not make the zip stale. Verified both ways when this was written: an unused
 * exported constant leaves the id alone, and moving `TROPHY_SHARE_FLOOR` by
 * 0.01 fails the check immediately.
 *
 *   pnpm verify:itch
 *
 * Fix a failure with `pnpm build:itch` and commit the zip it writes.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { engineBuildId } from './engine-build-id';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const zip = join(root, 'itch', 'decision-fc-itch.zip');

if (!existsSync(zip)) {
  console.error('verify-itch-fresh: itch/decision-fc-itch.zip is missing. Run `pnpm build:itch`.');
  process.exit(1);
}

/**
 * The same fingerprint `vite.config.ts` stamps into the bundle — literally the
 * same function, which is the point. This file used to carry its own copy of
 * the esbuild call and the hash, and a check that computes its expected value
 * by a second recipe is a check that can fail a zip for being fine.
 */
const current = engineBuildId();

// The zip's entry bundle, read without unpacking the whole archive.
const listing = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' })
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);
const entry = listing.find((name) => /^assets\/index-.*\.js$/.test(name));
if (!entry) {
  console.error('verify-itch-fresh: no assets/index-*.js inside the zip.');
  console.error(`  It holds ${listing.length} files. Rebuild it with \`pnpm build:itch\`.`);
  process.exit(1);
}
const bundle = execFileSync('unzip', ['-p', zip, entry], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

if (bundle.includes(current)) {
  console.log(`verify-itch-fresh: ok — the zip carries engine ${current}`);
  process.exit(0);
}

// Name what it does carry, so the failure says how stale it is rather than
// only that it is.
const found = bundle.match(/"[0-9a-f]{12}"/g) ?? [];
console.error('\n  ✗ The itch.io zip was built from a different engine than this commit.');
console.error(`    this commit: ${current}`);
console.error(`    the zip:     ${found.slice(0, 4).join(', ') || '(no candidate found)'}`);
console.error('\n    The zip in `itch/` is what gets uploaded by hand, so a stale one');
console.error('    means players on itch.io are playing an old game and reporting bugs');
console.error('    that are already fixed.');
console.error('\n    Fix: `pnpm build:itch`, then commit itch/decision-fc-itch.zip.\n');
process.exit(1);
