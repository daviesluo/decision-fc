# Codebase review — a first reading

Written by someone opening this repository for the first time, in the order they
would actually meet it: root, build, CI, then each package, then the code.

The design work is strong and unusually well documented — the comments explain
*why* a number is what it is rather than restating the code. What follows is
what a new reader would flag anyway, ordered by what it would cost to be wrong.

Nothing here is a gameplay complaint.

---

## 1. The things that would bite first

### 1.1 Nothing verifies a pull request ⚠️ highest priority

Both workflows trigger on `push: branches: [main]`. **No workflow runs
`pnpm test`, `pnpm typecheck` or a build on a pull request.** A PR can be opened,
reviewed, and merged with a failing suite, a type error, or a broken build, and
the first thing that notices is production.

This is not theoretical: four pull requests were merged with zero automated
verification. They happened to be clean because the gates were run by hand.

It is also why `verify` in `deploy-edge.yml` reads as safety and is not:
`deploy` runs first and `verify` second, so a broken engine bundle is **already
live** by the time the check fails, and there is no rollback step.

**Fix:** a `ci.yml` on `pull_request` running install → typecheck → test →
build, and make the edge deploy verify a candidate before promoting it (or add a
revert step on failure).

### 1.2 A tracked build artifact that is already stale

`packages/backend/edge/engine-bundle.mjs` is 3,824 generated lines, committed,
and **currently out of date with the source it is generated from** (regenerate
with `node tools/build-edge.mjs` and diff — it changes).

Every engine or content change invalidates it. CI rebuilds it on deploy, so
production is fine, but the copy in the repository is a decoy: a reader who
opens it sees engine logic that no longer matches `packages/engine`, and anyone
who hand-deploys ships the stale one.

**Fix:** gitignore it and build it in CI, or add a check that fails when it
drifts. Do not leave a generated file in the tree that nothing keeps honest.

### 1.3 A career saved before an engine change is silently unsubmittable

`loadSave` guards two things: the save-format `version` (still `1`) and whether
every club id still exists. Neither notices that **the engine has changed**.

The submission path posts `seed + pace + identity + decisions` and the server
replays them. So a career begun before a balance change and finished after it
replays to different numbers than the local state, and the submission is
rejected — the player loses a completed run with no explanation. The engine has
changed roughly ten times in the last week.

**Fix:** stamp the save with the engine version (the bundle hash CI already
computes is ideal), and on mismatch either finish the career offline with the
leaderboard disabled and say so, or discard the save at load with a message.
Silently rejecting a finished career is the worst of the three.

### 1.4 `eslint-disable` comments, and no ESLint

Three `// eslint-disable-next-line react-hooks/exhaustive-deps` comments exist in
`AdOverlay.tsx` and `Summary.tsx`. There is no ESLint dependency, no config, and
no lint script — so those comments suppress nothing, and the dependency-array
bugs they were written to acknowledge are unchecked.

`react-hooks/exhaustive-deps` is exactly the rule that catches stale-closure bugs
in this codebase's style (several effects deliberately run once).

**Fix:** either add ESLint with `react-hooks` and keep the disables meaningful,
or delete the comments so they stop implying a safety net that is not there.

---

## 2. Structure and naming

### 2.1 The product has three names

| Where | Name |
|---|---|
| `package.json` | `football-career` |
| `wrangler.jsonc` | `football-career` |
| Domain / app title | Decision FC |
| Chinese title | 足球生涯 |

The Chinese/English split is deliberate and documented. The package and worker
names are just old. Harmless until someone greps for the project and finds
nothing, or a second worker gets created under the right name.

### 2.2 Two hosting configs, one host

`vercel.json` and `wrangler.jsonc` are both present and documented as
equivalents. Only Cloudflare is actually used. A reader cannot tell which is
live without checking the dashboard.

**Fix:** delete the unused one, or add one line to each saying which is active.

### 2.3 Two copies of the edge function

