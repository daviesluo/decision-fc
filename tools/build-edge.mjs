#!/usr/bin/env node
/**
 * Bundle the engine + content for the career-submit edge function.
 *
 * The edge runtime (Deno) gets two files: the function entry
 * (packages/backend/edge/index.ts) and this bundle, so it never has to
 * resolve monorepo imports. Rebuild after ANY engine or content change and
 * redeploy the function — a drifted bundle would reject every legitimate
 * submission, because clients would be playing a different game.
 */
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
execSync(
  'npx esbuild packages/backend/edge/entry.ts --bundle --format=esm --platform=neutral ' +
    '--outfile=packages/backend/edge/engine-bundle.mjs --log-level=warning',
  { cwd: root, stdio: 'inherit' },
);
console.log('bundled packages/backend/edge/engine-bundle.mjs');
