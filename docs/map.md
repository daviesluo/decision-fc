# Map

Where everything in Decision FC lives, and the commands that build, check and
ship it. What the game is and how it is checked is [the front page](README.md);
how each system works and why, with the numbers it is held to, is
[design.md](design.md); and the rules for changing it without breaking it are the
[maintainers' handbook](maintainers-handbook.md), the one to read before
changing anything.

## Commands

The deploy, preview, live-check and leaderboard-seeding workflows named below
need the project's secrets, so the public copy of this repository carries only
`.github/workflows/ci.yml`.

```bash
pnpm install
pnpm dev          # web app → http://localhost:5173
sh bin/setup.sh   # a fresh clone: installs the workspace; safe to re-run
sh bin/gates.sh   # every check CI runs, in CI's order; stops at the first failure

# The gate. Every one of these must pass before a push, and CI runs exactly
# this set on every pull request — the logic sweeps included, at full size.
# They were "run them if you touched the engine" until a player found three
# shipped bugs in a week that every one of them would have caught.
pnpm test         # 148 tests: engine invariants, the rules the docs state,
                  # content integrity, saves, ads
pnpm typecheck    # engine + content + web — sources *and* tests
pnpm lint         # ESLint — and a static ban on impurity inside the engine
pnpm build
pnpm verify:no-leak     # the published build ships no sourcemap, no source,
                        # no secret
pnpm verify:artwork     # every committed PNG has a current WebP twin — the
                        # site serves WebP, and a missing twin is a badge that
                        # silently becomes a generated one
pnpm verify:itch        # the itch.io zip was built from this engine — nothing
                        # else notices when the hand-uploaded copy falls behind
pnpm fairness --assert  # every option does what it said · every card is a real
                        # decision · printed odds are real · no rigged start
pnpm market             # 500 played careers, 15 offer-realism rules — must
                        # print "Every rule holds" (non-zero exit otherwise)
pnpm skill --assert     # is this a luck game? same seeds, five ways of playing
pnpm deck               # would anybody ever pick the other option? prices every
                        # card's options in one currency and names the ones that
                        # are not a decision. Prints; does not fail the build
pnpm plausibility --assert  # is every career a story a fan would believe?
                        # champions from the top of their own division, promoted
                        # clubs that face the drop, bans that void the year

# The one that runs *after* the push. Needs a build, and asks the site itself
# whether the deploy reached anybody — the deploy workflow runs it, and
# .github/workflows/live.yml repeats it daily.
pnpm verify:live        # decisionfc.com is serving what this tree builds.
                        # Exit 1 = a different build is live; exit 2 = the site
                        # refused the checker. CI checks the worker's own
                        # workers.dev address strictly (SITE=…), because
                        # decisionfc.com's bot protection turns CI runners away

# The leaderboards' simulated field. Runs on a schedule in CI
# (.github/workflows/seed-boards.yml); by hand only to see what it would write.
pnpm seed:boards -- --plan --backfill   # every day since launch, nothing written

# The slow one, local only: CI runs 1,500 careers of the same harness.
pnpm balance      # 20,000-career sweep; compare to the table in design.md
                  # `--assert` fails the run on any number outside its band
pnpm par          # regenerates OUTPUT_PAR after a change to the season sim

# Mandatory after any UI change. Both, not one — a change that fixes the phone
# and breaks the computer is the normal failure here.
pnpm build && pnpm preview &  # serves the build on :4173
pnpm verify:ui                # plays a whole career at 375×667, both languages
pnpm verify:desktop           # …and at 1440×900 / 1920×1080 / 1280×720

# The reader, not the checker. Plays whole careers through the real screen —
# the full lifecycle, intro to the share sheet — and writes down every card it
# is shown: title, body, every option, every consequence line, the result that
# followed, so the copy can be read as copy. It fails on what a machine can
# judge — an unresolved {slot}, a raw i18n key, an untranslated engine id,
# text clipped by its own box, a document that scrolls, a console error, a
# broken image — and, through the app's opt-in state hook (`fc:testhook`), on
# a season football would not allow: a banned season with appearances in it,
# a keeper credited with goals, an age that skips a year.
pnpm playtest -- --combo=zh/daily/gk --careers=100 --out=/tmp/pt/zh-daily-gk
                                       # one combination of 2 languages ×
                                       # 4 modes (3 paces + the daily) ×
                                       # 4 profiles (3 types + the keeper);
                                       # all 32 × 100 is the full
                                       # 3,200-career sweep (needs the preview)
node tools/read-playtest.mjs /tmp/pt/*.jsonl > copy.txt  # …then read it:
                                       # one of each distinct screen, numbers
                                       # normalised, frequency beside it

npx tsx tools/pace.ts         # are the three paces the same difficulty?
node tools/build-edge.mjs     # build the (untracked) leaderboard engine bundle
npx tsx tools/verify-bundle.ts # …and prove it reproduces this engine
pnpm seo                      # is the site findable? (needs the preview above)
node tools/baidu-push.mjs     # submit the sitemap's URLs to Baidu (needs a token)
node tools/indexnow.mjs       # …and to Bing/Yandex/Seznam/Naver via IndexNow
                              # (no token: the key is published on the site).
                              # The deploy runs it; this is for pushing by hand
pnpm build:itch               # the itch.io build → itch/decision-fc-itch.zip
node tools/itch-assets.mjs    # …its cover + iPhone screenshots, and the proof
                              # the zip works from a nested path (docs/itch-io.md);
                              # --only=en|zh re-shoots one language, keeps the other;
                              # --frames=4-offer replaces one picture from any career;
                              # every run's frames are kept in itch/takes/ (ignored);
                              # one player per picture; run --frames= in parallel;
                              # --frames=cover plays the cover its own career;
                              # --cover redraws the cover from itch/cover-shot.png
node tools/og-card.mjs        # rebuild the 1200x630 social card
node tools/crests.mjs check   # crest asset status
node tools/icons.mjs          # rebuild the PWA icon set from apps/web/icon-source/
```

> `pnpm audit` is **pnpm's own security command** and would shadow a script of
> that name — which is why the offer audit is called `pnpm market`.

## Repository map

```
packages/engine    Pure TypeScript simulation. No DOM, no I/O, no clock, no
                   Math.random — all randomness is channel-addressed
                   (rngFor(seed, channel)), so a career replays exactly from
                   seed + identity + decision list. Unit-tested, and the
                   property the leaderboard's anti-cheat depends on.
packages/content   The world: 138 nationalities, 17 leagues, 191 clubs, 27 media
                   outlets, 68 real 2026/27 squad players and the full EN/zh-CN
                   dictionaries. Rosters, divisions, reputations and manager
                   styles describe the real 2026/27 opening position; the
                   big-five top flights are complete, second tiers deliberately
                   partial. Balance and copy change here; engine logic does not.
packages/backend   Supabase edge function (career-submit): replays every
                   submission server-side through a SHA-256-pinned copy of the
                   engine and stores only what reproduces. The bundle it runs is
                   proven against this repo's engine before it is deployed, and
                   rolled back if the live check then fails. `sql/` is the
                   database itself, written down: every table, index, function
                   and grant, idempotent, one file per change.
apps/web           Vite + React 19 + Tailwind v4. Fixed one-screen layout:
                   identity on top, what happened in the middle, the decision
                   under your thumb. Nothing scrolls (verified at 375×667 in
                   both languages).
itch/              what gets uploaded to itch.io: the playable zip, the cover
                   and the screenshots. Generated — see docs/itch-io.md.
tools/             balance sweep, offer audit, pace probe, full-career UI check,
                   edge-bundle builder + verifier, crest helpers, PWA icons,
                   the live-deploy check and the leaderboard seeder with the
                   play policies it shares with the skill gate.
bin/               setup.sh for a fresh clone; gates.sh runs every check CI
                   runs, in CI's order, and stops at the first failure.
docs/              The front page (README.md), this map, design.md (the
                   systems and the numbers they are held to), the maintainers'
                   handbook, and the design, review and release record.
```

### Where the important logic lives

| File | What it decides |
|---|---|
| `engine/career/machine.ts` | The state machine. `selectIdentity` starts a career, `decide` answers a card, and the machine runs forward on its own until it needs the player again. |
| `engine/career/world-index.ts` | "What league is this club in **now**" — a career changes the world without editing it. Reaching past this for `club.leagueId` is the most-repeated bug in the repo. |
| `engine/career/loan-flow.ts` | Loans: when one is offered, what the return card puts on the table and what either choice does. |
| `engine/career/ending.ts` | When a career stops, and the transition to the summary. |
| `engine/career/decisions.ts` | Transfer windows, renewals, academies: which clubs come calling and on what terms. |
| `engine/career/events.ts` | The event deck — **forty-eight** cards, each with its gate, its odds and a one-clause reason on every downside. Thirty in the first deck, twenty added when it was widened, two I deleted. |
| `engine/model/role.ts` | The squad ladder and `roleCeiling` — the rule that ability, not luck, decides where you stand. |
| `engine/model/growth.ts` | Two-year development cycles. **The ages are retuned** — the first curve peaked a median career at twenty-four; these peak a footballer at twenty-eight, and the three profiles visibly differ. |
| `engine/model/attributes.ts` | `START_BASE` — what a sixteen-year-old is rated. Small constant, enormous consequences (see [design.md](design.md)). |
| `engine/model/finance.ts` | Market value, fees, wages, signing bonuses, tax, spending. |
| `engine/model/market.ts` | Who is watching: form, standing and which leagues are in reach. |
| `engine/sim/trophies.ts` | Titles, continental runs and promotion/relegation. |
| `engine/career/summary.ts` | Legacy score and the twenty-five endings, ranked by rarity rather than by list order. |
| `content/src/i18n/en.ts` | **The schema.** `zh.ts` is typed against it, so a missing key is a build error, not a blank card in production. |
| `web/src/lib/game.ts` | `DISTRIBUTIONS` — percentile anchors for the three boards. Regenerate after balance changes. Also `readSave`, which decides whether a saved career resumes, and whether it can still be ranked. |
| `backend/edge/handler.ts` | The whole submission endpoint: validation, rate limit, replay, storage, ranks. Both entry points are thin wrappers around it. |
| `backend/sql/*.sql` | The database, in order. RLS on with no policies on every table, so nothing reaches them with the anon key — reads and writes go through definer functions with one shape each. |
| `web/src/lib/telemetry.ts` | The funnel: one event name per call, one integer per name per day on the server, and nothing that could identify anybody. |
| `web/src/lib/storage.ts` | Every key this game writes, and the rename that put them in one namespace. Runs the migration when the module evaluates, which is the only point early enough. |
| `web/scripts/build-sw.mjs` | The offline shell: network-first HTML, cache-first hashed assets, a five-file precache generated from the build. |

## Deployment

- **Web**: Cloudflare Workers (`wrangler.jsonc`); pushes to `main` deploy. See
  `docs/deploy.md`.
- **Backend**: a Supabase project with the `bg_runs` table (RLS locked, service
  role writes only) and the `career-submit` function. The engine bundle
  redeploys itself on merge — never do it by hand; see handbook §3.3.
- **What the site serves.** Only `apps/web/dist` is published, and it is built
  to carry the game and nothing of the project behind it. A browser has to receive the running
  bundle, so that minified JS is fetchable — true of every web app, and
  harmless here because it is mangled and the leaderboard's authority is
  server-side. What must never ship is anything that hands a visitor the
  *readable* project: `sourcemap: false` in `apps/web/vite.config.ts` keeps
  `.map` files (which rebuild the full TypeScript) out of the build, and the
  deploy publishes no `src/`, no `packages/`, no `.git`, no `.env`. This is
  enforced, not trusted: `pnpm verify:no-leak` (`tools/verify-no-source-leak.mjs`)
  fails the build if a sourcemap, a source file or a secret reaches `dist`, and
  both CI and the Cloudflare deploy run it before anything is published. Every
  response also carries `nosniff`,
  `SAMEORIGIN` framing (no other site can embed the game), a tight
  referrer policy, a locked-down `Permissions-Policy` and a one-year
  `Strict-Transport-Security`, set in `apps/web/public/_headers`. There is
  deliberately no Content-Security-Policy while the ad tag's origins are
  unsettled; the header file says so, at length, so the omission reads as a
  decision rather than an oversight.
- **Every pull request is playable.** `.github/workflows/preview.yml` builds each
  push to a PR and uploads it as a Worker **version**, which is never routed to
  production — decisionfc.com cannot be affected by a preview. The PR gets a
  deployment box and a comment carrying two links: a stable one per PR that
  always serves the newest commit, and a unique one per commit for comparing an
  older build. Reviewing this game by reading a diff does not work; the faults
  worth catching are the ones you only see by playing it.

  Preview builds point `VITE_SUPABASE_URL` at an unresolvable host on purpose,
  so a career played while trying a branch out **cannot write to the public
  leaderboard**. Submission fails, `submit()` catches it, and the summary falls
  back to its local percentile estimate — everything except a global rank.

  The workflow needs one repository secret, `CLOUDFLARE_API_TOKEN`, and preview
  URLs enabled on the worker. `CLOUDFLARE_ACCOUNT_ID` is optional — wrangler
  resolves the account from the token when the token reaches exactly one, and
  requiring it only added a second thing to get wrong. Without the token the
  job exits green having done nothing, exactly like the deploy workflow: a red
  X on every PR for a convenience is worse than no convenience.

## Installable on a phone, and it works with the network off

**On an iPhone the status bar is `black`, not `black-translucent`, since
2026-09-23.** iOS 26 draws a home-screen app with `black-translucent` and
`viewport-fit=cover` from the very top of the screen but sizes its window as
if it started below the status bar (WebKit bug 301108): every height comes out
one status bar short. On my iPhone the game ended 62pt above the
bottom — measured from my screenshot, where the background pattern stops at
exactly 812 of 874pt — and the intro title, centred in a box that had lost
62pt, slid up under the clock. With `black` the page starts below the clock and
every height is right; the bar is solid black against a #070a09 page. An icon
added before this change may keep the old style until it is removed from the
home screen and added again.

Two changes make the layout hold whatever the phone reports. `Screen` reserves
the top safe area even when a screen has no top slot (the intro had none), and
the intro's hero sizes itself to the box it gets — a size container, the title
scaling between 28 and 44px, the subtitle dropped rather than cut in half when
there is no room — and centres with auto margins, which never push anything
above the top. `verify-ui.mjs` now runs its phone career with an iPhone SE's
real 20pt status bar, and loads the intro on seven phone shapes with their own
safe areas — including the iOS 26 short window — asserting the hero is whole.

`apps/web/public/manifest.webmanifest` plus the icon set in
`apps/web/public/icons/`, all built from one source image by
`node tools/icons.mjs`.

**The offline shell** is `apps/web/scripts/build-sw.mjs`, which writes
`dist/sw.js` stamped with a hash of the build's own asset names. The game was
installable and then showed the browser's error page on a train, which for a
game that is entirely client-side after boot is a bug rather than a limitation:
a career in progress is in `localStorage`, and the only thing between a player
underground and the rest of their season was a bundle that never changes.

Two rules, and the first one is why it is safe. **HTML is network-first** — a
worker that serves cached HTML pins a player to an old build, they reload, get
the same broken page and there is nothing they can do about it. **Hashed assets
are cache-first**, because a new build asks for different filenames.

The install step precaches five files: the document, its entry script and
stylesheet, and both language packs. Not the two hundred crests — they have a
generated fallback and an install that fails as a unit over missing art is
worse than no install. Not nothing, either, which was the first version's
mistake: a service worker does not control the page that registered it, so
caching only what passes through leaves the cache empty exactly when it matters.

`pnpm verify:ui` proves it: it waits for the worker to take control, cuts the
network, reloads and fails if the game does not start. Without that gate this
feature would rot silently — a broken worker looks like a perfect first visit
and an error page on the second.

### The icon

A football sitting where the pitch markings fork: a career is a road, every
season hands you a fork, and the ball is what you are choosing about.

The artwork lives at `apps/web/icon-source/icon-source.jpeg`. Every size
and both variants are built from it by `node tools/icons.mjs` — never hand-edit
the files in `public/icons/`, they are generated.

The tool measures whatever black frame the source arrives with rather than
assuming one, then produces two different crops, because the platforms want
different pictures. See `apps/web/icon-source/README.md`.

Two variants, because they are not the same picture. iOS ignores the manifest,
reads `apple-touch-icon` and never masks — so it gets the rounded-square
artwork drawn to the edge. Android crops to whatever shape the launcher wants
and only the centre 80% is guaranteed, so its `maskable` variant has the mark
scaled into that safe circle over a full-bleed background. Verified against
circle, squircle and no-crop, down to 32px.

The manifest is **English only** — no CJK — and the icons are PNG: an SVG at
eight thousand blades is megabytes, which is the wrong thing to ship as a
favicon and the wrong thing to keep in git.

**The name follows the domain: decisionfc.com → Decision FC.** Changing it
again is four strings: `name` and `short_name` in the manifest,
`apple-mobile-web-app-title` and `<title>` in `index.html`, and `app.title` in
`en.ts`. The Chinese name stays 足球生涯, which already says exactly what the
game is.

## Assets

Real club names, real 2026 players and real media outlets are used, and real
crest and trophy artwork ships in `apps/web/public/crests/` and
`apps/web/public/trophies/`, used with permission — the notice is in each
folder and in `LICENSE`. A club with no file falls back to a generated badge,
so changing the artwork is a content swap, not a refactor.

They are stored as PNG and **served as WebP**: 4.4 MB of artwork becomes 1.5 MB
for the same pixels, which took the published site from 6.7 MB to 3.5 MB and
the itch.io zip from 5.3 MB to 2.0 MB. `node tools/shrink-images.mjs` writes
the twins and both are committed; `apps/web/scripts/build-crests.mjs` checks
every PNG has one and drops the PNGs from the build output; `lib/assets.ts`
rewrites the extension at the one place every artwork URL is built.

The conversion is deliberately **not** part of the build. It was for one
commit, through Chromium, and that made the production build depend on a
browser the Cloudflare deploy does not install — four red deploys with the live
site stuck on a stale version. A hand-run tool may need a browser; a deploy may
not.

## Documentation

| Doc | What it records |
|---|---|
| `docs/README.md` | The front page: what the game is, the maths, how it is checked, how it is built |
| `docs/map.md` | This file: the commands, where everything lives, deployment, the PWA, assets |
| `docs/design.md` | The systems that make it a game, and the balance acceptance numbers they are held to |
| `docs/maintainers-handbook.md` | **Read this before changing anything.** Rules, invariants, recipes, pre-push checklist |
| `docs/monetisation.md` | How the ads actually earn, on all four platforms, and the rules the policy will not break |
| `docs/codebase-review.md` | The repository read cold by a first reader, and what was done about each finding |
| `docs/game-review.md` | The *game* reviewed the same way: rules that disagree with themselves, interaction gaps, open decisions |
| `docs/seo.md` | Why the site was invisible, what the code does about it, the four things only I can do and a straight answer on ranking for FIFA and Football Manager |
| `docs/fairness-review.md` | Every way the game could be unfair, asked as a measurable question: honest odds, independent randomness, unreachable outcomes, a gameable leaderboard and the position that could not compete |
| `docs/itch-io.md` | The itch.io release: what is uploaded, the page copy and the settings that are easy to get wrong |
| `docs/project-review-2026-09.md` | The whole project reviewed cold in September 2026: what is shipped but not working, where the game's ceiling is, a prioritised plan and what became of each item |
| `docs/game-design.md` | The design as first imagined, superseded in part: systems, tuning philosophy, UI rules |
| `docs/tech-plan.md` | The technical plan from July 2026, before the game was built |
| `docs/decision-record.md` | The decisions taken while planning, July 2026 |
| `docs/deploy.md` | Hosting, backend, anti-cheat contract |
| `docs/crests.md` | The crest and trophy artwork: file naming, tools, fallbacks and the WebP twins |

## Roadmap

A WeChat build (mini-program or mini-game runtime, undecided; the engine and
content import unchanged). A second ad slot only once the first has a revenue
number, and never inside a career.
