#!/usr/bin/env node
/**
 * Downscale bundled PNG artwork to the size it is actually displayed at.
 *
 * Crests and trophies arrive from their sources at print resolution — a 500px
 * trophy rendered into an 11px cell in the career table — and together they
 * were ~10 MB of the payload for a game whose whole point is that it loads
 * instantly on a phone. Nothing here is displayed above 72 CSS px, so 2× that
 * is already generous on a retina screen.
 *
 * Resizing runs through Chromium's canvas rather than a native image library,
 * because Playwright is already a dev dependency and adding sharp for a
 * one-off asset pass is not worth the install.
 *
 * ## It also writes the WebP the site actually serves
 *
 * The same pixels as WebP at quality 90 are 65% smaller — 4.7 MB of artwork
 * becomes 1.6 MB, which is the largest single thing in a cold load on a phone.
 * So every PNG here gets a `.webp` twin beside it, both are committed, and
 * `lib/assets.ts` asks for the WebP.
 *
 * **The twins are committed rather than produced by the build, and that is the
 * whole point of them being here.** The first version of this converted during
 * `pnpm build`, which quietly made the production build depend on a browser —
 * and the Cloudflare deploy does not install one. It went red four times in a
 * row while the site sat on a stale version. A hand-run dev tool may need
 * Chromium; a deploy may not.
 *
 * `--check` writes nothing and reports what is missing. **CI does not run this
 * tool at all** — it needs a browser, and a gate that needs a browser is how
 * the Cloudflare deploy broke. What CI runs is `pnpm verify:artwork`
 * (`tools/verify-artwork.mjs`), which compares each PNG against the hash this
 * tool recorded in `apps/web/artwork.json` and needs nothing but Node. Use
 * `--check` by hand when you want the resize answer without writing.
 *
 * Run it after dropping new artwork in. `apps/web/scripts/build-crests.mjs`
 * fails the build if a PNG has no twin, so forgetting is loud rather than
 * silent.
 *
 * Usage: node tools/shrink-images.mjs [--check]
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = [
  { dir: join(root, 'apps/web/public/crests'), max: 128 },
  { dir: join(root, 'apps/web/public/trophies'), max: 192 },
];
const check = process.argv.includes('--check');

const BROWSER = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(BROWSER) ? { executablePath: BROWSER } : {});
const page = await browser.newPage();

let before = 0;
let after = 0;
let touched = 0;

for (const { dir, max } of TARGETS) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.png'));
  for (const file of files) {
    const path = join(dir, file);
    const bytes = readFileSync(path);
    before += bytes.length;

    const b64 = bytes.toString('base64');
    const result = await page.evaluate(
      async ({ data, limit }) => {
        const image = new Image();
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
          image.src = `data:image/png;base64,${data}`;
        });
        if (image.naturalWidth <= limit && image.naturalHeight <= limit) return null;
        const scale = limit / Math.max(image.naturalWidth, image.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.naturalWidth * scale);
        canvas.height = Math.round(image.naturalHeight * scale);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/png').split(',')[1];
      },
      { data: b64, limit: max },
    );

    if (!result) {
      after += bytes.length;
      continue;
    }
    const out = Buffer.from(result, 'base64');
    // Never let a "shrink" make a file bigger — some small PNGs re-encode worse.
    if (out.length >= bytes.length) {
      after += bytes.length;
      continue;
    }
    touched += 1;
    after += out.length;
    if (!check) writeFileSync(path, out);
  }
}

// ---------------------------------------------------------------------------
// The WebP twins the site serves. Quality 90 rather than 85: the difference is
// 150 kB across the whole set, and these are flat-colour badges with hard
// edges, which is exactly the content lossy compression treats worst.
// ---------------------------------------------------------------------------
const QUALITY = 0.9;
/** PNG path → hash, so staleness is a content question. See below. */
const manifest = {};
let pngBytes = 0;
let webpBytes = 0;
let written = 0;
const missing = [];

for (const { dir } of TARGETS) {
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.png'))) {
    const path = join(dir, file);
    const twin = path.replace(/\.png$/, '.webp');
    const png = readFileSync(path);
    pngBytes += png.length;

    if (check) {
      if (!existsSync(twin)) missing.push(file);
      else webpBytes += readFileSync(twin).length;
      continue;
    }

    const dataUrl = await page.evaluate(
      async ({ data, quality }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext('2d').drawImage(image, 0, 0);
        return canvas.toDataURL('image/webp', quality);
      },
      { data: png.toString('base64'), quality: QUALITY },
    );
    if (!dataUrl.startsWith('data:image/webp')) {
      console.error(`\n  ✗ Chromium refused to encode WebP for ${file}.`);
      console.error('    Without the twins the site asks for files that do not exist,');
      console.error('    and every crest falls back to a generated badge.\n');
      await browser.close();
      process.exit(1);
    }
    const webp = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
    writeFileSync(twin, webp);
    webpBytes += webp.length;
    written += 1;
    manifest[`${dir.endsWith('crests') ? 'crests' : 'trophies'}/${file}`] = createHash('sha256')
      .update(png)
      .digest('hex')
      .slice(0, 16);
  }
}

/*
 * The manifest, and why a manifest rather than a timestamp.
 *
 * A twin older than its PNG is a twin of the wrong picture, and the obvious
 * check — compare mtimes — cannot work anywhere it would matter. The build
 * copies `public/` into its output and normalises the timestamps; a fresh
 * clone rewrites every mtime to checkout time in arbitrary order. Content is
 * the only signal that survives both, so each PNG's hash is recorded here when
 * its twin is written, and `tools/verify-artwork.mjs` recomputes and compares.
 *
 * Outside `public/` on purpose: it is a build input, not something to serve.
 */
if (!check) {
  writeFileSync(join(root, 'apps/web/artwork.json'), `${JSON.stringify(manifest, null, 1)}\n`);
  console.log(`wrote apps/web/artwork.json (${Object.keys(manifest).length} entries)`);
}

await browser.close();
const mb = (n) => `${(n / 1e6).toFixed(2)} MB`;
console.log(
  `${check ? '[check] ' : ''}${touched} files resized · ${mb(before)} → ${mb(after)} ` +
    `(${Math.round((1 - after / before) * 100)}% smaller)`,
);
if (check && missing.length > 0) {
  console.error(`\n  ✗ ${missing.length} PNG(s) have no .webp twin: ${missing.slice(0, 6).join(', ')}`);
  console.error('    The site serves WebP. Run `node tools/shrink-images.mjs` and commit.\n');
  process.exit(1);
}
console.log(
  `${check ? '[check] ' : ''}${written} WebP twin(s) written · ${mb(pngBytes)} PNG → ${mb(webpBytes)} WebP ` +
    `(${Math.round((1 - webpBytes / pngBytes) * 100)}% smaller)`,
);
