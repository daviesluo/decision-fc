/**
 * The fingerprint of the rules a career replays against — computed in one place.
 *
 * Three things need this id and they have to agree exactly, because a
 * disagreement is not a wrong number on a screen, it is a finished career the
 * leaderboard refuses:
 *
 *   · `apps/web/vite.config.ts` stamps it into every bundle as
 *     `__ENGINE_BUILD__`, and the app writes it into the save;
 *   · the edge function pins the engine bundle it verifies against by SHA-256
 *     (`tools/build-edge.mjs`);
 *   · `tools/verify-itch-fresh.ts` asks whether the tracked itch.io zip was
 *     built from the engine this commit has.
 *
 * The last one carried its own copy of the recipe below, which is the kind of
 * duplication that works until somebody changes the entry point or drops
 * `minify` on one side. Then the check compares two different hashes of two
 * different things and fails a zip that is perfectly current — or, worse, is
 * "fixed" by rebuilding a zip that was never stale.
 *
 * What is hashed is the **bundled, minified** engine + content, built from the
 * edge function's own entry point. Minifying is what makes it a fingerprint of
 * behaviour rather than of text: it strips comments and normalises whitespace,
 * so rewording a comment does not cost every in-progress career its leaderboard
 * entry, while any change that could move a number does move the hash.
 *
 * Twelve hex characters: 48 bits, which is far more than enough to tell two
 * builds apart and short enough to print in a failure message.
 */
import { buildSync } from 'esbuild';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function engineBuildId(): string {
  const built = buildSync({
    entryPoints: [join(ROOT, 'packages/backend/edge/entry.ts')],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    minify: true,
    write: false,
    logLevel: 'silent',
  });
  return createHash('sha256')
    .update(built.outputFiles[0]?.text ?? '')
    .digest('hex')
    .slice(0, 12);
}
