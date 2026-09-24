# Maintainers Handbook — read this before changing anything

The rules, the invariants and the recipes for changing Decision FC without
breaking it. Most of the rules below exist because a change once broke the
game in exactly that place.

## 0. Rules for every change

1. Before every push, ALL of these must pass. `sh bin/gates.sh` runs every one
   of them in CI's order and stops at the first failure:
   ```bash
   pnpm typecheck   # engine + content + web, sources and tests, must be clean
   pnpm lint        # ESLint; also enforces engine purity statically
   pnpm test        # must be green — sources and tests are both typechecked,
                    # and the suite includes the documented rules
   pnpm build       # must complete
   pnpm verify:no-leak # the published build ships no sourcemap, no source, no
                       # secret
   pnpm verify:artwork # every committed PNG has a current WebP twin. The site
                       # serves WebP; a missing or stale twin is a real badge
                       # that silently becomes a generated one
   pnpm verify:itch    # the itch.io zip still carries this engine. It is
                       # uploaded by hand, so nothing else notices when an
                       # engine change leaves it behind — and the way that
                       # surfaces is a stranger reporting a fixed bug
   node tools/build-edge.mjs && npx tsx tools/verify-bundle.ts
                       # the leaderboard's engine bundle reproduces this engine

   pnpm verify:ui && pnpm verify:desktop && pnpm seo   # against `pnpm preview`
   pnpm balance -- --runs=1500 --assert                 # the balance smoke

   pnpm fairness --assert  # every option does what it said · every card is a
                           # decision · printed odds are real · fair start
   pnpm market             # 500 played careers, 15 offer-realism rules; must
                           # print "Every rule holds" (non-zero exit otherwise)
   pnpm skill --assert     # is it still a game of decisions, not a slot machine
   pnpm deck               # would anybody ever pick the other option?
   pnpm plausibility --assert  # is every career a story a fan would believe?
   ```
   If any fails, fix it or do not push. CI runs exactly these on every pull
   request and every push to `main` (`.github/workflows/ci.yml`), as four jobs
   side by side, so a red run here is a red run there.

   The order is CI's. Every package typechecks against the engine's sources
   (its `types` points at `src/`), so `typecheck` needs no build before it.

   And **one command runs after the push, not before it**:
   ```bash
   pnpm verify:live    # is decisionfc.com serving what this tree builds?
   ```
   It compares the live entry bundle and stylesheet — Vite names both by content
   hash — against `apps/web/dist`, so it needs a `pnpm build` first and it
   answers the one question the pre-push gate cannot: did the deploy actually
   reach anybody. On 2026-09-18 four Cloudflare deploys failed in a row while
   every gate above stayed green and the live site sat three commits behind;
   the deploy workflow now runs this itself, and
   `.github/workflows/live.yml` repeats it daily for the case where the deploy
   never ran at all. A commit that changes nothing the app ships builds the same
   filenames and passes, which is correct.

   **Two bad answers, two exit codes, and the difference matters.** Exit 1 is
   the site serving a different build — the real fault, and a red build. Exit 2
   is the site refusing to answer the checker: Cloudflare replied `403` to the
   GitHub runner for three minutes on the first run, from a datacentre address,
   while the site itself was up and perfectly current. So CI asks the worker's own `workers.dev` address first, strictly —
   same deployment, outside decisionfc.com's bot protection — and then
   decisionfc.com as a warning on 2 and a failure on 1. A checker that cannot
   see the site knows nothing about it, and a false red X is what teaches
   somebody to ignore a true one.

   And **after a push that moves a score**, the simulated half of the
   leaderboard has to be played again by the new engine:
   ```bash
   pnpm seed:boards -- --plan --backfill   # what it would write; writes nothing
   ```
   The writing is CI's — `seed-boards.yml`, which refuses unless the server
   runs this commit's engine. Empty the seeded rows, then dispatch it with
   `backfill` ticked; the seeded-rows invariant in §1 says why and in what
   order.

   **The logic sweeps used to be conditional — "run them if you touched the
   engine".** They were run by hand, which is a habit rather than a process, and
   a player then found three shipped bugs in a week that every one of them would
   have caught. They are the checks that verify the game's *logic* rather than
   its numbers, they cost about two and a half minutes between them, and they
   are now a gate. Never cut their run counts to save CI time: they exist to
   find rare faults, and a rare fault needs the careers to show up in.
2. If you touched engine code or content **world data** (leagues, clubs,
   balance — *not* i18n strings), also run balance. Run the smoke locally, not
   the full sweep:
   ```bash
   pnpm balance -- --runs=1500 --assert   # the exact command CI gates on, ~30s
   ```
   That 1,500-career smoke is the gate — run it, and you have run what CI runs.
   Run the full `pnpm balance` (20,000 careers, the slow one) only to read a
   precise number for the acceptance table in `docs/design.md`, or when a band
   comes out near its edge: the smoke carries real sampling variance, and a
   benign option reorder alone once moved peak-≥90 half a point and reddened CI
   where the 20k sweep read green. If a number in that table moved, say **in the
   commit message** why it moved.

   **Scope by what the change can break** (since 2026-07-31). Match the
   checks to what the change can break: running everything for a one-line copy
   fix is the slow habit this replaced.

   | Change | What to run |
   |---|---|
   | Copy or i18n strings only | `pnpm typecheck` and `pnpm test` (the content suite catches a missing or dangling key), plus `pnpm verify:ui` when a string could overflow. The sims and the balance sweep do not read copy |
   | Engine code, or content world data (leagues, clubs, balance) | `pnpm typecheck`, `pnpm test`, the **whole** logic battery (`fairness --assert`, `market`, `skill --assert`, `deck`, `plausibility --assert`) and `pnpm balance -- --runs=1500 --assert`. Do not cherry-pick within the battery: an offer change can break `fairness`, not just `market` |
   | UI (web app CSS or layout) | `pnpm verify:ui` and `pnpm verify:desktop`, **both** languages, phone *and* desktop, with zero document overflow. A change that fixes one size and breaks the other is the normal failure. Styling cannot move a number, so no sims |
   | Anything broad or risky, or the end of a branch | `sh bin/gates.sh`, and the 20,000-career `pnpm balance` |

   `pnpm fairness` is the one that catches "this scores one kind of player and
   not another". It found the worst unfairness the game had — a striker scoring
   twice a centre-back's achievements total on identical seeds — and it fails
   the build if that reopens. After any change to the season simulation,
   regenerate the position table with `pnpm par` and paste it into
   `OUTPUT_PAR` in `packages/engine/src/career/summary.ts`, then re-run the
   assert. The whole audit is `docs/fairness-review.md`.

   `pnpm market` is the one that catches "this offer makes no sense": wages,
   signing bonuses, contract lengths, promised roles, and whether the clubs in
   one window belong to the same football world. Note it is **`market`, not
   `audit`** — `pnpm audit` is pnpm's own security command and would shadow a
   script of that name.

