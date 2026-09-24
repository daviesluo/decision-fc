# Project review — September 2026

Written against the repository as it stood in September 2026. The README it
cites has since been split into `docs/README.md`, `docs/map.md` and
`docs/design.md`.

> **This review was written in September 2026 and has since been worked
> through. This banner records what happened to each item. The findings below
> are unchanged, so they still read as the argument made at the time rather
> than as a summary of the work.**
>
> I started on every item on 2026-09-17, and each one was verified before it
> was fixed. Two decisions made partway through shape the table below: **I
> dropped the rival**, and **I kept the round to repairs, not additions**,
> which settled three items without code.
>
> Read the table first. Where a finding and the code disagree, the code and the
> table are right and the finding is the argument that was current in
> September.
>
> ### What happened to each item
>
> | | Item | Outcome |
> |---|---|---|
> | R-01 | Rewarded video cannot serve | **Done.** Publisher id is a committed constant, hostname-gated; the tag carries the two attributes the Ad Placement API reads; one loader, not two. |
> | R-02 | Daily challenge has no board | **Done.** A fourth board ranks a career against the others on its own seed and pace. No shared clock, nothing to lie about. |
> | R-03 | Endpoint open and unmetered | **Done, one part declined.** 20 submissions/minute per address, salted-hash buckets, fails open; four count queries became one. **The CORS allowlist was deliberately not built** — an Origin header is whatever a script says it is, and the one browser it would constrain is the itch.io iframe where real players are. |
> | R-04 | No analytics | **Done.** Seven funnel counters and a crash count, one integer per name per day, no identifier of any kind, disclosed on `/privacy/`. `career_started` was added last, so the top of the funnel has a per-career denominator and the rate this section asked for can actually be computed. |
> | R-05 | Badge-chasing beats role-reading | **Done, one target missed on purpose.** A medal is now worth your part in it, minutes pay for development at every age, and the offer card finally shows tactical fit (I removed it again on 2026-09-23: the read is the player's, How to Play explains it, and every transfer window now carries a club that suits him, unlabelled — see the README). `shrewd` beats `ambitious` on all three boards. The player still controls 29% of the visible range, not 40% — see the note under the acceptance table for why that was not forced. |
> | R-06 | Endings top-heavy and tail unreachable | **Done, one target missed and stated.** A hundred caps stopped outranking five league titles; `homegrown` stopped being killed by the loan ladder; `serial_winner` became a thing that happened rather than a score. The top two are 33.9% rather than ≤30%, and the acceptance table says why. |
> | R-07 | A finished career leaves no trace | **Built, then removed.** The last twenty as summaries, with personal bests, on the device — shipped 2026-09-17, removed 2026-09-23. `storage.ts` deletes the stored key at boot. |
> | R-08 | Four cards with a dead branch | **Done.** 35 of 35 cards are a real weighing-up. |
> | R-09 | Playtest findings never reconciled | **Done.** One of the five reproduced, and not where the note said: the manager style is clipped in the *player header*, where it is deliberately truncated. The offer row was never clipped. What was genuinely missing was tactical fit. |
> | R-10 | Rival and reveal speed | **Both out.** Reveal speed was built on 2026-09-17 and I removed it on 2026-09-23; I dropped the rival on 2026-09-17, partway through building it, and its engine work was reverted before it was committed. Neither is to be re-proposed. |
> | R-11 | Meta-progression absent | **Declined.** It is an addition, not a repair. GDD §10 now says which two of its six exist and that the other four are not planned. |
> | R-12 | One ad slot | **Held, deliberately.** Wait for R-01 and the funnel to produce a revenue number, then take at most one — the daily check-in, the only slot that cannot touch a career in progress. Recorded in the GDD and in `docs/monetisation.md`. |
> | R-13 | No service worker | **Done.** Network-first HTML, cache-first hashed assets, a five-file precache, and a real offline check in `verify:ui`. |
> | R-14 | CI flakes unreproducible | **Done.** A failure prints the seed; the desktop run plays the daily challenge, which is the only way the new daily row is gated, and its clock is pinned (`--day=`) so the run is reproducible for good rather than until midnight. |
> | R-15 | Dependency majors | **Done, TypeScript held.** 7.0 is a compiler rewrite and should land alone. |
> | R-16 | Two files past reviewability | **Not done this round.** `machine.ts` and `engine.test.ts` are still 2,200 and 2,100 lines. A pure split is four thousand lines of churn with no behaviour change, and this round was for repairs — this is tidying. It needs its own quiet commit. |
> | R-17 | Crest weight | **Done.** Artwork is served as WebP: the site is 3.7 MB, down from 6.7, and the itch zip 2.2 MB, down from 5.3. |
> | R-18 | Storage keys from three eras | **Done.** One `fc:` namespace, migrated at module evaluation — the only point early enough, which the harness proved. |
> | R-19 | No HSTS | **Done.** One year, `includeSubDomains`, no `preload`. |
> | R-20 | Unused country index | **Done.** Dropped. |
> | R-21 | Stale repository name | **Done.** Neither document names the old repository any more, and GitHub redirects the old path. |
> | R-22 | The GDD describes a game not built | **Done.** A banner naming what in it is not the game, and notes in §10 and §11. |
> | R-23 | No changelog, stale in-game news | **News done, changelog declined.** `NEWS_VERSION` and all five items rewritten for what actually shipped. A `CHANGELOG.md` is a new artifact rather than a repair; the commit messages already carry the history. |
> | R-24 | The itch build has no rebuild step | **Done.** `pnpm verify:itch` compares the engine fingerprint inside the tracked zip with this commit's, and CI runs it. |
>
> ### And the fixes were audited in turn
>
> On 2026-09-18 everything this round changed was reviewed again, from
> scratch — not only whether it was correct, but whether it was necessary
> and whether it would hold. That audit is why the table above has rows that
> read differently from the commits that first closed them, and it produced
> fixes of its own:
>
> - **The privacy page had become untrue.** It said no IP address is kept. The
>   rate limiter keeps a salted hash of one for five minutes, which is not the
>   same claim. Both languages now say exactly that, and say it is about abuse
>   rather than measurement.
> - **The itch build could not reach the privacy page at all** — `/privacy/` is
>   stripped from that zip and the Settings link was root-absolute, so it landed
>   on itch's own 404. It is an absolute link off-site now, and `build-itch.mjs`
>   fails the build if a root-absolute one ever comes back.
> - **The ad gate excluded `www`.** There is no such host today, but one is
>   planned, and the exact-match check would have turned the ads off on it
>   without a word.
> - **Three files said a missing crest 404s.** Under Cloudflare's SPA fallback
>   it answers 200 with the index page; the fallback works because a browser
>   cannot decode HTML as an image. Measured against the live site.
> - **The four new mechanics had no unit tests** — they were landed on the
>   strength of simulations, which say a median moved and not that a keeper's
>   full season is thirty-eight games. Six tests now pin them.
> - **Nothing checked that a deploy reached anybody.** `pnpm verify:live` asks
>   the site whether it is serving what the tree builds; the deploy workflow
>   runs it and a daily workflow repeats it.

Reviewed against `main` as it stood on 2026-09-05. The whole tree was read:
the engine, the content package, the web app, the edge function, the tools, the
workflows and every document under `docs/`. The numbers below were measured on
that tree, not quoted from the README.

---

## 1. The verdict in one page

**The engineering is in good shape and is not the problem.** The engine is
genuinely pure, the replay anti-cheat works, the gate battery is real, the
documentation habit is unusually strong, and the code comments explain *why* far
more often than *what*. Very little here needs rescuing.

**The problem is that several shipped features do not do the thing they were
built to do, and nobody can currently tell.** Three examples, all confirmed
below:

- The rewarded-video ad path cannot serve an ad in any build that exists. Not
  because AdSense has not approved the site — because the build-time variable
  that switches the network on is set in no workflow, so the house creative
  plays every time and revenue is structurally zero.
- The daily challenge has no daily leaderboard. Its own source comment says it
  exists because the all-time boards are "a wall, not a competition", and the
  design document promises "one global seed + one starting identity + a
  leaderboard". The backend has no such board.
- There is no analytics of any kind, and the tech plan lists the funnel as
  needed at launch. Every product judgement below — and every one after it — is
  currently made blind.

**And the game's own ceiling is lower than the design intends.** Across 400
seeds the best deliberate policy is the *shallowest* one: always chase the
biggest badge. Reading a role and picking the club that will play you comes
second. That inverts what the game is about.

The priorities that follow are ordered by that reading: first make the shipped
things work, then raise the ceiling, then tidy the platform.

---

## 2. What was measured

| Measurement | Command | Result |
| --- | --- | --- |
| Unit + content suites | `pnpm test` | 137 passed, 39.9 s |
| Balance smoke | `pnpm balance -- --runs=1500 --assert` | every band passes |
| Card economy | `pnpm deck` | 35 cards: 31 a real weighing-up, 0 dominated, 0 flat, 0 free lunch, **4 no premium** |
| Player skill | `pnpm skill` (400 seeds) | ambitious 2222 · shrewd 2131 · loyal 1925 · unambitious 1787 · random 1628; the player controls 29 % of the visible range |
| Bundle, gzipped | `pnpm build` | main 138.4 KB · en 20.6 KB · zh 23.6 KB · zh clubs 3.6 KB · css 10.1 KB |
| Published site | `dist/` | 6.7 MB across 257 files, of which crests 4.5 MB / 192 files and trophies 964 KB / 34 |
| Leaderboard table | Supabase `public.bg_runs` | 278 rows, all verified, 278 distinct seeds, first 2026-07-28, last 2026-09-05 |
| Dependencies | `pnpm outdated` | 8 packages a major behind (detail in R-15) |
| Dead work markers | `grep -rn "TODO\|FIXME"` | none |

Two distributions worth keeping in front of you.

**Endings, over 1,500 careers.** Two endings take 45 % of every career played:

| Ending | Share | | Ending | Share |
| --- | --- | --- | --- | --- |
| centurion | 23.07 % | | journeyman | 1.07 % |
| solid_pro | 21.80 % | | nearly_man | 0.93 % |
| promotion_hero | 9.73 % | | cup_specialist | 0.73 % |
| globetrotter | 5.60 % | | oil_baron | 0.47 % |
| world_champion | 4.93 % | | boy_wonder | 0.33 % |
| late_bloomer | 4.53 % | | frozen_out | 0.27 % |
| ballon_dor_winner | 4.53 % | | goat | 0.13 % |
| goal_machine | 4.33 % | | serial_winner | 0.07 % |
| disgraced | 4.13 % | | homegrown | 0.07 % |

(the remainder: continental_nomad 3.87 %, squad_player 2.53 %, the_wall 2.13 %,
comeback 2.00 %, continental_king 1.47 %, glass_talent 1.27 %.)

**Skill, over 400 seeds.** Legacy score by policy, higher is better:

| Policy | Legacy | What it does |
| --- | --- | --- |
| ambitious | 2222 | always take the biggest club |
| shrewd | 2131 | read the role, take the club that will play you |
| loyal | 1925 | stay |
| unambitious | 1787 | take the safe move |
| random | 1628 | no policy at all |

---

## 3. Findings

### P0 — shipped, and not doing its job

#### R-01 · Rewarded video cannot serve in any build that exists
**Size** S · **Open question:** the publisher id, and whether to keep two loaders

**What is true today.** `main.tsx` installs the ad network only when
`hasAdNetwork()` is true, and that reads `VITE_ADSENSE_CLIENT`. No workflow,
`.env` file or build step in this repository ever sets it. So `installAdSense()`
never runs, `window.adBreak` is never defined, `adSenseProvider` is never
selected, and every rewarded slot falls through to the house creative. The
inline tag in `apps/web/index.html` does load AdSense on `decisionfc.com`, but
it is the *account* tag: it carries neither `data-ad-client` nor
`data-ad-frequency-hint`, and the ad library's own comment in `ad-adsense.ts`
says those "must be on the tag itself" for the Ad Placement API.

**Why it matters.** This is the entire revenue model. It has been dark for the
life of the deployment, and it will stay dark on the day AdSense approves the
site, because approval does not set a build variable. It also means the ladder,
the skip threshold and the fallback path have never been exercised against a
real network.

**Proposed change.**
1. Add `VITE_ADSENSE_CLIENT` to the Cloudflare deploy workflow as a repository
   variable, so only the production build carries it. Previews and local builds
   keep the house creative.
2. Resolve the two loaders into one. Either put `data-ad-client` and
   `data-ad-frequency-hint` on the inline tag and have `installAdSense()` adopt
   an existing tag instead of appending a second one, or delete the inline tag
   and give `installAdSense()` the same hostname gate. One script, one place.
3. Add a one-line production check to the deploy notes: on `decisionfc.com`,
   `typeof window.adBreak === 'function'`.

**Gate.** `pnpm build`, `pnpm verify:ui`, `pnpm verify:no-leak`, then the
production check above after the deploy.

---

#### R-02 · The daily challenge has no daily leaderboard
**Size** M · **Open question:** is the daily meant to be a contest?

**What is true today.** `apps/web/src/lib/daily.ts` fixes the seed and the pace
so that every player gets the same world, and says why in its own header: three
all-time boards "ranked against everybody who has ever played are a wall, not a
competition. A board that resets every day and hands everyone the same world is
a thing a player can actually win." The design document promises exactly that
(`docs/game-design.md` line 290). The README describes it the same way.

There is no such board. `bg_runs` stores `seed` but has no index on it, the edge
function ranks only against every run ever recorded, and the client's sense of
"played today" is a `localStorage` flag. Of the 278 runs recorded since
2026-07-28, all 278 have distinct seeds — so no two submitted careers have even
shared a world.

**Why it matters.** The daily is the retention mechanic. Built as it is, it is a
fixed seed with nothing to compare against, which is the same wall the comment
says it exists to remove.

**Proposed change.**
1. `create index bg_runs_daily_idx on public.bg_runs (seed, legacy_score desc)`.
2. Teach `career-submit` a daily mode: when the submission's seed is today's
   challenge seed and the pace is `standard`, also return the rank within that
   seed.
3. Show it on the summary screen when the run was a daily, above the all-time
   boards, with the reset time.
4. Decide what happens to yesterday's board — dropped, or kept as a "yesterday's
   winner" line on the title screen.

**Gate.** `pnpm test`, `pnpm build`, an end-to-end submission against the
deployed function, and the existing `verify-bundle` step in `deploy-edge`.

---

#### R-03 · The submission endpoint is open, unmetered, and counts the whole table on every call
**Size** M · **Open question:** none

**What is true today.** `packages/backend/edge/handler.ts` sets
`Access-Control-Allow-Origin: *`, the function is deployed `--no-verify-jwt`,
and there is no rate limit of any kind. Every accepted submission then runs four
`count=exact` queries (one total, three "rows above this score").

The handler is otherwise careful, and this should be said plainly: every field
is length-bounded before it reaches the engine, the decision list is capped at
400, the replay is the source of truth for every stored number, and `run_hash`
is unique so a resubmitted identical career is ignored rather than duplicated.
The exposure is volume, not correctness.

**Why it matters.** A replay is real CPU. An unmetered public endpoint that
runs the game engine on demand is a free compute faucet, and the four exact
counts turn every submission into four full scans — invisible at 278 rows,
linear from there. Separately, the boards count *runs*, not players, so a
denominator of "everyone who has ever played" is really "every career anyone
ever finished".

**Proposed change.**
1. Allowlist the origins: `decisionfc.com`, the itch.io host, and the preview
   domain. Keep `*` for `OPTIONS` only if the allowlist makes it necessary.
2. Add a per-IP token bucket — a small table keyed by IP and minute, or the
   equivalent in the edge runtime. A generous limit; the goal is a ceiling, not
   a gate.
3. Replace the four counts with one query that returns the three ranks and the
   total together, and cache the total for a minute.
4. Record in `docs/fairness-review.md` that a percentile is per career, not
   per player, and decide whether that is the intended reading.

**Gate.** `pnpm test`, `deploy-edge` with its `verify-bundle` step, a submission
smoke test, and the rollback pin in `current.json` left intact.

---

#### R-04 · There is no analytics, and the tech plan calls it a launch requirement
**Size** S · **Open question:** analytics at all, and if so whose

**What is true today.** Nothing in the web app records anything. No page view,
no funnel step, no error report. `docs/tech-plan.md` §7 names the funnel that
was meant to exist: entry → identity completion → season-5 retention → career
completion → share → second run.

**Why it matters.** Every finding in P1 below is a hypothesis about players.
Without a funnel, the only feedback loop is my own play and 278 rows of
completed careers — which are, by definition, the players who did *not* drop
out. The most valuable number in the project right now is the one nobody has:
how many people start a career and never finish one.

**Proposed change.** One cookieless, privacy-light counter, and only the six
funnel steps above plus an error count. Cloudflare Web Analytics fits the
existing hosting and needs one script tag; a `/api/e` beacon into Supabase is
the alternative that keeps the data in a table the project already owns. Either
way, no third-party identity, no cross-site anything, and a line in the privacy
page. Hold the decision until R-01 is settled, so the consent story is decided
once.

**Gate.** `pnpm verify:ui` (a new script tag is a boot-path change),
`pnpm verify:no-leak`, and a privacy-page update in the same commit.

---

### P1 — the game's ceiling

#### R-05 · Skill barely matters, and the shallowest policy wins
**Size** L · **Open question:** how much choice should decide a career; a design change, not a bug fix

**What is true today.** Over 400 seeds, "always take the biggest badge" beats
"read the role and go where you will play" by 91 legacy points, and the whole
spread between the best deliberate policy and random play is 594 points — the
player controls 29 % of the visible range. `docs/game-review.md` already
flagged the ceiling as shallow; this measures it.

**Why it matters.** The game's premise is that the interesting decision is
between a bigger badge and more minutes. If badge-chasing simply wins, the
premise is decoration. It also caps the skill expression a leaderboard needs:
if a quarter of the outcome is the player, the boards mostly rank seeds.

**Proposed change.** Make the ceiling bite.
1. Strengthen the penalty for signing above `roleCeiling`: fewer minutes, slower
   development, and an earlier consequence, so the third season at a giant on
   the bench actually costs a career.
2. Make the read available before the decision — the offer row currently clips
   the manager style and never shows tactical fit (see R-09). A policy the
   player cannot see is not a skill.
3. Re-measure. Targets: `shrewd` above `ambitious`, and the player-controlled
   share of the range at 40 % or better.

**Gate.** The unconditional engine battery — `pnpm typecheck`, `pnpm test`,
`pnpm fairness --assert`, `pnpm market`, `pnpm skill --assert`, `pnpm deck`,
`pnpm plausibility --assert` — and `pnpm balance -- --runs=1500 --assert`, then
the full 20,000-career `pnpm balance` before it lands, because this moves the
acceptance table.

---

#### R-06 · Two endings take 45 % of all careers, and the tail is unreachable
**Size** M · **Open question:** which endings are meant to be lottery-rare

**What is true today.** `centurion` 23.07 % and `solid_pro` 21.80 % between them
end nearly half of all careers. At the other end, `homegrown` and
`serial_winner` land at 0.07 % each and `goat` at 0.13 % — roughly one career in
a thousand, which for `homegrown` (never leave your first club) reads less like
rarity and more like an ending the systems make impossible.

**Why it matters.** Endings are the game's memory. A player who plays ten
careers should collect a handful of distinct ones; today they will most likely
get four `centurion`s and three `solid_pro`s. And an ending nobody can reach is
content that was written and never seen.

**Proposed change.**
1. Separate the endings I intend as lottery-rare (`goat`, probably
   `serial_winner`) from the ones that are accidentally unreachable
   (`homegrown`, `boy_wonder`, `frozen_out`).
2. Retune the rarity thresholds so the top two are 30 % or less combined, and
   no *intended-reachable* ending sits below about 0.5 %.
3. Check `homegrown` specifically against the loan ladder: 93.8 % of careers go
   out on loan and 88 % of those at 17, which may be what makes never leaving
   your first club arithmetically impossible.

**Gate.** As R-05. This is a balance change and needs the 20,000-career run and
a README acceptance-table update in the same commit.

---

#### R-07 · A finished career leaves no trace
**Size** M · **Open question:** none

**What is true today.** The save is a single slot (`bg:save:v2`). Finish a
career, press play again, and the one before it is gone — no list, no personal
best, no "your longest career", nothing to compare a new run against.

**Why it matters.** This is the cheapest retention win available and it needs no
engine change at all. The summary already computes everything worth keeping; it
is simply thrown away. It also gives the daily board (R-02) something to sit
next to, and gives a returning player a reason to open the game that is not "I
want to start over".

**Proposed change.** Keep the last twenty career summaries in local storage —
ending, club, seasons, legacy, peak value, the seed. Add a career-history sheet
reachable from the title screen, with personal bests pinned at the top. Purely
client-side; no backend, no account.

**Gate.** `pnpm typecheck`, `pnpm test`, `pnpm verify:ui` and
`pnpm verify:desktop` in both languages.

---

#### R-08 · Four cards have a branch that is never worth taking
**Size** S · **Open question:** none

**What is true today.** `pnpm deck` reports four cards where one option risks
points for no premium: `testimonial` / `have_it` (risks 10), `referee_row` /
`say_it` (risks 8), `transfer_request_leak` / `deny_it` (risks 8), and
`coaching_badges` / `start_them` (risks 5). The other 31 cards are clean.

**Why it matters.** Each of these is a decision the player is asked to make
where one answer is simply worse. Four out of thirty-five is not a crisis, but
the deck report exists precisely to keep that number at zero, and it is the
cheapest quality bar in the project to hold.

**Proposed change.** For each card, either raise the upside of the risky branch
until the expected value justifies the variance, or lower the stake. Prefer
raising the upside: these are the dramatic options, and they should be the ones
worth gambling on.

**Gate.** `pnpm deck` back to zero, plus `pnpm test` and
`pnpm balance -- --runs=1500 --assert`.

---

#### R-09 · The playtest findings have never been reconciled
**Size** M · **Open question:** none

**What is true today.** Five findings from an earlier playtest are on record,
none of them re-verified against the current code: cards hide their
real effects (cash, growth, injury risk, wage); absolute-role outcomes demote
good players on the winning branch; result prose sometimes contradicts the
option chosen; offer rows clip the manager style and never show tactical fit;
assorted copy and label faults.

**Why it matters.** Two of these are not cosmetic. "Cards hide their real
effects" and "offers never show tactical fit" are the same problem as R-05: the
player is asked to choose without the information the choice needs.

**Proposed change.** Re-run `pnpm playtest` across the mode grid, confirm which
findings still reproduce, and fix only those. Do this **before** R-05, because
what it turns up changes what R-05 has to move.

**Gate.** The full battery — the playtest harness reaches engine, content and
UI at once.

---

#### R-10 · Two designed features remain unbuilt
**Size** M · **Open question:** build them, or strike them from the design

**What is true today.** Two features were designed and never built: a rival —
a named contemporary whose career runs alongside yours — and a reveal-speed
control.

**Why it matters.** The rival turns a solitaire number into a comparison the
player cares about, and it costs the engine almost nothing because the world is
already simulated. Reveal speed is a five-line preference that fixes a real
complaint about pacing.

**Proposed change.** Take reveal speed now — it is small and independent. Scope
the rival properly as its own change, after R-05, since both touch what the
player is reading in a season.

---

#### R-11 · The design's meta-progression does not exist
**Size** L · **Open question:** build it, or strike it from the design

**What is true today.** `docs/game-design.md` §10 describes achievements,
unlockable starting conditions and weekly scenarios. None of it is built, and
nothing in the code refers to it.

**Why it matters.** Either it is the roadmap, in which case it should be
sequenced; or it is not, in which case the design document is describing a
different game to everyone who reads it first (see R-22).

**Proposed change.** Decide. If yes, the smallest useful slice is achievements
tied to the existing ending list, which needs R-07's career history to sit on.
If no, strike §10 and say why in the same commit.

---

#### R-12 · One ad slot is the whole monetisation surface
**Size** M · **Open question:** a second slot, and when

**What is true today.** The only rewarded slot is "play again"
(`apps/web/src/lib/ads.ts`), with a free first replay each day and a 5/10/15/20/30
second ladder that resets daily. The design document lists five more slots —
retry a key moment, injury insurance, one more offer, one more season, a daily
check-in — plus a red line that reward-assisted runs belong on a separate board.
None of those exist, which also makes the red line moot.

**Why it matters.** The restraint is defensible and well argued in the source
comments, and it should not be undone casually. But one slot at the very end of
a session, currently serving nothing (R-01), is a thin base for an ad-funded
game. Worth noting: any slot that changes a run in progress breaks the
replay-based anti-cheat unless the reward is itself recorded in the decision
list — which is the real reason to design it carefully rather than the reason
not to.

**Proposed change.** After R-01 and R-04 are in place and there is a revenue
number to reason from, pick at most one additional slot and measure it. The
daily check-in is the safest: it does not touch a career in progress, so it
cannot touch the anti-cheat.

---

### P2 — platform and engineering

#### R-13 · No service worker
**Size** M · **Open question:** none

The site ships `manifest.webmanifest` and is installable, but there is no
service worker, so an installed app with no connection shows the browser's error
page — for a game that is entirely client-side after boot. A cache-first shell
with network-first HTML would fix it. The risk is the familiar one: a stale
bundle served after a deploy. Version the cache by build hash and never cache
`index.html`.

**Gate.** `pnpm build`, `pnpm verify:ui`, `pnpm verify:desktop`, plus a manual
offline reload and a deploy-then-reload check.

#### R-14 · CI flakes are unreproducible because the UI harness plays unseeded careers
**Size** S · **Open question:** none

`tools/verify-ui.mjs` starts a real career with whatever seed the app generates,
so a failure cannot be replayed. The review lost time to exactly that: a
docs-only commit failed `verify:desktop` at "key 1 did not resolve card 15", and
diagnosing it needed a source read rather than a re-run. Drive the harness
through a fixed seed (the existing `fc:testhook` or a query parameter) and print
the seed on every failure.

**Gate.** `pnpm verify:ui`, `pnpm verify:desktop`, three consecutive clean runs
at both sizes.

#### R-15 · Eight dependencies are a major behind
**Size** M · **Open question:** when to take TypeScript 7

`vite` 6.4 → 8.2 · `vitest` 2.1 → 5.0 · `eslint` 9 → 10 · `typescript` 5.9 → 7.0
· `@vitejs/plugin-react` 4.7 → 6.1 · `eslint-plugin-react-hooks` 5 → 7 ·
`@types/node` 22 → 26 · `playwright` 1.62 → 1.63.

Two commits: build and lint tooling first (vite, vitest, plugins,
eslint, types, playwright), then TypeScript on its own, later. A compiler major
is not a dependency bump — hold it until the ecosystem around it has settled,
and never combine it with anything else.

**Gate.** The full battery on each commit, including the 20,000-career balance
run, since a toolchain change that alters number handling must be caught.

#### R-16 · Two files have grown past reviewability
**Size** M · **Open question:** none

`packages/engine/src/career/machine.ts` is 2,204 lines and
`packages/engine/src/engine.test.ts` is 2,093. Both have natural seams — the
machine by season phase, the test file by system. A pure split with no
behaviour change, gated by the full battery, would make the next engine change
reviewable. Do it *after* R-05 and R-06, not before: splitting a file while
changing its logic makes both harder to check.

#### R-17 · Crests are 4.5 MB
**Size** M · **Open question:** none

192 crest PNGs make up 4.5 MB of a 6.7 MB published site, cached for seven days.
Convert them to WebP at the served size with a PNG fallback, which should take a
large bite out of a mobile cold load.

#### R-18 · Storage keys come from three eras of the project
**Size** S · **Open question:** none

`bg:save:v2`, `bg:settings:v1`, `bg:locale`, `fc:ads`, `fc:daily`, `dfc.news`,
`fc:testhook` — three prefixes and two separators. Nothing is broken; it is a
trap for the next person adding a key, and it makes "clear everything this game
stored" impossible to write correctly. One namespace, with a read-time
migration from the old keys.

#### R-19 · No HSTS
**Size** S · **Open question:** none

`apps/web/public/_headers` sets four security headers and explains, well, why
there is deliberately no Content-Security-Policy. `Strict-Transport-Security` is
not covered by that reasoning and costs nothing. Add it. Revisit CSP only after
R-01 settles what the ad path actually loads.

#### R-20 · An index nobody uses, on a column nobody queries
**Size** S · **Open question:** build the country board, or drop the index

Supabase reports `bg_runs_country_idx` as never used. `country_id` is stored on
every run and never filtered on. Either build the country board — "best in your
country" is a natural product feature and the data is already there — or drop
the index.

#### R-21 · The repository name is stale in three places
**Size** S · **Open question:** none

After the rename to `DecisionFC`, two documents still say `Brew-Diary`
(`docs/maintainers-handbook.md` §3.7 and `docs/deploy.md` §1) and so does
this clone's git remote. GitHub redirects, so nothing is broken — it is just
wrong in the two places a new contributor reads first.

---

### P3 — documentation truth

#### R-22 · The design document describes a game that was not built
**Size** M · **Open question:** rewrite the design document, or mark it superseded

`docs/game-design.md` is still v0.1 and is the first thing a new reader
opens. It promises a daily leaderboard that does not exist (R-02), five rewarded
slots that do not exist (R-12), a meta-progression layer that does not exist
(R-11), and an "assisted board" for reward-helped runs that cannot exist because
no reward touches a run. Meanwhile the systems that *were* built — the six-rung
squad ladder, the two-year development cycles, the loan ladder, the 25 endings —
are described properly only in the README.

Either promote it to v1.0 written from the shipped game, or mark it "v0.1,
superseded" at the top with a pointer to the README's systems section. The
second is honest and takes ten minutes; the first is better and takes a day.

#### R-23 · No changelog, and the in-game news has been silent for five weeks
**Size** S · **Open question:** none

`NEWS_VERSION` in `apps/web/src/lib/news.ts` is `'2026-07-30'`. Everything
shipped since then — and that is a lot — has arrived without a word to returning
players. Bump it with the next player-visible change, and add the bump to the
handbook's pre-push checklist so it stops being forgotten. A `CHANGELOG.md` is
worth having for the same reason, and it feeds the news copy.

#### R-24 · The itch.io build has no rebuild step
**Size** S · **Open question:** none

`itch/decision-fc-itch.zip` was built on 2026-08-10 at 18:06 UTC, 34 minutes
after the last web change — so it is current. Nothing keeps it that way. The
next engine change silently makes it stale, and nobody finds out until a player
on itch.io reports a bug that was fixed weeks ago. Add the rebuild to the
handbook's pre-push checklist, or generate the zip in the deploy workflow.

---

## 4. A suggested order

This is the order that would waste the least work, not a commitment.

**Batch 1 — make the shipped things work.** R-01 (ads switched on), R-04
(analytics), R-19 (HSTS), R-21 (stale name). Small, independent, and R-04 is
what makes everything after it measurable.

**Batch 2 — the daily challenge becomes a challenge.** R-02 (daily board), R-07
(career history), R-03 (endpoint hardening). These three are one product
change: something to win, something to compare it against, and a backend that
can carry the traffic if either works.

**Batch 3 — the ceiling.** R-09 (reconcile the playtest findings) first, because
it changes what R-05 must move; then R-05 (skill), then R-06 (endings), then
R-08 (the four cards). This batch owns the acceptance table and needs the full
20,000-career balance run.

**Batch 4 — platform.** R-13 (service worker), R-14 (seeded harness), R-15
(dependencies, TypeScript held back), R-17 (crest weight), R-18 (storage keys).

**Batch 5 — the documents catch up.** R-22 (the design document), R-23
(changelog and news), R-24 (itch rebuild), and whatever R-10, R-11, R-12 and R-20
have been decided to be.

## 5. What this review deliberately does not propose

- **Rewriting the engine's architecture.** Purity, channel-addressed RNG and
  exact replay are the best decisions in the project and everything else depends
  on them.
- **Accounts, cloud saves or a social layer.** The game does not need identity
  to be good, and adding it would put a privacy and support burden on a
  one-person project.
- **A Content-Security-Policy.** The reasoning already written into `_headers`
  is sound while the ad path is unsettled.
- **Replacing Tailwind, React or the build.** They are doing their jobs.
- **Running the 20,000-career balance sweep on every change.** The 1,500-career
  smoke is the CI gate and the handbook is right about when the long one is
  needed.

## 6. Open questions

These are the eight questions that block work rather than merely shape it:

1. **R-01** — use the publisher id already in `index.html`, and which loader
   survives?
2. **R-02** — is the daily meant to be a contest with a board, or a solo puzzle?
3. **R-04** — analytics at all, and if so, whose?
4. **R-05 / R-06** — move the acceptance table to make skill matter more and
   the two dominant endings rarer?
5. **R-10 / R-11** — build the rival and the meta-progression layer, or strike
   them from the design?
6. **R-12** — a second ad slot after there is a revenue number, or hold at one?
7. **R-20** — build the country board, or drop the index?
8. **R-22** — rewrite the design document or mark it superseded?
