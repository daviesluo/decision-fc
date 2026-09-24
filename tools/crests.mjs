#!/usr/bin/env node
/**
 * Crest helper.
 *
 *   node tools/crests.mjs list     → print every club id, name and league
 *   node tools/crests.mjs check    → report which crests are present and missing
 *   node tools/crests.mjs fetch <urlTemplate>
 *                                  → download crests from a source you supply
 *
 * The fetch template uses `{id}` for the club id, e.g.
 *
 *   node tools/crests.mjs fetch "https://your-source.example/badges/{id}.png"
 *
 * No source is hardcoded and nothing is downloaded by default. Club crests are
 * trademarked artwork, so which source you use — and whether you have the right
 * to use it — is a decision for whoever runs this, not something the repository
 * should make on their behalf.
 *
 * See docs/crests.md.
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CREST_DIR = join(root, 'apps/web/public/crests');

/** Parse the club table without importing TypeScript. */
function readClubs() {
  const source = readFileSync(join(root, 'packages/content/src/data/clubs.ts'), 'utf8');
  const rows = [...source.matchAll(/\['([a-z0-9-]+)',\s*'([a-z]{3}\.\d)',\s*'([^']+)'/g)];
  return rows.map(([, id, league, name]) => ({ id, league, name }));
}

const clubs = readClubs();
const command = process.argv[2] ?? 'check';

if (command === 'list') {
  for (const club of clubs) console.log(`${club.id.padEnd(14)} ${club.league.padEnd(7)} ${club.name}`);
  console.log(`\n${clubs.length} clubs`);
  process.exit(0);
}

if (command === 'check') {
  mkdirSync(CREST_DIR, { recursive: true });
  const present = new Set(
    readdirSync(CREST_DIR)
      .filter((f) => /\.(png|svg|webp)$/i.test(f))
      .map((f) => f.replace(/\.(png|svg|webp)$/i, '')),
  );
  const missing = clubs.filter((c) => !present.has(c.id));
  const extra = [...present].filter((id) => !clubs.some((c) => c.id === id));

  console.log(`present ${present.size}/${clubs.length}`);
  if (missing.length) {
    console.log(`\nmissing (${missing.length}):`);
    for (const club of missing) console.log(`  ${club.id.padEnd(14)} ${club.name}`);
  }
  if (extra.length) {
    // Not an error — the app ignores them — but usually a typo in a filename.
    console.log(`\nunused files (${extra.length}): ${extra.join(', ')}`);
  }
  /*
   * And whether each PNG has the WebP the site actually serves.
   *
   * `fetch` above downloads PNGs, which is correct — PNG is the source of
   * truth — but it leaves the tree in a state where `pnpm build` fails until
   * `node tools/shrink-images.mjs` has run. Saying so here is the difference
   * between a one-line next step and a confusing red build.
   */
  const untwinned = readdirSync(CREST_DIR)
    .filter((f) => f.endsWith('.png'))
    .filter((f) => !existsSync(join(CREST_DIR, f.replace(/\.png$/, '.webp'))));
  if (untwinned.length) {
    console.log(`\nno .webp twin (${untwinned.length}): ${untwinned.slice(0, 8).join(', ')}`);
    console.log('  the site serves WebP — run `node tools/shrink-images.mjs` and commit');
  }
  // Written outside public/ so it never ends up served as a static asset.
  writeFileSync(
    join(root, 'crests-missing.txt'),
    missing.map((c) => `${c.id}\t${c.name}`).join('\n') + '\n',
  );
  process.exit(0);
}

if (command === 'fetch') {
  const template = process.argv[3];
  if (!template || !template.includes('{id}')) {
    console.error('Usage: node tools/crests.mjs fetch "https://source.example/{id}.png"');
    process.exit(1);
  }
  mkdirSync(CREST_DIR, { recursive: true });

  let ok = 0;
  let failed = 0;
  for (const club of clubs) {
    const target = join(CREST_DIR, `${club.id}.png`);
    if (existsSync(target)) continue;
    const url = template.replaceAll('{id}', club.id);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      writeFileSync(target, Buffer.from(await response.arrayBuffer()));
      ok += 1;
      console.log(`  ✓ ${club.id}`);
    } catch (error) {
      failed += 1;
      console.log(`  ✗ ${club.id}  ${(error && error.message) || error}`);
    }
    // Be polite to whatever is serving these.
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  console.log(`\ndownloaded ${ok}, failed ${failed}`);
  process.exit(0);
}

console.error(`Unknown command "${command}". Use list, check or fetch.`);
process.exit(1);