3. Update the docs in the **same commit** as the change: `docs/design.md` (the
   systems and the acceptance table), `docs/map.md` (the commands block and the
   file map), `docs/README.md` when a number or a claim on it moves, and this
   handbook's invariants and checklist. They are part of the deliverable. A doc
   describing a version of the game that no longer exists is worse than no doc
   — it is confidently wrong, and the next reader will trust it.

4. **Push to `main` directly.** Ordinary work is committed on `main` and
   pushed, with no branch and no pull request. A pull request is for a change
   large enough to play on a preview before it is live.

   This raises the stakes on rule 1 rather than lowering them. With a PR there
   were two chances to catch a bad change — the local gate and CI on the PR, both
   before anything shipped. Pushing to `main` deploys: CI and the Cloudflare
   deploy run off the same push, so the local gate is the only check that happens
   *before* production. Run it in full, and watch the deploy go green afterwards
   (§3.9) rather than assuming it did.

5. **Update the open PR's body on every push to it**, in the same step as the
   push — see §3.7. Only applies when a PR exists; a PR whose description stopped
   being true three commits ago is a review nobody can do.

## 1. Invariants that silently break the game if violated

- **Engine purity.** `packages/engine` must never touch `Math.random`,
  `Date`, `performance`, the DOM, the network, or the filesystem. All
  randomness goes through `rngFor(seed, channel)`. Two things enforce this and
  neither may be weakened: `eslint.config.mjs` bans the names outright in that
  package, and the purity test plays 36 careers across seeds, paces, positions
  and three choice policies with all of them replaced by throwing stubs. The
  test used to play *one* career always taking option 1, which is why the
  sweep matters — most branches are not on that path.
- **Replay stability.** A career must reproduce exactly from
  `seed + identity + decision-option-id list` — the server-side leaderboard
  anti-cheat replays submissions through the same engine. Therefore:
  - Never insert, remove, or reorder RNG calls inside an **existing** rng
    channel's call path. If new randomness is needed, derive a **new**
    channel string (e.g. `` rngFor(seed, `my-new-thing:${step}`) ``).
  - Never rename decision option ids or event ids that can appear in a
    stored decision list.
  - After ANY engine or content change, the deployed edge function's bundle
    is stale until it is redeployed. That is automatic on every push to `main`
    (§3.3); what you must check is that the workflow actually ran and went
    green, because a skipped job leaves the bundle stale and new clients get
    rejected.
- **Club ids are a contract.** `packages/content/src/data/clubs.ts` ids are
  used in save files, crest filenames and leaderboard rows. Never rename an
  id. Display names can change freely; ids cannot.
- **Engine params carry ids, not names.** Any `params.club` /
  `params.loanClub` the engine emits must be a club **id**; the web layer
  localizes it via `localizeParams()` in `apps/web/src/lib/game.ts`. Never
  put an English club display name into engine-emitted params.
- **i18n schema.** `packages/content/src/i18n/en.ts` is the schema; `zh.ts`
  is typed against it. Every key added to one must be added to the other, or
  the build fails. Never leave a `{placeholder}` in copy without the engine
  actually providing that param. The result sentence of an event card gets its
  slots from the card that produced it (`resultParams` in `machine.ts`); a
  result with a `{slot}` the card never carried prints the slot, which it did
  for the club-versus-country card in both languages.
- **Nothing happens off the card, and no copy exists for a screen that does
  not.** Both halves have a test.
  - Every field on `Effect` that a player would notice must appear in
    `describeEffect`. Cash, the wage, development speed, injury risk and named
    attributes were all applied and none of them printed, so cards read as
    free lunches or as pure risk. If you add a field, add its line.
  - `pnpm test` fails on any i18n leaf no screen can ask for. Forty-two of them
    had accumulated. Delete copy when you delete the screen it was written for.
- **Money on a card is written in weeks of wage** (`cashWeeks`), not euros. A
  flat figure is a fortune at seventeen and invisible at thirty. Resolution
  happens in `resolveEffect`, alongside the pace weighting, so the number shown
  is the number paid. Money a card **pays** also lands on the wealth board;
  money it **costs** does not, because an expense is not an earning.
- **A season the engine changes must be legible in the career table.** A ban
  freezes the role at fringe, stops development and rules out the national
  squad — and the row said nothing, so a season of six appearances at
  twenty-six had no explanation on screen.
- **A banned season is a banned season: zero appearances, zero stats, no
  trophy or award credited to the player, zero pay.** All four used to leak —
  the season simulated 3–12 fringe appearances, the trophy roll still handed
  the banned man a medal, and the wage was paid in full. The club's own
  outcome (relegation, promotion) still happens around him. The consequence
  line on the card says "a season lost, unpaid"; if you change what a ban
  costs, change that line in the same commit. `tools/market.ts` exempts
  suspended seasons from the minutes-match-role rule for the same reason.
- **Goalkeepers do not score for their country.** `sim/national.ts` gives GK a
  zero goal rate and a once-a-career assist rate; the "else" bucket that once
  lumped keepers in with defenders put an international goal on nearly every
  capped keeper in a 3,200-career sweep.
- **The Thursday-Europe card is Europa-only.** `europa_thursday` gates on
  `continentalEntry === 'secondary'` — the elite competition plays midweek
  with a squad built for it, and the card's whole premise is Thursday.
- **A club is priced into the division it plays in, not the one the data
  assigns it.** `leagueOdds` computes a moved club's title share against its
  CURRENT division's field (`TrophyField.leagueTotals`); relegation and
  promotion rates come from `clubStanding` in that division, not absolute
  reputation. The fault this encodes: promoted Southampton won the Premier
  League the next season at their Championship odds, and a rep-70+ promoted
  club could never be relegated.
- **The standing damps the title roll.** A survival-band club never wins the
  league that season; a mid-table champion is Leicester-rare (×0.15 on the
  share). `tools/plausibility.ts` asserts both, plus a ≤2% ceiling on
  mid-table champions.
- **No relegation where the world has no lower division.** Single-tier
  countries (POR/NED/BEL and every spin-off league) never produce a
  "relegated" season — a ▼ that then stays in the same league is a story
  fault (`hasLowerDivision` in the trophy context).
