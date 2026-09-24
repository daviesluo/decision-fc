# Technical Plan and Production Schedule

> **This is the plan from July 2026, before the game was built, kept as a
> record.** What shipped differs. The app is Vite and React, not Taro, and
> there is no WeChat build yet. The leaderboard runs on Supabase. A career
> takes about four, six or eleven minutes. The game uses real club crests and
> real players' names (see `docs/crests.md` and `LICENSE`). What the game
> is now is in [design.md](design.md).

---

## 1. Architecture Principles

**One deterministic engine, two rendering frontends.**

```
packages/engine     Pure TypeScript, zero DOM / zero platform APIs / zero I/O
                    Input: seed + content pack + decision sequence  →  Output: complete career state
                    All randomness is seed-derived (`${seed}:${step}:${channel}`); an entire run replays 100% exactly

packages/content    JSON content packs: countries, clubs, competitions, event library, endings, i18n (en/zh-CN)
                    Decoupled from code → designers iterate independently / hot-updatable / lazy-loadable in chunks

packages/ui         Cross-platform UI logic (hooks, state machines, formatting, card layout computation)

apps/web            Mobile web (PWA)
apps/weapp          WeChat mini game / mini program

tools/balance       Balance simulator: batch-runs 100,000 careers and outputs distribution reports for tuning
```

**Why the "deterministic engine" is not over-engineering**:
1. Sharing a seed lets a friend play exactly the same opening → viral mechanic
2. Daily challenge uses one global seed → the leaderboard can be recomputed and verified server-side, preventing cheating
3. Regression testing: seed snapshot tests — when tuning numbers you immediately see what was affected
4. Bug reproduction: a user-reported seed + decision sequence reproduces the run precisely

---

## 2. Technology Choices

**Decided**: Taro 4 + React + TypeScript (H5 side).
**Other settled items**: TypeScript strict · pnpm workspace · Vitest · ESLint+Prettier · Tailwind (weapp-tailwindcss on the mini-program side) · Zustand for state · CSS/WAAPI for motion · Canvas 2D for share images.

### ⚠️ 2.1 WeChat form factor: Mini Game vs Mini Program (**not yet decided, see Q5**)

This has to be settled first. WeChat has two mutually incompatible runtimes:

| | WeChat **Mini Program** | WeChat **Mini Game** |
|---|---|---|
| Runtime | WXML / WXSS, DOM-style layout | **Pure canvas**, `game.js` entry point, no DOM |
| Entry configuration | `app.json` + pages | `game.json` |
| Taro support | ✅ natively supported via the `weapp` build target | ❌ **not supported** (Taro outputs a mini program) |
| Category | Once the "Mini Game" category is chosen it **cannot be switched back** to any other category | Same as left; additionally some console capabilities are hidden (template messages, customer-service messages, business domains, etc.) |
| Monetization | Ad publisher program: banner / rewarded video / interstitial (requires cumulative UV ≥ 1000 to activate) | Same ad placements, plus **Mini Game-exclusive IAA user-acquisition incentives and ad-credit policies** |
| Leaderboards | Requires a self-built backend | Native friends leaderboard via the "Open Data Domain"; a self-built backend also possible |

The original plan — "one Taro codebase producing both H5 and Mini Game" — **does not hold up technically**. Three possible paths:

**Path ① Build a "Mini Program" on WeChat (lowest cost)**
- Taro outputs both targets directly, ~85% UI reuse, fully consistent with the already-settled technology choices
- Our game is a text/card-driven UI, a natural fit for WXML layout; mixed Chinese-English typesetting in canvas is a nightmare
- ⚠️ Risk: if review classifies the content as a game, we may be forced into the "Mini Game" category — at which point the UI layer must be rebuilt

**Path ② Build a "Mini Game" on WeChat (cleanest for compliance, highest cost)**
- Must switch to a canvas UI stack: Cocos Creator (TS, complete rich-text and layout capabilities) or LayaAir
- `packages/engine` + `packages/content` are pure TS and **can be imported directly by Cocos with zero changes** — the architecture was not designed in vain
- The UI layer, however, cannot be shared with H5 at all; roughly +80% workload (about +3 weeks)
- Benefits: zero compliance ambiguity, better Mini Game IAA incentive policies, native friends leaderboard

**Path ③ H5 first, decide later (recommended)**
- M1–M5 build H5 only; validate eCPM, retention, and session length with real data
- At M6, decide which WeChat path to invest in based on the data; by then the engine and content are fully stable, and swapping the UI layer is a controlled one-off cost
- Compliance materials (software copyright / ICP filing / entity registration) still start in parallel at M1 as planned and apply to both paths

> Whichever path is chosen in the end, `packages/engine` and `packages/content` remain completely unchanged — **the platform-choice risk is fully isolated in the UI layer**. This is the direct payoff of building a deterministic pure-TS engine in the first place.

---

## 3. Backend (⬆ promoted from phase two to a **launch requirement**)

