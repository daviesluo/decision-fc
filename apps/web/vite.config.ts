import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { engineBuildId } from '../../tools/engine-build-id';

/**
 * A fingerprint of the rules a career replays against, stamped into the bundle.
 *
 * The leaderboard verifies a submission by re-running the same engine on the
 * server. So a career begun before a balance change and finished after it
 * replays to different numbers than the player's own screen, and the server
 * correctly rejects a run that was never cheated — the player just loses a
 * finished career with no explanation. Stamping the save with this lets the app
 * notice and say so.
 *
 * The recipe lives in `tools/engine-build-id.ts` because `pnpm verify:itch`
 * needs the identical number to decide whether the tracked itch.io zip is
 * stale, and two copies of a hash recipe agree only until somebody edits one.
 */
const ENGINE_BUILD = engineBuildId();

/**
 * The itch.io build, switched on by `ITCH_BUILD=1` (see `pnpm build:itch`).
 *
 * itch unpacks an uploaded zip into a numbered directory and serves the game
 * from `html-classic.itch.zone/html/<id>/` inside an iframe. Two consequences,
 * and both are silent white screens rather than errors:
 *
 *   · every absolute URL points at the root of itch's host, not at the game —
 *     hence `base: './'`, and `lib/assets.ts` for the crests and trophies the
 *     app builds at runtime;
 *   · the address bar belongs to itch, so the language switch must not write
 *     to it (`__ITCH__` in lib/i18n.tsx).
 *
 * Everything else is the same build from the same source. The output goes to
 * `dist-itch` so it can never be mistaken for, or deployed as, the site.
 */
const ITCH = process.env.ITCH_BUILD === '1';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: ITCH ? './' : '/',
  define: {
    __ENGINE_BUILD__: JSON.stringify(ENGINE_BUILD),
    __ITCH__: JSON.stringify(ITCH),
  },
  resolve: {
    alias: {
      '@bg/engine': resolve(__dirname, '../../packages/engine/src/index.ts'),
      '@bg/content': resolve(__dirname, '../../packages/content/src/index.ts'),
    },
  },
  build: {
    target: 'es2022',
    outDir: ITCH ? 'dist-itch' : 'dist',
    // Source protection. The deploy publishes this directory verbatim, so
    // anything the build writes here is downloadable from decisionfc.com.
    // `sourcemap: false` is what keeps the site from shipping .map files — a
    // sourcemap reconstructs the original TypeScript in full, engine logic and
    // the anti-cheat with it, from the minified bundle. `minify` ensures what
    // does ship is mangled rather than readable source. These are the repo
    // defaults today, pinned here so they cannot be flipped by accident: a
    // debugging session that sets `sourcemap: true` would otherwise put the
    // whole codebase on the public web without anyone noticing. Do not enable
    // sourcemaps for a production build. tools/verify-no-source-leak.mjs fails
    // the build if a map — or any source file — reaches dist regardless.
    sourcemap: false,
    minify: 'esbuild',
  },
});