- **The story suite is part of the battery.** `pnpm plausibility --assert`
  plays 1,500 careers and audits them season by season as football stories —
  believable champions, divisions that move in fact, banned seasons that stay
  void, Europe won only from inside Europe. Any engine or world-data change
  runs it alongside fairness/market/skill/deck, and CI's `rules` job runs it
  on every pull request. It was documented as mandatory here for a week
  before anybody noticed it was missing from `ci.yml` — a gate nothing
  executes is a paragraph, so when a suite joins this list it joins the
  workflow in the same commit.
- **No years, no player names in events.** The UI never shows a calendar
  year — time is ages (career) and months (inside a season, `params.month`).
  Career events never name generated players.
- **Events fire once per career** (`eligibleEvents` filters `seenEvents`).
  Do not re-introduce repeats.
- **One screen.** The web UI never scrolls the document at 375×667. Any
  change to screens must re-run the Playwright check (§3.5) in BOTH
  languages and keep `maxOverflowX/Y` at 0. Top is identity, the middle is
  what happened, the bottom is the decision under the thumb; anything that does
  not fit goes in a bottom sheet. On a wide window the game sits in a 420×780
  frame (`.app-frame`, whose `transform` keeps every `fixed` overlay inside the
  game rather than over the whole browser), and **from 1040px the career screen
  — and only that screen — becomes two columns** (decision left, career record
  right) in a frame widened to 760. `pnpm verify:ui` and `pnpm verify:desktop`
  both have to pass (§3.5, §3.6).
- **League scope.** Core market: England, Spain, Italy,
  Germany and France tiers 1–2, and Portugal, the Netherlands and Belgium tier 1.
  Spin-off market (money or twilight moves only, gated in `model/market.ts`):
  Saudi Arabia, the USA, Japan and China tier 1. Loans stay inside the European
  pyramid, downward only. Every transfer window must read as a coherent set of
  clubs — a tested invariant (see "A window reads as one football world").
- **Money is euros.** Currency setting is display-only. Never let a display
  preference change a computed number.
- **A competition awards one trophy a season.** Trophy odds are a club's
  *share of its own field*, normalised in `trophyField()`. Never write an
  absolute odds table: the first one handed England 4.7 league titles a season
  and Belgium almost none. `engine.test.ts` → "silverware arithmetic" asserts
  the sums; if it fails, the world stopped making sense.
- **Continental football follows standing, not reputation.** `continentalEntry`
  reads `clubStanding`: only a *title race* club enters the elite competition
  and only a *European places* club the secondary one, so a *mid-table* or
  *survival* side — whatever its badge — is never in Europe and never wins it
  (a mid-table West Ham was entering and winning the Champions League). The
  same gate turns off the European-night event cards (`inContinental` in
  `events.ts`) for clubs with no continental football. Asserted in
  `engine.test.ts` → "only lets clubs in the title or European places play
  continental football". A club's `continentalEntry` therefore needs `world`.
- **No season is a cliff.** After the peak the age tables go negative;
  `developPlayer` may only *soften* that loss with a coaching multiplier above
  1, never deepen it with one below (the old `raw / multiplier` doubled the
  drop at the 0.5 floor). The per-season curve loss is capped at
  `MAX_SEASON_DECLINE`, and the curve plus a lasting injury together at
  `MAX_TOTAL_SEASON_DROP` in `playSeason`. Both are pure clamps on
  already-drawn values — they add no RNG and are replay-safe.
- **An end-of-season window that keeps him is three choices.** When a stay or
  renewal is on the card, `buildTransferDecision` fills it to `CARD_SLOTS`
  (`suitorFloor = offerCount`) so a manager-change window is *renew + two
  offers*, never the two-button "renew or one club" card. A forced move (the
  club letting him go) is still two real moves. `engine.test.ts` →
  "tells a player his manager has gone" asserts the split.
- **The pace picker is not a difficulty picker.** The deck is authored for one
  card a season; `scaleEffectToPace` weighs a card's *lasting* consequences —
  ability, cash, the wage the contract carries — against the rate that pace
  serves cards at, using `PACE_EFFECT_SCALE`. Season-bound consequences are
  never scaled: `modifiers` reset every season, so they cannot compound.
  **The scales are not the reciprocals of `PACE_DECISIONS`** — every event
  fires at most once, so a career sees ~6.6 / 18.7 / 26.8 event cards, not
  0.34 / 1 / 3 per season. Assuming otherwise made immersive the *hardest*
  pace. Re-measure with `npx tsx tools/pace.ts --runs=2500` after any deck
  change; `engine.test.ts` → "every pace is the same difficulty" is the guard.
- **Last season decides which way the ladder points; ability caps how far down
  it can reach.** A player who starred is offered *bigger* clubs; one who sat on
  the bench is offered smaller ones. `formScore()` grades the season,
  `standingFactor()` weights each suitor against the club he is at now, and
  `suitorFloor()` drops the clubs well below him out of a good season's window.
  Form is the *direction*, not the whole rule: never make offers a function of
  ability alone — that is what showed a cup-winning starter two clubs worse than
  his own — but do not let form run the market on its own either. A benched star
  is still a star, and `withinOfferReach()` is the floor form was missing: a
  core-market club more than a comfortable Star Player below his ability never
  bids, whatever last season looked like (I saw an 86 frozen out at
  Barcelona being offered Serie B). The loan club's buy option and a boyhood-club
  homecoming are exempt — their tie to the player is what a bar cannot see.
  `engine.test.ts` → "market standing" and "never lets a club far below his
  ability make a cold offer" assert it, and `pnpm market`'s offer-ability-ceiling
  rule audits it across played careers.
- **`strength` is what a league is worth; `wageIndex` is what it pays.** They
  are separate numbers on `League` and must stay separate. `wageIndex` touches
  the wage and nothing else — fees, market value, awards and legacy all run on
  `strength`, because those are about the football. England is why it exists: an
  ordinary Premier League club outpays a Serie A giant, and the Championship
  pays like a European top flight. Never fold one into the other to "simplify".
- **A window reads as one football world.** Every core league in one set of
  offers stays within `WINDOW_SPREAD` (0.22) of the first suitor's league
  strength — the transfer screen and the event cards that carry a move both
  enforce it. The market band alone is not enough: it is centred on the
  *player*, so a mid player in the middle of it drew Ligue 1 and Serie B at
  once, each within reach of him and absurd next to each other. Academies and
  loans are exempt on purpose — a Premier League academy against a Championship
  one, and better football against a place in the side, are the decisions those
  cards exist to pose. `engine.test.ts` → "a window reads as one football world".
