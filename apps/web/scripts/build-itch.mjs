#!/usr/bin/env node
/**
 * Turn `dist-itch` into the zip itch.io wants.
 *
 * `vite build` with `ITCH_BUILD=1` already handles the two things that would
 * white-screen the game on itch — a relative `base`, and a language switch that
 * leaves itch's address bar alone. What is left is the head of index.html,
 * which is written for a site rather than for an iframe:
 *
 *   · **Search tags** — canonical, hreflang, Open Graph, JSON-LD, the Baidu
 *     ownership tag. On itch every one of them is a claim about a page that is
 *     not this one. The canonical is the harmful one: it tells a crawler that
 *     this document *is* decisionfc.com, which is the sort of thing that gets a
 *     duplicate flagged rather than a rank shared.
 *   · **The AdSense loader** — already inert off-domain (it checks the hostname
 *     before it loads anything), but shipping an ad script to a host that never
 *     runs it is noise in a zip somebody else serves.
 *   · **Absolute links** — `/football-career-games/`, `/privacy/`, the icons and
 *     the manifest all point at itch's root. The two content links become
 *     absolute decisionfc.com URLs, which is where a curious player should end
 *     up anyway; the manifest goes, because a PWA install prompt inside an
 *     iframe is not a thing.
 *
 * The asset URLs Vite itself wrote — the bundle, the stylesheet, the icon
 * links, the `@font-face` sources — need nothing: `base: './'` rewrites all of
 * them. What it cannot rewrite is a URL it never parsed, which is the two links
 * inside the boot markup and every path the app builds at runtime from a club
 * or trophy id. Those go through `asset()`, and the sweep at the bottom of this
 * file is what proves none was missed.
 *
 * Every replacement asserts. If the markup moves and a pattern stops matching,
 * this fails loudly at build time rather than shipping a zip that 404s halfway
 * down — which is exactly the failure nobody notices until a stranger says the
 * game is broken.
 *
 *   ITCH_BUILD=1 vite build && node scripts/build-itch.mjs
 *   (or just: pnpm build:itch)
 */