Since "three-dimension global leaderboards + global rank and percentile on the settlement screen" has been confirmed as a core experience (GDD §10.5), the backend is no longer optional.

**Required capabilities**: rank and percentile queries for all three leaderboards, score submission with **server-side replay verification**, daily challenge seed distribution, cloud saves, analytics.

| Region | Approach |
|---|---|
| Overseas (mobile web) | Cloudflare Workers + D1 (leaderboards use KV/DO for sharded counting) |
| Domestic (WeChat side) | WeChat Cloud Development CloudBase (filing-exempt servers, native login) |

**Anti-cheat design**: the client submits `seed + decision sequence + claimed score`; the server replays it for verification with **the very same `packages/engine`**; any mismatch is discarded outright. Percentiles are approximated via bucketed counting (O(1) queries) — no full-table sorting.

**Schedule impact**: the backend skeleton moves up to **M3**, in parallel with content expansion; M5 completes the three leaderboards and percentiles.

---

## 4. Compliance and Launch Path (WeChat side; start early — longest lead time)

| Item | Notes | Estimated lead time |
|---|---|---|
| Entity registration | An individual entity can run a purely ad-monetized mini game; **a corporate entity is required if IAP is ever added** | 1–3 days |
| Software copyright registration | Required for mini game review submission | Expedited 3–7 days / standard 30+ days |
| Mini program ICP filing | Mandatory since late 2023 | 7–20 business days |
| Game license (banhao) | **Pure IAA (ads only, no virtual payments) requires no game license**; adding IAP would require one | — |
| Online culture operation license | Abolished for the game category; not needed | — |
| Category selection | "Mini Game - Casual / Simulation Management" | — |
| Initial release review | AI-assisted review exists as of 2026; a new game's initial release takes about 1–2 business days | — |

> Conclusion: **start with pure rewarded-video monetization and bypass the game license** — this is the fastest path. Defer IAP until there is real volume (which will then require a corporate entity + game license).
> Recommendation: start software copyright and ICP filing in parallel at M1 (week 3); do not leave them until the end.