- **Loans: the role band is the trap.** Up to three spells, ages 17–24, and
  the window *becomes* a loan window whenever the coming season projects a young
  player short of a place. Reading that band one rung too strict dropped loans
  to under a tenth of careers and read as "the loan system is gone". Three
  destinations where he would start, 90% his own country, and **no "stay"**: the
  club has already decided.
- **A loan is one season, and the clock is not the card cadence.** It used to be
  written for one *or two* at the moment it was agreed, and a third of all spells
  came out two — a year of a career decided without a card, which on the quicker
  paces read as the game having forgotten the player. There is no "stay another
  year" button, deliberately: a second season at one club comes back through
  the ordinary rungs, on merit. When a loan ends the card's body keys on what the
  parent club decided (`body_wanted` / `body_unwanted` / `body_selling`): it wants
  him back; it does not, and sends him out on another loan rather than a seat on
  its bench; or it does not and cannot loan him (his final year, or the rungs are
  spent), so it moves to sell him and the last option is going back to run the
  deal down. The guard is `engine.test.ts` → "replaces a fringe return with
  another loan, or sells him". The return card is dealt the season the loan
  ends **at every pace**:
  the preference for alternating an event round with a transfer round is a
  preference, and it never delays a loan decision. `engine.test.ts` → "runs
  every loan for one season" is the guard.
- **A card with two possible destinations must not name a club in its body.**
  There is no single suitor to fill `{club}`, so it falls back to the club the
  player is already at ("Leeds will treble your wages" — while at Leeds). A
  content test enforces this.
- **Every card is a decision: two options at least, `CARD_SLOTS` at most.** A
  card with one button is a tap, and the game has now shipped three of them —
  the season-focus card, a transfer window whose only answer was *stay*, and a
  loan card with one destination. The two market ones came from rules that
  *remove* options: the filter that drops an offer losing to the renewal on
  every axis, and the loan rung that looks only at the boy's own country. So a
  rule that can remove an option must be paired with something that refills the
  slot — the window draws two spare suitors and keeps the best reject if the
  filter empties the card; the home loan rung falls to the next rung; a loan
  window that still cannot find two clubs is not dealt at all. `pnpm fairness`
  sweeps every card of hundreds of careers and fails on any that is not a
  decision.
- **A club cannot end a contract early; it can only decline to renew.** The
  non-renewal rule (`endOfCycle`) belongs at *expiry*. Mid-contract, staying is
  always answerable — the deal he signed runs on — and only an event that
  forces the move (`modifiers.forcedTransfer`) takes that away. This has been
  got wrong twice in different ways, and both times the symptom was a window
  reading "leave, or leave" for a player with years left to run.
- **A rule written in prose is not enforced.** Two bug families account for
  every serious fault found in this engine: a card promising what the resolver
  does not do, and a rule stated in a comment or a doc but enforced on only some
  paths. Both are answered by executable properties rather than by more cases —
  `pnpm fairness`, and `engine.test.ts` → *the rules this project states in
  prose*, where each test quotes the claim and the file that makes it. If you
  change a rule, change its assertion in the same commit; if you add one, add
  the assertion with it.
- **`decide` switches exhaustively over `DecisionKind`.** The `default` branch
  is typed `never` and throws. Do not add a member to the union without a
  resolver, and do not "fix" a compile error there by widening the default — a
  kind nothing resolves is a card that can be chosen and do nothing.
- **The tests are typechecked too.** `pnpm typecheck` runs
  `tsconfig.check.json` in the engine and content packages, which is the build
  config plus `*.test.ts`. It is not an optional nicety: without it a test
  called `mulberry32('a-string')`, seeded NaN, and reported four hundred copies
  of one season as a distribution. Never point `typecheck` back at a config that
  excludes the tests.
- **The published build ships no source and no sourcemap.** The deploy puts
  `apps/web/dist` on the public web verbatim, so anything the build writes there
  is downloadable. A minified bundle is fine — a browser must receive its
  running code, and the leaderboard's authority is server-side anyway — but a
  `.map` file rebuilds the whole TypeScript from that bundle, and a stray
  `.ts`/`.env`/`.git` is the source itself. `sourcemap: false` and `minify` are
  pinned in `apps/web/vite.config.ts`; **never turn sourcemaps on for a
  production build**, not even to debug one. `tools/verify-no-source-leak.mjs`
  (run by CI and by the Cloudflare deploy, and by hand as `pnpm verify:no-leak`)
  fails the build if a map, a source file or a secret reaches `dist`, or if the
  bundle is not minified. This is the "others must not be able to download the
  project" rule, made executable.
- **Playable positions are `PLAYABLE_POSITIONS` (ten): LM and RM are retired.**
  I removed the two wide-midfield positions from the game (2026-08-02).
  The `Position` type still carries them so old saves replay, but nothing may
  *generate* them: the identity screen, every tool sweep and every synthetic
  player draws from `PLAYABLE_POSITIONS`, and `adjacentPositions` never
  returns them as a switch target.
- **The world is the 2026/27 season, kept whole.** Rosters, divisions,
  promotions/relegations, reputations, manager styles and marquee squads all
  describe the real 2026/27 opening position (verified against season
  articles, August 2026). The big-five top flights are complete (20/20/20/18/18
  clubs); second tiers stay deliberately partial. When a new real season's
  data lands, move it as one commit: `clubs.ts`, `clubs-zh.ts`, crests,
  `squads.ts`, and the reputations that drive in-game standings together —
  a half-updated world puts a club in two divisions at once.
- **A spin-off offer promises at least an Important Player, and the arrival
  season delivers it.** The floor lives in `promisableRole` (so the market
  audit and the offer builder cannot disagree) and is enforced absolutely in
  `playSeason` for the season he arrives — over the ability cap and over
  event-card role shifts, the same way a loan guarantee outruns ability. From
  the second season, ability decides again. The Gulf event card offers Saudi
  clubs only (`countryId === 'ksa'`).
- **Nobody under 35 is retired by an empty window.** Below `MIN_RETIREMENT_AGE`
  an empty transfer card always retries as a last resort, and the last resort's
  register-him-somewhere fallback guarantees a destination while any club in
  the world would take him. At 35+ the empty window may stand — that is the one
  honest path to `retirement.no_offers` and the `frozen_out` ending.
- **No cliff between career rows.** From one season's close to the next a
  career loses at most `MAX_TOTAL_SEASON_DROP + 1` rating — the ageing curve,
  a lasting injury and event-card costs all inside one budget — **except** a
  position switch, which reprices honestly and prints the new position on the
  row. `pnpm plausibility` asserts both halves.
