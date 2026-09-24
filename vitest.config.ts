import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  // The app stamps saves with a hash of the engine it was built against, which
  // Vite injects at build time. Under the test runner there is no build, so
  // pin a constant — `game.test.ts` passes the value it wants explicitly.
  define: { __ENGINE_BUILD__: JSON.stringify('test') },
  resolve: {
    alias: {
      '@bg/engine': resolve(__dirname, 'packages/engine/src/index.ts'),
      '@bg/content': resolve(__dirname, 'packages/content/src/index.ts'),
    },
  },
  // `apps/**` as well as `packages/**`: the ad ladder is a product decision
  // with tests on it, and a glob that missed them let a new test file pass
  // silently by never running.
  test: { include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'], testTimeout: 30000 },
});
