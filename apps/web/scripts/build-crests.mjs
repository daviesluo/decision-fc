#!/usr/bin/env node
/**
 * Ship the WebP artwork and leave the PNGs behind.
 *
 * The crests and trophies are stored as PNG — that is the workflow
 * (`docs/crests.md`: drop a file in and the club shows it) — and served as
 * WebP, which is 65% smaller for the same pixels and the largest single thing
 * in a cold load on a phone. `lib/assets.ts` rewrites the extension at the one
 * place every artwork URL is built.
 *
 * The twins are made by `tools/shrink-images.mjs` and **committed**. This
 * script only checks they are all there and deletes the PNGs from the build
 * output, so nothing ships twice.
 *
 * ## Why it does not convert anything
 *
 * It used to, through Chromium's canvas. That quietly made the production
 * build depend on a browser, and the Cloudflare deploy does not install one:
 * four deploys in a row went red while the live site sat on a stale version,
 * and the only symptom anywhere was `browserType.launch: Executable doesn't
 * exist`. A hand-run dev tool may need a browser. A deploy may not, and a
 * build step that reaches for one is a build step that will do this again.
 *
 * So the browser moved to the tool that is already run by hand for the same
 * assets, and what is left here is a check and a delete — no dependencies, no
 * network, milliseconds.
 *
 * A missing twin fails the build loudly rather than shipping a site that asks
 * for files which do not exist, because the fallback would hide it: a crest the
 * site cannot serve becomes a generated badge, and the game would look fine
 * while every real badge had quietly disappeared. Note that it is not a 404 —
 * Cloudflare's SPA fallback answers a missing file with 200 and the index page,
 * measured on the live site — the browser simply cannot decode HTML as an
 * image. Same outcome, and nothing downstream may assume a status code.
 *
 *   node scripts/build-crests.mjs [dist|dist-itch]
 */
import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', process.argv[2] ?? 'dist');
const DIRS = ['crests', 'trophies'];

let dropped = 0;
let pngBytes = 0;
let webpBytes = 0;
const orphans = [];
const stale = [];  // kept for the shared message below; see the note in the loop

for (const name of DIRS) {
  const dir = join(out, name);
  /*
   * A missing directory is a failure, not something to skip.
   *
   * `continue` plus a "nothing at all was dropped" check meant a build that
   * shipped *no trophy art* still passed on the strength of the crests — the
   * silent-staleness class this whole script exists to close.
   */
  if (!existsSync(dir)) {
    console.error(`\n  ✗ ${out} has no ${name}/ directory at all.`);
    console.error('    Either the build stopped copying public/, or that folder was');
    console.error('    deleted. Both ship a game with a category of art missing.\n');
    process.exit(1);
  }
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.png'))) {
    const png = join(dir, file);
    const webp = png.replace(/\.png$/, '.webp');
    if (!existsSync(webp)) {
      orphans.push(`${name}/${file}`);
      continue;
    }
    /*
     * Staleness is *not* checked here, and the reason is worth writing down
     * because the obvious check does not work.
     *
     * A twin older than its PNG is a twin of the wrong picture, and comparing
     * mtimes was the first attempt. It cannot work in this directory: the build
     * copies `public/` into the output and normalises the timestamps, so the
     * comparison always passes. It cannot work in `public/` either, because a
     * fresh clone rewrites every mtime to checkout time in arbitrary order.
     *
     * The honest signal is content, so it lives in `tools/verify-artwork.mjs`
     * against a committed hash manifest, and CI runs it. What is left here is
     * the existence check as defence in depth, which is exactly what a build
     * step should be doing.
     */
    pngBytes += statSync(png).size;
    webpBytes += statSync(webp).size;
    unlinkSync(png);
    dropped += 1;
  }
}

if (orphans.length > 0 || stale.length > 0) {
  if (orphans.length > 0) {
    console.error(`\n  ✗ ${orphans.length} image(s) have no .webp twin:`);
    console.error(`    ${orphans.slice(0, 8).join('\n    ')}`);
  }
  if (stale.length > 0) {
    console.error(`\n  ✗ ${stale.length} .webp twin(s) are older than their PNG:`);
    console.error(`    ${stale.slice(0, 8).join('\n    ')}`);
  }
  console.error('\n    The site serves WebP. A missing twin silently becomes a generated');
  console.error('    badge; a stale one serves the previous picture. Either way the game');
  console.error('    looks fine and the art is wrong.');
  console.error('\n    Fix: `node tools/shrink-images.mjs`, then commit the .webp files.\n');
  process.exit(1);
}

if (dropped === 0) {
  console.error(`build-crests: no PNGs found under ${out} — did the build copy public/?`);
  process.exit(1);
}

const mb = (n) => (n / 1048576).toFixed(2);
console.log(
  `dropped ${dropped} PNG(s) from the build: ${mb(pngBytes)} MB of PNG replaced by ` +
    `${mb(webpBytes)} MB of WebP (${Math.round((1 - webpBytes / pngBytes) * 100)}% smaller)`,
);