- **The mercy rule is real, hidden, and stays hidden.** After three gamble
  options resolving red in a row, the fourth gamble resolves to its positive
  branch (`redStreak` on `CareerState`). Decided 2026-08-02: never
  explain it in the UI or the copy, in either language. The printed odds stay
  the odds of an ordinary roll; `pnpm fairness` excludes forced rolls from the
  odds tally, checks the odds pooled over every gamble as well as card by card
  (counted in, the forced rolls fail the pooled check), and fails if any career
  ever reaches four consecutive reds.
- **Cards advertise consequences in visible currency only.** The attribute
  strip left the header, so no option may promise "+2 shooting" — attribute
  effects are written as `overall` in content, and `describeEffect` collapses
  any future `attributes` effect into an OVR-shaped line. The green bars on an
  offer row are **club strength** (`club.reputation`), not league strength.
- **Simulated leaderboard rows are always marked, always current, and never
  counted early** (since 2026-09-23). `tools/seed-boards.ts` writes
  them with `seeded = true`; nothing else may set that column and nothing may
  write a seeded row by another route. They must be played by the engine the
  server runs — `seed-boards.yml` compares the bundle it builds with the pinned
  one and seeds nothing on a mismatch — so **after an engine change that moves
  a score, delete the seeded rows and re-run the workflow with `backfill`**, or
  real players are ranked against the old rules again, which is the exact
  fault the seeding replaced. And `bg_ranks` counts only `created_at <= now()`:
  that clause is what makes the daily board climb from midnight. Removing it
  puts every future-dated row on the board at once.
- **The database accepts every career the engine can produce.** Renaming an
  engine value that is stored — a pace, a position, an ending — needs a file in
  `packages/backend/sql/` that changes the column's check in the same commit.
  The pace was renamed `blitz` → `quick` without one, and every Quick career
  was silently refused by the board until `sql/004`; the player saw the local
  estimate, which is why nobody noticed. `schema.test.ts` holds the pace check
  and the edge function's validation to the engine's list.
- **No card judges tactical fit, and every transfer window can reward the
  judgement** (since 2026-09-23). The manager's style is printed; whether
  it suits the player is never labelled, hinted or coloured. In exchange
  `buildTransferDecision` guarantees a club from `suitableStyles` on every card
  (staying counts), swapping one offer for the suitable club nearest it in
  reputation and league strength — never one that breaks the window's
  coherence spans; at the very top, where no club at his level plays a suitable
  system, the next best system counts instead. Club levels must not move:
  `docs/design.md` gives the before/after numbers, and a change here re-measures
  them.
  `engine.test.ts` holds coverage at 99%+.
- **The intro holds still across paces, and a first visit is English in
  pounds** (since 2026-09-23). The three pace descriptions share one
  grid cell; `verify-ui` measures the hero, the title size, the pace buttons
  and everything below under each pace. The defaults live in `settings.tsx`
  (`GBP`) and `detectLocale` (`'en'` after `/zh` and a stored choice).
- **No block of text ends on a lone character or word** (since
  2026-09-23). `text-wrap: pretty` on `body`, `balance` on titles; a new short,
  narrow, centred paragraph may need `text-balance` of its own, because
  Chrome's `pretty` gives up on those. `verify-ui.mjs` fails on any stranded
  character on any screen it visits — do not weaken the check to get green;
  fix the wrap.
- **Nothing may sit under an iPhone's status bar, and the status-bar style
  stays `black`.** `black-translucent` + `viewport-fit=cover` is broken on iOS
  26 (WebKit bug 301108): the window comes out one status bar short. Every
  screen reserves `var(--safe-top)` at its top whichever slot comes first, and
  a hero that is centred must centre with auto margins, never
  `justify-center` in a clipped box — that spills upwards. The phone-shape
  matrix in `verify-ui.mjs` is the check.

## 2. Where everything lives

| Path | What it is |
|---|---|
| `packages/engine/src/career/machine.ts` | The state machine: decisions in, seasons out |
| `packages/engine/src/career/events.ts` | Career event definitions (gates, odds, effects) |
| `packages/engine/src/career/decisions.ts` | Academy/transfer/renewal card builders |
| `packages/engine/src/career/loans.ts` | Loan offer/return logic |
| `packages/engine/src/model/market.ts` | Who can plausibly bid: bands, geography, form |
| `packages/engine/src/sim/trophies.ts` | Title/cup odds ladders + key-moment force/skip |
| `packages/engine/src/model/{growth,finance,role,injury}.ts` | Development, money, roles, injuries |
| `packages/content/src/data/*.ts` | World data: clubs, countries, leagues, squads, names |
| `packages/content/src/i18n/{en,zh}.ts` + `clubs-zh.ts` | All copy |
| `apps/web/src/screens/Career.tsx` | Main loop + gamble-roulette orchestration |
| `apps/web/src/components/CareerList.tsx` | The by-age career table |
| `apps/web/src/components/DecisionPanel.tsx` | Decision cards + reveal states |
| `apps/web/src/screens/Summary.tsx` | Retirement screen + the share sheet |
| `apps/web/src/lib/shareCard.ts` | The 1080×1920 share image, drawn on a canvas |
| `apps/web/src/components/rating.tsx` | Rating colour bands + the stat icons |
| `apps/web/src/components/Trophy.tsx` | Trophy artwork resolution and fallbacks |
| `apps/web/src/components/Jersey.tsx` + `lib/kits.ts` | The identity shirt and its national colours |
| `packages/backend/edge/handler.ts` | Everything `career-submit` does; both entries share it |
| `packages/backend/edge/index.deployed.ts` | The entry that actually runs (hash-pinned bundle) |
| `packages/backend/edge/index.ts` | Local entry, for `supabase functions serve` |
| `packages/engine/src/career/world-index.ts` | "What league is this club in *now*" — read this before reaching for `club.leagueId` |
| `packages/engine/src/career/loan-flow.ts` | Loans: the ladder, the return card, and applying either |
| `packages/engine/src/career/ending.ts` | Retirement roll and the transition to the summary |
| `tools/balance.ts` | 20k-career sweep; acceptance numbers in `docs/design.md` |
| `tools/pace.ts` | Paired-seed probe: is a pace a length or a difficulty setting? |
| `tools/edge-smoke.ts` | Submits a real career to the live function and checks the replay |
| `tools/verify-bundle.ts` | Replays four careers through a built bundle before it is deployed |
| `tools/skill.ts` | Same seeds, five ways of playing — separates luck from choice |
| `tools/seo.mjs` | Is the site findable? Run against a built preview — see docs/seo.md |
| `tools/itch-assets.mjs` | The itch.io cover + iPhone screenshots, and the proof the zip runs from a nested path — see docs/itch-io.md |
| `apps/web/scripts/build-itch.mjs` | Strips the site's head off the itch build and zips it |
| `tools/indexnow.mjs` | Tells Bing/Yandex/Seznam/Naver the pages changed; the deploy runs it |
| `apps/web/src/lib/site-claims.test.ts` | Holds the site's boasts to the data — a number in prose in eight files |
| `apps/web/scripts/prerender.mjs` | Writes the Chinese twin of index.html to /zh at build time |
| `apps/web/public/{robots.txt,sitemap.xml,llms.txt}` | Real files, because the SPA fallback would otherwise answer these with HTML |
| `tools/verify-ui.mjs` | Plays a full career at 375×667 in both languages (§3.5) |
| `tools/build-edge.mjs` / `tools/crests*.mjs` | Edge bundle / crest asset tooling |
| `eslint.config.mjs` | Lint rules, including the static engine-purity ban |
| `bin/setup.sh` | A fresh clone: installs the workspace (§3.0) |
| `bin/gates.sh` | Every check CI runs, in CI's order, stopping at the first failure (§0.1) |

