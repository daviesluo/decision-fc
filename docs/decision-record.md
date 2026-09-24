# Decision Record

> **These are the decisions taken while planning in July 2026, before the game
> was built, kept as a record.** What shipped differs. The app is Vite and React, not Taro, and
> there is no WeChat build yet. The leaderboard runs on Supabase. A career
> takes about four, six or eleven minutes. The game uses real club crests and
> real players' names (see `docs/crests.md` and `LICENSE`). What the game
> is now is in [design.md](design.md).

---

## ✅ Decided

### Q1 · Tech stack → **Taro 4 + React + TypeScript**
Confirmed for the H5 side. ⚠️ However, the premise that "a single codebase ships both H5 and WeChat Mini Game" is **technically unsound** — see Q5 below.

### Q2 · Club naming and copyright strategy → **Use real club names**
Immersion comes first. The enforcement boundaries and residual risks are recorded in GDD §9: use **text names only** — no crests, trademark graphics, or official kit patterns; real player names and likenesses are never used; the club table is designed with a wholly replaceable `displayName`, preserving the ability to fall back with one click to "real city + original club name".

### Q3 · Per-run depth → **Three tiers coexist**
Blitz 2.5 min (default entry point) / Standard 5 min (core mode) / Immersive 15 min (hardcore retention).

### Q4 · M2 priorities → **All selected + additions**
- ✅ Individual attributes + hidden potential (PA)
- ✅ Coach style × tactical fit
- ✅ 6 relationship tracks
- ✅ Multi-act narrative chains + key moments
- ➕ **Transfer-fee and wage system** (GDD §6.1 / §6.2)
- ➕ **Design for how wages are spent** (GDD §6.3: training team / lifestyle / family / image management / investments / retirement savings)
- ➕ **Tax-rate system** (GDD §6.4; Saudi Arabia's 0% is a core hook)

### Added requirement · Club selection → **Drop South America, add Saudi Arabia**
- The club pool **contains no South American clubs** (recognition is too low; players cannot form meaningful judgments); **national teams remain global** (the World Cup narrative needs Argentina/Brazil)
- The **Saudi trap** as a dedicated design: high wages + 0% tax + easy AFC Champions League access vs growth ×0.85, Ballon d'Or weighting ×0.25, national-team call-up threshold +4 OVR. The age at which you join determines whether it is "rational cashing-out" or "selling your future" (GDD §4.3)

### Added requirement · Three-dimensional global leaderboards
Legend board (legacy score) / Wealth board (cumulative pre-tax wages) / Value board (cumulative transfer fees). The end-of-career screen shows **global rank + top X%**, and this feeds into the share card (GDD §10.5).
→ **Schedule impact**: the backend is promoted from phase two to a launch requirement, with the skeleton pulled forward to M3.

---

## ⬜ Pending

### Q5 · On WeChat, build a "Mini Program" or a "Mini Game"?

The original plan had a genuine error: **Taro's `weapp` build output is a "Mini Program", while WeChat "Mini Games" run on a completely different Canvas runtime (`game.js`, no DOM)**. The two are incompatible, so the original plan of "one codebase shipping both targets" does not hold.

| | Path ① Mini Program | Path ② Mini Game | **Path ③ H5 first, decide later (recommended)** |
|---|---|---|---|
| UI reuse | ~85% (straight out of Taro) | 0% (must switch to Cocos Creator / LayaAir) | No investment for now |
| Extra schedule | ~0 | **+3 weeks** | 0 (decision deferred to M6) |
| Compliance | ⚠️ App review may demand reclassification into the Mini Game category, forcing a UI rebuild then | ✅ Zero dispute | Materials still prepared in parallel as planned; shared by both paths |
| Monetisation | "Traffic Master" ad programme (unlocks at UV ≥ 1000) | Same ad placements + **Mini Game-exclusive IAA user-acquisition incentives and ad credits** | — |
| Leaderboards | Must build our own backend (we are building one anyway) | Own backend + native friends leaderboard | — |

**Recommended: Path ③**: focus M1–M5 on H5, and use real eCPM / retention / session-length data to decide which path to invest in on the WeChat side. By then the engine and content will be frozen, and swapping the UI layer is a controllable one-off cost. Compliance materials (software copyright registration → ICP filing → entity registration) still start in parallel at M1 as originally planned.

**Key point**: `packages/engine` and `packages/content` are pure TS with zero platform dependencies; Cocos can import them directly. **Whichever path is chosen, the core assets never need rewriting** — this is exactly the deterministic-engine architecture paying off.

**Decision:** ⬜

---

## Other assumptions

1. **Monetisation path**: phase one is pure IAA (rewarded video + interstitial + banner), sidestepping the game-licence requirement; IAP to be evaluated once there is volume (at which point an enterprise entity + game licence are needed)
2. **Languages**: launch with Simplified Chinese + English; reserve es/pt
3. **Name**: **Decision FC** / 《足球生涯》, after the domain decisionfc.com. Earlier working titles Football Career and Boot & Glory / 《绿茵人生》 retired.
4. **Compliance**: software copyright registration → ICP filing → WeChat entity registration all start in parallel at M1