`packages/backend/edge/index.ts` (208 lines) and `index.deployed.ts` (255 lines)
implement the same endpoint. The comment explains why — the deployed variant
fetches a hash-pinned bundle at cold start because the edge bundler rejects
remote imports — but the two share ~180 lines of validation and scoring logic
that must be edited twice and can silently diverge.

**Fix:** extract the shared request/validate/score body into one module both
import, leaving only the bundle-loading difference.

### 2.4 `crests-missing.txt`

An empty file at the repository root, gitignored *and* tracked. Leftover tooling
output.

---

## 3. Code

### 3.1 `career/machine.ts` is 1,868 lines

The largest file by a factor of two, and it holds the state machine, offer
application, event expansion, season simulation orchestration, loan flow,
retirement and the world-mutation bookkeeping. It is well commented and the
sections are clear, but it is where every change lands and therefore where every
merge conflict will be.

**Fix (incremental, not a rewrite):** the loan flow (`tryOfferLoan`,
`applyLoan`, the loan-return decision) and the retirement/ending logic are both
self-contained and would move out cleanly to `career/loan-flow.ts` and
`career/retirement.ts`, taking ~450 lines with them.

### 3.2 The purity test proves less than it looks like it does

`never consults the clock or the global RNG` monkeypatches `Math.random`,
`Date.now` and `performance.now`, then plays **one** career always choosing
option 1. A `Math.random()` on any branch that path does not reach would pass.

**Fix:** loop it over several seeds and choice policies (first / last / random
with a seeded chooser). Cheap, and it is guarding the leaderboard's core
invariant.

### 3.3 Thirteen exported symbols nothing outside the engine uses

`COACHING_MAX_AGE`, `eligibleLeagues`, `isAveraged`, `leagueFloor`, `minRole`,
`minutesShare`, `overallAt`, `potentialRange`, `primaryStatsFor`,
`projectedCeiling`, `roleCap`, `roleCeiling`, `standingBonus`.

Some are deliberate (a test or a future consumer), but the public surface of
`@bg/engine` is the contract the edge function and the web app both compile
against, and a wider surface is more to keep stable.

**Fix:** drop the ones that are internal, or mark the deliberate ones with a
one-line comment saying who they are for.

### 3.4 No React error boundary

A throw inside any screen unmounts the whole app to a blank page, and the career
in `localStorage` becomes unreachable because the crash recurs on reload. For a
game whose entire state is one save key, a boundary offering "reload" and
"discard this career" is a few lines and prevents the worst outcome.

### 3.5 Bundle size: 467 KB raw / 152 KB gzip

Large for a card-driven game with no images in the JS. The content pack is the
bulk — 191 clubs, both full i18n dictionaries, and the club-name tables — and
**every user downloads both languages**.

**Fix:** dynamic-import the non-active locale. Roughly a third of the payload for
one `import()`.

---

## 4. Testing

What exists is good and unusually purposeful: 68 tests, `pnpm market` (14
realism rules over 500 careers), `pnpm balance` (20,000 careers against an
acceptance table), and `tools/verify-ui.mjs` (a real career at 375×667 in both
languages, asserting no overflow and no untranslated engine ids).

Gaps a reader would name:

- **None of it runs in CI** (§1.1). The three most valuable harnesses in the
  repo are manual.
- **`apps/web` has two test files** (`ads.test.ts`, `daily.test.ts`) covering
  pure helpers. Nothing tests `game.ts` — `loadSave`'s guards, `indexFor`,
  `turningPoints` — which is where the app's own logic lives.
- **No test asserts the two edge variants agree.** §2.3's duplication is exactly
  the kind that drifts silently.
- `pnpm balance` takes ~2 minutes for 20,000 careers, which is why it is not in
  CI. A 2,000-career smoke run would take 12 seconds and catch a gross
  regression.

---

## 5. What was done

Everything below was acted on in one change, except where the note says
otherwise. Where the review's own reasoning did not survive contact with the
code, that is recorded here rather than quietly ignored.