## 3. Recipes — follow exactly

### 3.0 Set up a clone
```bash
sh bin/setup.sh                          # installs the workspace; safe to re-run
pnpm exec playwright install chromium    # once per machine, for the browser checks
sh bin/gates.sh                          # every check CI runs, in CI's order
```
A new clone, or a rebuilt machine, starts without `node_modules`: run
`bin/setup.sh` again whenever the machine is new. The browser tools use `/opt/pw-browsers/chromium` when it exists, or the
path in `CHROMIUM`, and let Playwright resolve its own otherwise.

### 3.1 Add a career event
1. Add a def to `EVENTS` in `packages/engine/src/career/events.ts`
   (copy an existing one; unique `id`; `when` gate; odds on gamble options).
2. Add copy in `en.ts` AND `zh.ts` under `events.<id>` with `title`, `body`,
   `options.<optionId>`, `results.<resultKey>` — every `resultKey` used by
   the def must exist in `results`.
3. Play it: `pnpm balance -- --runs=1500 --assert` fails if any career stops
   short of its summary, and `eligibleEvents` filtering `seenEvents` is what
   keeps a card from coming round twice (§1).
4. The gate in §0.1 — the deck is engine logic, so `pnpm fairness --assert` is
   the one that matters here: it is what catches a new card promising something
   the resolver does not do, or an option nobody can lose. Then a quick sweep
   `pnpm balance --runs=3000` to confirm nothing exploded.

### 3.2 Add or edit clubs
1. Edit `packages/content/src/data/clubs.ts` (id, league, names, numbers,
   colors). New id ⇒ also add Chinese names in `i18n/clubs-zh.ts`.
2. Fetch the crest: `node tools/crests-fetch-tsdb.mjs <club-id>` and LOOK at
   the downloaded PNG (`apps/web/public/crests/<id>.png`) to confirm it is
   the right club — the API often returns namesakes; the picker refuses
   cross-country matches but verify anyway.
3. `pnpm test` (content integrity tests check colors, leagues, marquee).

### 3.3 Redeploy the leaderboard edge function — **automatic, do not do by hand**
Every push to `main` that touches `packages/engine`, `packages/content` or
`packages/backend/edge` rebuilds the bundle, uploads it, repoints the function
and smoke-tests a real career against it
(`.github/workflows/deploy-edge.yml`). You do not need to remember this after
a merge, and you must not race it by hand.

It needs two secrets, once: `SUPABASE_ACCESS_TOKEN`
(supabase.com/dashboard/account/tokens) and `SUPABASE_SERVICE_ROLE_KEY`
(project → Settings → API). **Without them the job fails, on purpose.**

In this repository they live inside an environment that is itself named
`SUPABASE_ACCESS_TOKEN`, and the workflow names it. An environment's secrets are
invisible to a job that does not name that environment, and the symptom is
identical to never adding them — which is how a merge once went green having
deployed nothing. To move them somewhere saner, set the repository **variable**
`EDGE_ENVIRONMENT` to the new environment's name, or to the empty string if they
are promoted to repository-level secrets; the variable overrides the default. To find out which way round it is without deploying
anything, run the workflow from the Actions tab with **dry run** ticked: it
prints where it looked and whether both secrets were readable, then stops. The first version exited green when they were unset, so the
first merge after it landed went green while doing nothing and the live
leaderboard rejected every submission until it was fixed by hand. A red X on
main is the correct outcome for "the backend is now stale".

**Nothing is promoted before it is proven.** The deploy job builds the bundle,
minifies it, and then runs `tools/verify-bundle.ts` on that exact artifact —
four careers, played by this commit's engine and replayed through the candidate,
every leaderboard number required to match. Only then is anything uploaded or
repointed. The old order was deploy-then-check, which meant the first thing that
noticed a bad bundle was a player whose finished career had just been rejected.

A second job, `verify`, runs `tools/edge-smoke.ts` against the live function
whatever the deploy did — it plays a real career, submits it, and fails if the
server's replay cannot reproduce it. It needs no secrets, so it is the check
that catches a broken deploy however it broke. On green it writes
`current.json` to the bucket, recording the pin that answered correctly; on red
it **rolls the function back** to whatever `current.json` last named. A broken
leaderboard is not something to leave live while a build is red.

`packages/backend/edge/engine-bundle.mjs` is **generated and untracked** — run
`node tools/build-edge.mjs` before serving the function locally. It was tracked
once and had drifted from its own source within days, so what a reader opened
was engine logic that no longer matched the engine.

The bundle object is named after its **own SHA-256**, not the commit, so the
job is idempotent and a rollback finds its bundle already in the bucket. The
pin reaches the function as the `BUNDLE_URL` / `BUNDLE_SHA256` secrets; the
literals in `index.deployed.ts` are only the hand-deploy fallback.

Check it worked: the Actions run is green, and its summary shows the bundle
name and hash. To force one without a code change, run the workflow from the
Actions tab.

If you ever must do it by hand (the workflow is broken, or there is no CI):
```bash
node tools/build-edge.mjs
npx esbuild packages/backend/edge/engine-bundle.mjs --minify --format=esm \
  --outfile=/tmp/engine-bundle.min.mjs
sha256sum /tmp/engine-bundle.min.mjs           # HASH; object name is engine-bundle-<first 12>.mjs
```
Upload to the public `edge-code` bucket in project `dyuilyooirtpfyqplfve` with
the service-role key (`x-upsert: true`), set `BUNDLE_URL` + `BUNDLE_SHA256` as
function secrets, deploy `career-submit` from
`packages/backend/edge/index.deployed.ts`, then run `npx tsx
tools/edge-smoke.ts` and require a tick on every line — one per check, and one
per pace.

