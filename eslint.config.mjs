// Lint rules, chosen to catch the bugs this codebase actually produces.
//
// Three `// eslint-disable-next-line react-hooks/exhaustive-deps` comments lived
// in the app for weeks while no ESLint existed to read them: they suppressed
// nothing, and the dependency arrays they were acknowledging went unchecked.
// This config makes them mean what they say.
//
// The engine block is the interesting part. `packages/engine` must stay pure —
// no clock, no global RNG, no DOM — or a career stops replaying from
// `seed + identity + decisions` and the leaderboard's server-side re-run
// silently disagrees with the player's screen. There is a runtime test for that
// (the purity test in `packages/engine/src/engine.test.ts`), but a test only
// sees the branches it walks; these rules see every line.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/** Anything that makes the same input produce a different output. */
const IMPURE_GLOBALS = [
  { name: 'Date', message: 'The engine has no clock. Take the value as a parameter.' },
  { name: 'performance', message: 'The engine has no clock.' },
  { name: 'setTimeout', message: 'The engine does not schedule; the caller does.' },
  { name: 'setInterval', message: 'The engine does not schedule; the caller does.' },
  { name: 'fetch', message: 'The engine performs no I/O.' },
  { name: 'localStorage', message: 'The engine performs no I/O.' },
  { name: 'window', message: 'The engine never touches the DOM.' },
  { name: 'document', message: 'The engine never touches the DOM.' },
  { name: 'navigator', message: 'The engine never touches platform APIs.' },
  { name: 'crypto', message: 'All randomness goes through rngFor(seed, channel).' },
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      // The itch.io build. Same minified output as dist/, different base URL —
      // and linting minified output produces a thousand errors about `var`.
      '**/dist-itch/**',
      '**/node_modules/**',
      // Generated, 3,800 lines, and rebuilt by `node tools/build-edge.mjs`.
      'packages/backend/edge/engine-bundle.mjs',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    // Type-aware rules would double the runtime for little here: `tsc --noEmit`
    // already runs on every package in the same CI job and catches type errors.
    languageOptions: {
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    // A disable comment that no longer suppresses anything is the problem this
    // config was added to fix. Fail on those too.
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      // A leading underscore is the codebase's existing way of saying
      // "deliberately unused" (destructured rest, ignored callback args).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Widely used and deliberate at the JSON/save boundary, where the shape is
      // genuinely unknown until it is validated.
      '@typescript-eslint/no-explicit-any': 'off',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },

  {
    // The purity test is the one place in the engine allowed to name the things
    // the engine may not use: it monkeypatches them to prove nothing calls them.
    files: ['packages/engine/**/*.ts'],
    ignores: ['packages/engine/**/*.test.ts'],
    rules: {
      'no-restricted-globals': ['error', ...IMPURE_GLOBALS],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'All randomness goes through rngFor(seed, channel), or the career stops replaying.',
        },
      ],
    },
  },

  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },

  {
    // Node scripts, but the Playwright ones pass callbacks to `page.evaluate`,
    // which run in the browser and legitimately name `document`.
    files: ['tools/**/*.{ts,mjs}', 'apps/*/scripts/**/*.mjs', '*.config.{ts,js,mjs}', 'vitest.config.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },

  {
    files: ['packages/backend/**/*.ts'],
    languageOptions: { globals: { ...globals.node, Deno: 'readonly' } },
  },

  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