| # | Change | Done | Note |
|---|---|---|---|
| 1 | `ci.yml` on `pull_request` | yes | typecheck, lint, test, build, edge-bundle check, plus a 1,500-career balance smoke with `--assert` |
| 2 | Stamp saves with the engine version | yes | The stamp is a hash of the **bundled, minified** engine + content — the same entry the edge function is built from — so rewording a comment does not cost every in-progress career its leaderboard entry. A mismatched save still plays; it just says on the summary that it cannot be ranked |
| 3 | Untrack `engine-bundle.mjs` | yes | Gitignored; built by `node tools/build-edge.mjs`, and CI proves the build reproduces the engine |
| 4 | Add ESLint | yes | Plus rules banning the clock, the DOM and `Math.random` inside `packages/engine`, and `reportUnusedDisableDirectives` so a disable comment can never again suppress nothing. It found six pieces of genuinely dead code on its first run |
| 5 | Verify the edge bundle before promoting it | yes | `tools/verify-bundle.ts` replays four careers through the candidate artifact before anything points at it; the live smoke now also rolls the function back to the last known-good pin when it fails |
| 6 | Deduplicate the two edge variants | yes | `handler.ts` holds all of it; the two entries are 4 and 25 lines and differ only in where the engine comes from |
| 7 | Error boundary + discard escape hatch | yes | Outside every provider, so a throw in one still lands on something actionable. Its copy lives in `i18n/crash.ts` rather than the dictionary, because the dictionary is now fetched |
| 8 | Lazy-load the inactive locale | yes | **The stated saving was wrong.** Measured, not estimated: 152.5 kB gzip → 137.9 kB for an English player, 143.0 kB for a Chinese one. Around a tenth of the payload, not "roughly a third" |
| 9 | Split `machine.ts` | yes | 1,868 → 1,505 lines: `world-index.ts`, `loan-flow.ts`, `ending.ts`. Proved behaviour-identical — four sample careers replay to the same legacy scores as before the move |
| 10 | Widen the purity test | yes | 1 career → 36, across seeds, paces, positions, nationalities, player types and three choice policies. Confirmed to fail on an impurity planted in the loan path, which the old test passed |
| 11 | Rename package/worker | partly | `package.json` renamed. **`wrangler.jsonc` deliberately not**: that string is the live worker's identity and decisionfc.com is bound to it. Renaming it in the file does not rename the worker — the next deploy would create a second, empty one. It is a dashboard operation |
| 2.2 | Two hosting configs | yes | Each said in one line which was live; `vercel.json` was later removed, on 2026-09-23 |
| 2.4 | `crests-missing.txt` | yes | Deleted |
| 3.3 | Thirteen unused exports | yes | Twelve dropped from the engine's public surface; `roleCeiling` kept with a comment naming its consumer. `keyTeammate` and `risingProspect` were dead everywhere and are gone |
| 4 | Test gaps | yes | `game.test.ts` covers the save guards, the career's view of the world, competition naming and turning points — 13 tests where there were none. The "do the two edge variants agree" gap closed itself when they stopped being two implementations |

## 6. Original suggested order of work

| # | Change | Effort | Why now |
|---|---|---|---|
| 1 | `ci.yml` on `pull_request`: typecheck, test, build | S | Everything else is unguarded without it |
| 2 | Stamp saves with the engine version | S | Live players are silently losing finished careers |
| 3 | Untrack `engine-bundle.mjs`, build it in CI | S | A stale artifact in the tree is a trap |
| 4 | Add ESLint, or remove the disables | S | The comments claim a check that does not exist |
| 5 | Verify the edge bundle before promoting it | M | Today the broken version is live before the check runs |
| 6 | Deduplicate the two edge variants | M | ~180 lines maintained twice |
| 7 | Error boundary + "discard career" escape hatch | S | One crash currently bricks a save |
| 8 | Lazy-load the inactive locale | S | ~⅓ of the bundle |
| 9 | Split loan flow and retirement out of `machine.ts` | M | The file every change touches |
| 10 | Widen the purity test; add a fast balance smoke to CI | S | Guards the leaderboard invariant |
| 11 | Rename the package/worker to match the product | S | Tidiness |

Items 1–4 are each under an hour and remove the whole class of "merged something
broken" risk. They are worth doing before any further gameplay work.