References: [WeChat Mini Game ad monetization policy](https://developers.weixin.qq.com/minigame/introduction/commercialization/guide/ad-monetization.html) · [Mini program filing guidelines](https://developers.weixin.qq.com/minigame/product/record/record_guidelines.html)

---

## 5. Milestones (roughly 12–13 weeks, as planned in July 2026)

| Phase | Duration | Deliverables | Acceptance criteria |
|---|---|---|---|
| **M0 Design freeze** | 3 days | Final GDD, first-pass tuning tables, repository scaffolding, CI | The 4 open decisions in this document are settled |
| **M1 Vertical slice** | 2 weeks | Engine skeleton + minimal playable loop: create identity → youth academy → 10 seasons → settlement. Single language, no art | 10 consecutive complete runs without a crash; seeds are replayable |
| **M2 Systems complete** | 2.5 weeks | Per-attribute ratings/PA · 6 relationship tracks · **transfer fee and wage system** · **wage expenditure (training staff / lifestyle / investments / tax rates)** · coach fit · national team · competition structure · 60-event library | All systems connected; a full 20-season career; all three scoring tracks can settle |
| **M3 Content expansion + backend skeleton** | 2.5 weeks | 200+ events · 20 story chains · **dedicated Saudi trap arc** · 500+ clubs (South America removed) · 25 endings · **full EN/zh-CN bilingual coverage** · backend with score verification | Event repetition < 30% across 10 consecutive runs; scores can be submitted and recomputed server-side |
| **M4 Presentation layer** | 1.5 weeks | Production UI/motion · career-card share image (including three-leaderboard ranks) · PWA · light/dark themes | First paint < 1.5 s; share image generated within 3 seconds |
| **M5 Balancing + leaderboards + meta progression** | 2 weeks | Balance-simulator tuning · **three-dimension leaderboards and percentiles** · 100 achievements · daily challenge · legend cards · unlockable starts | Ending distribution matches the target curve (GOAT < 0.5%); mutual exclusivity of the three leaderboard routes verified by simulation |
| **M6 WeChat side + monetization** | 2–4 weeks | WeChat adaptation (workload depends on path ①/②) · ad placement integration · analytics · filing materials finalized | Feature parity across both platforms; ad pipeline working end to end |
| **M7 Beta and launch** | 1 week | Staged rollout testing · data dashboard · launch | Crash rate < 0.5%; D1 retention baseline met |

**Parallel work (starts at M1 — do not wait)**: software copyright application → ICP filing → WeChat mini game entity registration → ad placement application.

---

## 6. Quality Assurance

- **Engine unit tests**: Vitest, covering growth curves, trophy probabilities, event gating, market value conversion
- **Seed snapshot tests**: 50 fixed seeds + fixed decision sequences, snapshotting the entire run's output; when tuning numbers the diff makes the impact obvious at a glance
- **Balance simulator**: `pnpm balance --runs=100000`, outputting
  - Peak OVR distribution (targets: median 76, >90 share ~4%, 99 share < 0.05%)
  - Ending title distribution (targets: GOAT < 0.5%, top-tier endings combined < 8%)
  - Honours / injury / retirement-age distributions
  - Event occurrence frequency (to find dead content that "never triggers")
  - **Three-leaderboard exclusivity verification**: pairwise correlation coefficients between legacy score / cumulative wages / cumulative transfer fees must be significantly below 0.6; otherwise one route "sweeps all three boards" and the weights need retuning
  - **Saudi route payoff curve**: three-leaderboard results grouped by joining age, confirming that joining at age ≤26 really is a losing strategy for legacy score
- **Content lint**: verifies every i18n key exists in both languages, event conditions are satisfiable, and club data is complete
- **Performance budget**: web first-paint JS < 200 KB gzip; content packs are chunked and loaded on demand

---

## 7. Data and Analytics (needed at launch)

Funnel: entry → identity-creation completion rate → season-5 retention → career completion rate → share rate → second-run rate
Key metrics: session length, decision dwell time, per-event option distribution (for balancing), rewarded-video view and completion rates, eCPM

**Status, 2026-09-17: the funnel is built, the key metrics are not.** This
section named the funnel in the first week of the project and nothing recorded
any of it for four months, so every judgement about players was made blind.
What exists now is `apps/web/src/lib/telemetry.ts` writing through
`public.bg_event` (`packages/backend/sql/001-leaderboard-and-funnel.sql`), and
it is deliberately the smallest thing that answers the question:

- Seven counters and a crash count: `visit`, `career_started`, `identity_done`,
  `season_5`, `career_finished`, `replay`, `share`, `error`. Those are the funnel
  steps above, in order — "second-run rate" is `replay ÷ career_finished`.
- **One integer per name per day, for the whole site.** No visitor id, no
  session, no cookie, no address, no user agent, no path, nothing about the
  career. A row can say how many careers finished on the 14th and can never say
  whose, which is what keeps it outside consent and outside the reach of a
  breach. Every ratio in the funnel is a division of two of those integers.

**How to read them, because one pair is not what it looks like.** `visit` is
counted **per page load**; the other six are counted **per career**. So a player
who opens the game once and plays three careers contributes one `visit` and
three `identity_done`, and `identity_done ÷ visit` can exceed 1 — as it did on
the first day this shipped, at 11 against 10. That ratio is careers-per-session,
not an identity-creation completion rate, and the section above asked for the
latter.

`career_started` is what makes the top of the funnel readable. It is counted at
the intro→identity transition, so every ratio below now has a per-career
denominator on both sides:

| Question | Ratio |
|---|---|
| Identity-creation completion rate | `identity_done ÷ career_started` |
| How many who start a career finish one | `career_finished ÷ identity_done` |
| Retention to season five | `season_5 ÷ identity_done` |
| Second-run rate | `replay ÷ career_finished` |
| Share rate | `share ÷ career_finished` |

The first row is the one this section asked for in week one and could not have
until 2026-09-18: the only denominator on offer was a page load. One extra
counter bought it, where the obvious answer — a session id — would have bought a
consent banner, a retention policy and a subject-access answer with it.
- Only from the site and the itch.io iframe (`REAL_HOSTS` in
  `apps/web/src/lib/supabase.ts`), and never when the browser sends Global
  Privacy Control or Do Not Track.

The "key metrics" line is the part still missing, and most of it cannot be had
this cheaply: session length and dwell time need per-session timing, and option
distribution needs the option id, which is a step up in both plumbing and
privacy exposure. Rewarded-video view and completion rates come from the
AdSense reports rather than from here. None of that is worth building until the
funnel above has said whether anybody is finishing a career at all.

---

## 8. Key Risks

| Risk | Mitigation |
|---|---|
| Trademark/likeness rights (**real club names are in use by choice**) | Text names only — no crests / trademark graphics / official kits; real players never appear; `displayName` is designed to be wholly replaceable, keeping a one-click fallback to "real city + fictional club name" (GDD §9) |
| Picking the wrong WeChat runtime (mini program ≠ mini game) | Identified — see §2.1; recommendation is to build H5 first and decide at M6; engine and content migrate with zero changes |
| The three scoring tracks "sweeping" one another, making leaderboards meaningless | Balance simulator enforces acceptance: pairwise correlation coefficients < 0.6 |
| Filing/software copyright blocking the schedule | Started at M1; does not block development |
| The numbers aren't fun (too random / GOAT too easy) | Balance simulator + staged-rollout A/B |
| Insufficient content volume causing repetitiveness | Metric-based acceptance for the event library (repetition rate < 30%); content decoupled from code enables continuous updates |
| Taro H5 first paint too heavy | Code splitting + content chunking + skeleton screens; fall back to plan B on the web side if necessary |
| Ad revenue below expectations | Validate eCPM with web AdSense data first, then decide the pacing of mini-program investment |