import { readdir, readFile, stat, writeFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist-itch');
const outDir = join(here, '..', '..', '..', 'itch');
const zipPath = join(outDir, 'decision-fc-itch.zip');

/** Replace, and fail the build if there was nothing to replace. */
function must(text, pattern, replacement, what) {
  const next = text.replace(pattern, replacement);
  if (next === text) {
    console.error(`\n  ✗ build-itch: could not find ${what} in the built index.html.`);
    console.error('    The markup changed. Fix the pattern in scripts/build-itch.mjs —');
    console.error('    shipping the zip without this edit puts a wrong canonical, or a');
    console.error('    broken link, on somebody else’s page.\n');
    process.exit(1);
  }
  return next;
}

// ---------------------------------------------------------------------------
// index.html
// ---------------------------------------------------------------------------
const indexPath = join(dist, 'index.html');
let html = await readFile(indexPath, 'utf8');

// The whole search block, from the comment that introduces it to the last
// Twitter tag. One contiguous region on purpose — it is written and maintained
// as one, and removing it in pieces is how half of it survives a refactor.
html = must(
  html,
  /\n\s*<!--\s*\n\s*Search\.[\s\S]*?<meta name="twitter:image"[^>]*>\n/,
  '\n    <title>Decision FC — a football career game you play in five minutes</title>\n',
  'the search/meta block',
);
html = must(html, /\n\s*<script type="application\/ld\+json">[\s\S]*?<\/script>\n/, '\n', 'the JSON-LD block');
html = must(html, /\n\s*<!--\s*\n\s*Site ownership[\s\S]*?baidu-site-verification"[^>]*>\n/, '\n', 'the Baidu tag');
html = must(html, /\n\s*<!--\s*\n\s*Google AdSense[\s\S]*?<\/script>\n/, '\n', 'the AdSense loader');
html = must(html, /\n\s*<link rel="manifest"[^>]*>\n/, '\n', 'the manifest link');
// The icon and stylesheet hrefs need no help: Vite rewrites the attributes it
// can resolve in index.html against `base`, which is what `base: './'` is for.
// What it does not touch is a URL it never parsed — the two links inside the
// boot markup below, and every path the app builds at runtime.
html = must(html, 'href="/football-career-games/"', 'href="https://decisionfc.com/football-career-games/"', 'the comparison link');
html = must(html, 'href="/privacy/"', 'href="https://decisionfc.com/privacy/"', 'the privacy link');

// The boot screen is the loading splash here, not an SEO surface. One line
// changes: the footer should send a player to the game's home rather than
// describe a site they are not on.
html = must(
  html,
  /<a class="boot-link" href="https:\/\/decisionfc\.com\/football-career-games\/">[^<]*<\/a>/,
  '<a class="boot-link" href="https://decisionfc.com/">decisionfc.com</a>',
  'the boot footer link',
);

await writeFile(indexPath, html);

// ---------------------------------------------------------------------------
// files that belong to the site, not to the game
// ---------------------------------------------------------------------------
// robots.txt, the sitemap, llms.txt, ads.txt, the social card, the IndexNow key
// and the PWA manifest all describe decisionfc.com. Inside somebody else's zip
// they are at best noise and at worst confusing — an ads.txt on itch's host
// claims an ad relationship that does not exist there.
//
// The three static pages go for the same reason. `/privacy/`, `/about/` and
// `/contact/` are the site's — the last two exist for the AdSense review — and
// a copy inside the zip is a copy nobody keeps up to date. They also link to
// each other root-absolutely, which on itch's host is a link to itch's own
// 404: `about/` and `contact/` were shipping exactly that until the sweep
// below learned to look for `/privacy/` and failed the build on them.
const SITE_ONLY = [
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
  'ads.txt',
  'og-card.png',
  'manifest.webmanifest',
  '_headers',
  'privacy',
  'about',
  'contact',
];
for (const name of SITE_ONLY) await rm(join(dist, name), { recursive: true, force: true });
// The IndexNow key is named after its own contents, so match it by shape.
for (const entry of await readdir(dist)) {
  if (/^[0-9a-f]{16,128}\.txt$/.test(entry)) await rm(join(dist, entry), { force: true });
}

// ---------------------------------------------------------------------------
// nothing absolute may survive
// ---------------------------------------------------------------------------
// The check that makes the rest of this file trustworthy: walk everything that
// ships and fail on a leftover root-absolute reference to a file we own. A
// single one of these is a 404 on itch and nothing at all in local testing,
// because locally the game *is* served from the root.
// `privacy` is in here for a different reason from the rest: the folder is
// deleted from the zip above, so a root-absolute link to it is not a missing
// asset but a link out of the game into itch's own 404 — which is how the
// Settings sheet's privacy link shipped broken until `PRIVACY_URL` existed.
const OWN = ['crests', 'trophies', 'fonts', 'icons', 'assets', 'privacy'];
const offenders = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    if (!/\.(html|css|js|webmanifest|json)$/.test(entry.name)) continue;
    const text = await readFile(path, 'utf8');
    for (const folder of OWN) {
      // `"/crests/` and `(/fonts/` and `'/icons/` — a quote or a bracket
      // immediately before the slash is what makes it a URL rather than prose.
      const hit = new RegExp(`["'(\`]/${folder}/`).exec(text);
      if (hit) offenders.push(`${relative(dist, path)} → ${hit[0]}`);
    }
  }
}
await walk(dist);
if (offenders.length > 0) {
  console.error('\n  ✗ build-itch: absolute URLs survived, and each is a 404 on itch.io:');
  for (const line of offenders) console.error(`    · ${line}`);
  console.error('    Route it through `asset()` or `PRIVACY_URL` in src/lib/assets.ts.\n');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// zip it
// ---------------------------------------------------------------------------
// index.html has to sit at the root of the archive — itch looks for it there
// and shows "no index.html" if it is one directory down, which is the classic
// way to waste an upload.
await mkdir(outDir, { recursive: true });
await rm(zipPath, { force: true });
execFileSync('zip', ['-r', '-q', '-X', zipPath, '.'], { cwd: dist });

const { size } = await stat(zipPath);
const files = [];
await (async function count(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await count(path);
    else files.push(path);
  }
})(dist);

console.log(`\n  ✓ ${relative(join(here, '..', '..', '..'), zipPath)}`);
console.log(`    ${files.length} files, ${(size / 1024 / 1024).toFixed(1)} MB`);
console.log('    index.html is at the root of the archive, which is where itch looks.\n');
