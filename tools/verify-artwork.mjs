#!/usr/bin/env node
/**
 * Is every WebP twin a twin of the *current* PNG?
 *
 * The site serves WebP and the repository stores PNG
 * (`docs/crests.md`). `tools/shrink-images.mjs` writes the twins by hand
 * and both are committed, so the two can drift: edit a crest, forget the tool,
 * and the build still passes while the site serves last month's badge. That is
 * the same silent staleness as a missing twin, wearing a pass.
 *
 * **Why a hash and not a timestamp.** Comparing mtimes was the obvious check
 * and cannot work anywhere it would matter: the build copies `public/` into
 * its output and normalises the timestamps, and a fresh clone rewrites every
 * mtime to checkout time in arbitrary order. Content is the only signal that
 * survives both, so `shrink-images` records each PNG's hash in
 * `apps/web/artwork.json` as it writes the twin, and this recomputes them.
 *
 * No browser, no network, no dependencies — which is the point. The encoder
 * needs Chromium; this must not, because it runs in CI and a build step that
 * reaches for a browser is how the deploy broke in the first place.
 *
 *   node tools/verify-artwork.mjs
 *
 * Fix any failure with `node tools/shrink-images.mjs` and commit the result.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'apps/web/artwork.json');
const DIRS = ['crests', 'trophies'];

if (!existsSync(manifestPath)) {
  console.error('\n  ✗ apps/web/artwork.json is missing.');
  console.error('    Run `node tools/shrink-images.mjs` and commit it.\n');
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const missingTwin = [];
const unrecorded = [];
const stale = [];
let checked = 0;

for (const name of DIRS) {
  const dir = join(root, 'apps/web/public', name);
  if (!existsSync(dir)) {
    console.error(`\n  ✗ apps/web/public/${name}/ does not exist.\n`);
    process.exit(1);
  }
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.png'))) {
    const key = `${name}/${file}`;
    checked += 1;
    if (!existsSync(join(dir, file.replace(/\.png$/, '.webp')))) {
      missingTwin.push(key);
      continue;
    }
    const recorded = manifest[key];
    if (!recorded) {
      unrecorded.push(key);
      continue;
    }
    const actual = createHash('sha256').update(readFileSync(join(dir, file))).digest('hex').slice(0, 16);
    if (actual !== recorded) stale.push(key);
  }
}

// A manifest entry with no PNG behind it is a deleted image whose twin may
// still be sitting in `public/`, which is a file the site would still serve.
const orphanEntries = Object.keys(manifest).filter((key) => !existsSync(join(root, 'apps/web/public', key)));

const problems = [
  ['have no .webp twin', missingTwin],
  ['are not in artwork.json', unrecorded],
  ['have changed since their twin was made', stale],
  ['are in artwork.json but no longer exist', orphanEntries],
].filter(([, list]) => list.length > 0);

if (problems.length === 0) {
  console.log(`verify-artwork: ok — ${checked} PNG(s), every twin current`);
  process.exit(0);
}

console.error('');
for (const [what, list] of problems) {
  console.error(`  ✗ ${list.length} image(s) ${what}:`);
  console.error(`      ${list.slice(0, 8).join('\n      ')}`);
}
console.error('\n    The site serves WebP. A missing twin 404s and silently becomes a');
console.error('    generated badge; a stale one serves the previous picture. Either way');
console.error('    the game looks fine and the art is wrong.');
console.error('\n    Fix: `node tools/shrink-images.mjs`, then commit the .webp files');
console.error('    and apps/web/artwork.json.\n');
process.exit(1);