With only the anon key (no service role) it can still be done: add a temporary
`insert` policy on `storage.objects` for the `edge-code` bucket, upload
**without** `x-upsert` — upsert is refused by RLS even with an insert policy,
because it also checks update rights on a row that does not exist yet — then
drop the policy again, and bake the URL and hash into the source literals rather
than the function secrets. Always drop the policy: it is an anon-writable window
on a bucket the function executes code from.

### 3.4 Regenerate percentile anchors (after balance-affecting changes)
Run a 20k sweep that collects legacy/gross/fees, compute 12 evenly-spaced
quantiles each, write them into `DISTRIBUTIONS` in
`apps/web/src/lib/game.ts` (the anchors ladder is documented there).

### 3.5 Verify the UI (mandatory after UI changes)
```bash
pnpm build
pnpm preview &                     # serves the build on :4173
SHOTS=/tmp pnpm verify:ui          # must print PASS
```
`pnpm preview`, **not** `npx vite preview` — vite is a dependency of `apps/web`
and not of the root, so from the repo root `npx` has nothing to run. It failed
that way in CI while appearing to work locally.
It plays a whole career at 375×667 — with an iPhone SE's 20pt status bar,
emulated — in **both** languages and fails on document scroll, a card with more
than three options, console errors, broken images, a block of text that ends
on a lone character or word (on every screen, and in every reference sheet it
opens), or a career that ends after fewer than 15 cards (which means the
harness lost the flow, not that the career was short). It then loads the intro
on seven phone shapes with their real safe areas and fails if the title block
is not whole. If you rename a button's copy or the
`data-option-id` attribute, fix `tools/verify-ui.mjs` in the same commit — a
harness that silently clicks nothing reports a clean run over a career it never
played.

### 3.6 Verify the desktop layout (mandatory after UI changes)
```bash
pnpm build
pnpm preview &
SHOTS=/tmp pnpm verify:desktop     # must print PASS
```
Same career, same assertions, at 1440×900, 1920×1080 and 1280×720 in both
languages, plus the checks that only mean anything with a mouse: the game panel
is centred and height-capped rather than stretched down a 1080px window, the
rewarded ad is a panel and not the whole screen, and the sheets dock to the
panel rather than to the bottom of the browser. Run it alongside the phone pass
— a change that fixes one and breaks the other is the normal failure here.

### 3.6b After a copy or event change: play it and read what it said
```bash
pnpm build && pnpm preview &
pnpm playtest -- --combo=en/standard/technical --careers=100 --out=/tmp/pt/a
pnpm playtest -- --combo=zh/daily/gk --careers=100 --out=/tmp/pt/b   # …and so on
```
One combination per invocation: **2 languages × 4 modes (quick, standard, deep,
and the daily challenge) × 4 profiles (the three player types, and the
goalkeeper as a profile of his own)** — 32 combinations, ×100 careers each is
the full 3,200-career sweep. Within each combination the positions, surnames
and passports cycle off the career index. None of that is decoration: the
first 1,800-career sweep left the identity screen on its defaults, played one
Englishman in one position eighteen hundred times, and never dealt two of the
deck's cards once. `decisive_save` is goalkeeper-only and a goalkeeper is a
materially different game — his own attribute names, his own stat columns, a
near-binary appearance model — which is why he is a quarter of the matrix
rather than a twelfth of a position cycle. The daily challenge is in the
matrix because it pins the seed and the pace, and a pinned seed exercises the
replay-the-same-world path nothing else touches.

It plays the **full lifecycle** — intro (or the daily sheet), identity, every
card, the summary, the share sheet, and once per combination the replay door —
and it fails on the mechanical faults: an unresolved `{slot}`, a raw i18n key,
an untranslated engine id, text clipped by its own box, a document that
scrolls, a console error, a broken image. Through the app's opt-in state hook
(`localStorage['fc:testhook'] = '1'` → `window.__fcState`, published only when
the flag is set — see `App.tsx`) it also holds the career behind the screen to
what football allows: ages that count one by one, a banned season with no
appearances in it, no keeper credited with goals, totals that equal the sum of
their seasons. And, more importantly, it writes **every card it was shown** to
a JSONL transcript: the title, the body, every option, every consequence line
and the result that followed.

Then read the transcript. That is the point of it, and there is a tool for it:

```bash
node tools/read-playtest.mjs /tmp/pt/run-*.jsonl > /tmp/pt/copy.txt
node tools/read-playtest.mjs --stats /tmp/pt/run-*.jsonl
```

Sixteen thousand cards is not readable and does not need to be: the deck repeats.
`read-playtest` collapses the transcript to **one of each distinct screen** —
title, body, options, and every distinct result that followed each option — with
money and ratings normalised so two screens differing only in a figure are one
screen, and the frequency beside each so the common cards are read first. Both
of the worst faults on this branch were found in its output and neither is
visible to any property check in this repository: `roundMoney` clamping negative
money to zero, so ten cards that cost money were free; and every event card that
moved a player promising a squad place whatever the club. Every automated check this
repo has passed while eighteen faults I found in one playthrough were
live, because each of those checks tests a *property* and none of them reads
the card. A sentence no human can parse is not a property violation; neither is
a result that contradicts the option the player pressed — "You hid" after
choosing *Demand the ball* — nor a card whose winning branch is a demotion.

Run at most three combinations at once: four cores shared between six browsers
made careers time out waiting for a page to paint, and threw away 78 of 540 in
the sharded first version of this tool.

### 3.6c Ship a change (the normal route)
```bash
# on main, with the §0.1 gate green (sh bin/gates.sh)
git add <the work>
git commit -m "..."
git push origin main
```
That is the whole ceremony, and it deploys — see §3.9 for what to watch. No
branch and no pull request unless the change wants a preview first (§0.4);
then use `git push -u origin <branch>` and §3.7 below.

### 3.7 Update the pull request (every push, not just the first)

Only when a pull request exists — see §0.4; the default route is §3.6c.
```bash
# after `git push -u origin <branch>`
gh pr edit <number> --body-file pr-body.md   # replaces the whole body
```
Rewrite the body so it describes the branch **as it now stands**: a fresh
summary, a checklist whose ticks match reality, and the verification that was
run against this head. Do not append an "update" section to a stale body —
replace the whole thing. Anything an intervening commit made untrue gets deleted
or corrected, and a checklist row that claims a fix later reverted is worse than
no checklist.

