/**
 * The gate that keeps the site to the game: no source, no sourcemap, no secret.
 *
 *   pnpm --filter @bg/web build
 *   node tools/verify-no-source-leak.mjs
 *
 * The deploy publishes apps/web/dist verbatim to decisionfc.com, so every file
 * in it is downloadable by anyone with the address. A browser app's *running*
 * bundle is always fetchable — that is how the web works and it is fine, the
 * bundle is minified and the leaderboard's authority lives server-side. What is
 * not fine is shipping anything that hands a visitor the readable, original
 * project: a sourcemap rebuilds the full TypeScript from the minified bundle; a
 * stray .ts/.tsx, an .env, a committed .git, a tsconfig is the source itself.
 *
 * Any of those reaching dist is the exact failure this script makes
 * impossible: the site serves the game, never the project behind it. This script
 * turns that into a build-time assertion: it walks the built directory and
 * exits non-zero if it finds a forbidden file, so CI and the deploy both refuse
 * to publish a leak. It also sanity-checks that the build actually ran (there
 * is a hashed JS asset) and that the entry bundle is minified, because an
 * un-minified bundle is readable source in all but name.
 *
 * It reads only the build output — no engine, no network — so it is safe to run
 * anywhere and costs a few milliseconds.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../apps/web/dist', import.meta.url));

// A file in the build is forbidden when its name matches any of these. Each is
// something that would let a visitor reconstruct or read the original project
// rather than merely run it.
const FORBIDDEN = [
  { test: (n) => n.endsWith('.map'), why: 'sourcemap — rebuilds the original TypeScript from the bundle' },
  { test: (n) => n.endsWith('.ts') && !n.endsWith('.d.ts'), why: 'TypeScript source' },
  { test: (n) => n.endsWith('.tsx'), why: 'TypeScript/React source' },
  { test: (n) => n === '.env' || n.startsWith('.env.'), why: 'environment file — may hold secrets' },
  { test: (n) => n === 'tsconfig.json' || (n.startsWith('tsconfig.') && n.endsWith('.json')), why: 'TypeScript project config' },
  { test: (n) => n === '.git' || n === '.gitignore', why: 'git metadata — can expose history or the repo layout' },
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

let files;
try {
  files = walk(DIST);
} catch {
  console.error(`verify-no-source-leak: ${relative(process.cwd(), DIST)} does not exist. Run \`pnpm --filter @bg/web build\` first.`);
  process.exit(1);
}

const leaks = [];
for (const full of files) {
  const name = full.split('/').pop();
  for (const rule of FORBIDDEN) {
    if (rule.test(name)) {
      leaks.push({ path: relative(DIST, full), why: rule.why });
      break;
    }
  }
}

// The build must actually have produced a hashed JS bundle, or "no leaks" is a
// lie told about an empty directory.
const jsAssets = files.filter((f) => /\/assets\/.*\.js$/.test(f));
if (jsAssets.length === 0) {
  console.error('verify-no-source-leak: no hashed JS asset in dist/assets — the build did not run or emitted nothing.');
  process.exit(1);
}

// An un-minified entry bundle is readable source with the types stripped. Vite
// minifies by default; this catches the case where minify was turned off. The
// heuristic: a minified bundle packs many statements per line, so its average
// line is long. Real minified output here is one or few very long lines.
const biggest = jsAssets.map((f) => ({ f, size: statSync(f).size })).sort((a, b) => b.size - a.size)[0].f;
const text = readFileSync(biggest, 'utf8');
const lines = text.split('\n');
const avgLineLength = text.length / lines.length;
if (avgLineLength < 200) {
  console.error(
    `verify-no-source-leak: ${relative(DIST, biggest)} looks un-minified ` +
      `(avg line ${avgLineLength.toFixed(0)} chars over ${lines.length} lines). ` +
      'Minification is off — the readable bundle would ship as source.',
  );
  process.exit(1);
}

if (leaks.length > 0) {
  console.error('verify-no-source-leak: the build ships files that expose the project source:\n');
  for (const l of leaks) console.error(`  ✗ ${l.path}  — ${l.why}`);
  console.error(`\n${leaks.length} forbidden file(s) in apps/web/dist. Fix the build so none is emitted.`);
  process.exit(1);
}

console.log(
  `verify-no-source-leak: ok — ${files.length} files in dist, ${jsAssets.length} JS asset(s), ` +
    'no sourcemaps, no source, no secrets. Entry bundle is minified.',
);