### 3.8 Submit the site to Baidu after a URL change
```bash
BAIDU_PUSH_TOKEN=… node tools/baidu-push.mjs --dry-run   # see what would go
BAIDU_PUSH_TOKEN=… node tools/baidu-push.mjs
```
The token lives in my environment and never in the repository
(百度搜索资源平台 → 普通收录 → 推送接口). The tool takes its URL list from
`apps/web/public/sitemap.xml` and refuses to submit anything that would redirect,
because Baidu's quota does not accumulate and its own guidance is to submit the
post-redirect URL. Google still needs the site *submitted once* from its
console, which only I can do. `docs/seo.md` §3 is the checklist.

Bing has its own push channel and it needs no token:
```bash
node tools/indexnow.mjs --dry-run
node tools/indexnow.mjs        # Bing, Yandex, Seznam, Naver in one call
```
The deploy to main runs this automatically, so running it by hand is for a URL
that changed without a deploy. Do **not** treat the IndexNow key like the Baidu
token: it is published at `https://decisionfc.com/<key>.txt` on purpose, because
serving it is how the host proves the submission is its own. Deleting that file
from `apps/web/public/` breaks every future push silently — `pnpm seo` fails if
it stops being served, which is the only reason anyone would notice.

### 3.8b Re-publish on itch.io
```bash
pnpm build:itch             # → itch/decision-fc-itch.zip
node tools/itch-assets.mjs  # → itch/cover.png + itch/screenshots/*.png
```
Both, in that order, and always together — a screenshot of a build that no
longer exists is the same fault as a stale doc. `itch-assets` is also the
check: it serves the zip from a directory number nobody has seen and fails on
any 404, console error or screen that scrolls, which is the only way to catch an
absolute URL that works locally and 404s on itch. **Look at each language's
set the moment it is written** — English finishes first — and if one needs
redoing, re-shoot only that one with `--only=en` or `--only=zh`, or only the
bad picture with `--frames=4-offer` (from any career — the set need not be one
career), a rule since 2026-09-23, when a Chinese run was waited out only
for both to be re-shot over one English frame. The published set is the best
of each title across runs, and every run's frames are kept in `itch/takes/`
(git-ignored) so that choice is always possible. **Every picture but the title
screen is a different player** (since 2026-09-23) — `CAST` in the tool gives
each frame its own name, nationality, position and type, and each frame is its
own career. **Run the frames in parallel**, one process per `--frames=` value;
the tool takes any free port for that. The summary is ranked for seasons at
the fourteen clubs of 85+ reputation and scrolled to its best stretch — a World
Cup winner whose table read Stoke, Palermo, Athletic was the example
of a summary that does not sell. **The cover is a career of its own** too
(since 2026-09-23): drawn from `7-summary`, it had shown the front page the
same player twice, side by side. `--frames=cover` plays it with its own `CAST`
player and keeps the shot in `itch/cover-shot.png`, outside `screenshots/` so it
is never uploaded as a screenshot; after picking one by hand from the takes,
`--cover` redraws the cover from that file. Uploading is manual and stays
manual (`docs/itch-io.md` §5); re-upload when there is a reason to play
again, not for a copy fix.

**`pnpm verify:itch` is now a CI gate, and it is the reason you will notice.**
It compares the `__ENGINE_BUILD__` fingerprint inside the tracked zip with the
one this commit's engine produces, and goes red when they differ. So an engine
change that forgets the zip fails the build rather than reaching a stranger on
itch.io who reports a bug that was fixed three weeks ago — which is how it
surfaced before. A copy-only or CSS-only change does not move the fingerprint
and does not fail it, which is deliberate: that gate is about the *rules* the
zip plays by.

When it fails, the fix is the two commands above and a commit of the zip.

### 3.9 Cloudflare deploy
Pushing `main` auto-deploys IF Git is connected in the Cloudflare
dashboard, or IF the `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` secrets
exist (`.github/workflows/deploy-cloudflare.yml`). Manual deploy:
`pnpm --filter @bg/web build && npx wrangler deploy` (needs a token).
Live URL: https://football-career.daviesluo.workers.dev/ — the worker's own
address, serving the same deployment as decisionfc.com. CI checks the deploy
there (`verify:live` with `SITE=` that URL), because decisionfc.com's bot
protection answers a GitHub runner 403 and workers.dev is not in that zone, so
no WAF rule for the checker is needed.

### 3.10 PR previews — a playable build of every push
`.github/workflows/preview.yml` runs on every push to a PR and needs nothing
from you. It uploads a Worker **version** (`wrangler versions upload`), which is
never routed to production; the PR then shows a deployment box and a comment
with a stable per-PR link and a per-commit link.

Three rules about it:

- **Never change `versions upload` to `deploy` or `versions deploy` in that
  file.** Those two promote a build to production, and this workflow runs on
  code that has not been reviewed. `versions upload` is the entire safety
  property — decisionfc.com cannot be touched by a pull request.
- **The preview must not reach the leaderboard.** The build sets
  `VITE_SUPABASE_URL` to an unresolvable host so a career played while trying a
  branch out cannot enter the public board. If you ever need a preview that
  *does* submit, do it in a throwaway branch and say so on the PR — do not
  quietly drop the override.
- **It is silent without a token.** No `CLOUDFLARE_API_TOKEN`, no preview, green
  job. Do not "fix" that by removing the guard: a fork or an unconfigured repo
  would then show a red X on every PR.

`CLOUDFLARE_ACCOUNT_ID` is optional and was deliberately made so: wrangler reads
the account off the token when the token reaches exactly one, and an account id
is the harder of the two to find. Set it only if wrangler complains that the
token reaches several accounts — its error lists the ids. The id itself is in
the dashboard URL (`dash.cloudflare.com/<account id>/…`) and in the Workers
overview sidebar; `npx wrangler whoami` prints it too.

If the comment appears without a working link, the usual cause is preview URLs
being disabled on the worker — a Cloudflare dashboard setting, not a repository
one. They are on when Settings → Domains & Routes shows a
`*-football-career.<subdomain>.workers.dev` entry.

## 4. Design compass (why things are the way they are)

The pillars the game stands on: visible-odds gambles with a roulette reveal;
key-moment cards that pre-simulate a final and hand the player the coin; a
by-age career table with crests and trophies; a market where offers are always
plausible (geography opens with ability, benchwarmers get no giant-club
offers); band-indexed title odds so mid-table clubs do not win leagues;
contracts that renew only near expiry. When adding features, ask: does this
create a decision the player can regret? If not, it probably does not belong.
