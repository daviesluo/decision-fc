# Game Design Document (GDD v0.1 · **superseded in part — read this first**)

> **This document is the design as it was imagined, not the game as it was
> built.** It is kept because the pillars, the tuning philosophy and the UI
> rules in it are still the reasoning behind the game, and because a design
> document that is quietly edited to match whatever shipped stops being a
> record of anything.
>
> But it promises things that do not exist, and it promised some of them for
> four months while reading like a description of the product. The September
> review (`docs/project-review-2026-09.md`) found that the first document a new
> reader opens was the least true one in the repository.
>
> **For what the game actually is, read `docs/design.md`.** It is
> written from the shipped code and is kept true in the same commit as every
> change.
>
> What in here is not the game, as of 2026-09-17:
>
> - **§10 meta progression is not built, and is not being built.** No
>   achievement wall, no legend cards, no weekly scenarios, no unlockable
>   starts, and no career archive — a cut-down one was built in September 2026
>   and removed on 2026-09-23. The daily challenge exists
>   and has had its leaderboard since 2026-09-17. See the note in that
>   section.
> - **§11's ad table is six placements wide and the game has one.** The only
>   ad is a rewarded video on "play again", and the interstitial and banner in
>   that table are things the game deliberately does not do. See the note there.
> - **§10.5's three boards exist**, and a fourth the GDD never asked for: the
>   daily challenge ranks a career against the others played on its seed.
> - Relationships, traits and a 120-event library are described at various
>   points; the deck is 48 cards, and the systems that shipped instead are in
>   `docs/design.md`.

**Working title**: 《绿茵人生》 (*Lüyin Rensheng*, "A Life on the Pitch") / *Boot & Glory* (alternatives: 《九十分钟人生》 (*Jiushi Fenzhong Rensheng*, "A Ninety-Minute Life") / *One Career*, 《从青训到传奇》 (*Cong Qingxun Dao Chuanqi*, "From Academy to Legend") / *Academy to Legend*)

**One-liner**: Live a footballer's entire 20-year career in 5 minutes on your phone — and every choice comes back for you ten years later.

**Platforms**: mobile web (PWA) + WeChat mini-game · **Languages**: Simplified Chinese / English · **Monetisation**: IAA, primarily rewarded video

---

## 1. Design pillars (every trade-off defers to these)

1. **Every run has a beginning and an end** — 5 minutes by default, 2.5 minutes in fast mode, 15 in deep mode. Never build "save it and come back tomorrow" idle progression.
2. **Randomness is public; fate is your own choice** — every option displays its odds and consequences up front. Players may lose, but they must never feel cheated.
3. **Choices have long tails** — the contract you refused at 19 becomes a story chain at 27.
4. **The numbers must be braggable** — the Legacy Score, ending titles, and career-card poster exist to be posted to WeChat Moments / X.
5. **Ads only sell "one more try", never "get stronger"** — nothing that touches the leaderboards may ever be purchasable with ads.

---

## 2. Core loop

```
                    ┌───────────────────────── One season ─────────────────────────┐
Create identity → Academy choices → │ Pre-season decisions → Autumn-window events → Key Moments → Spring-window events → Season report │ → Summer window (transfers/renewals/national team)
                    └──────────────────────────────────────────────────────────────┘
                                        ×  16–22 seasons
                                              ↓
                    Retirement → 3-act epilogue → Ending title + Legacy Score + Career Card
```

**Pace tiers**:

| Tier | Decisions per season | Run length | Positioning |
|---|---|---|---|
| Blitz | 1 card every 3 seasons | ~2.5 min | Viral entry point; default on first launch |
| Standard | 1–2 cards per season | ~5 min | The core mode |
| Deep | 3–4 cards per season + Key Moments + training focus | ~15 min | For the hardcore; unlocked later |

---

## 3. Character stat model

### 3.1 Visible attributes (0–99, six of them)

| Outfield players | Goalkeepers |
|---|---|
| Pace | Reflexes |
| Shooting | Handling |
| Passing | Positioning |
| Dribbling | Distribution |
| Defending | Command |
| Physical | Physical |

**OVR = position-weighted sum** (e.g. ST = Shooting .30 + Pace .22 + Dribbling .18 + Physical .16 + Passing .10 + Defending .04; CB = Defending .34 + Physical .26 + Pace .16 + Passing .14 + Dribbling .06 + Shooting .04).

> This gives "position change" events a real cost rather than a flat −2 OVR. After the weights are recalculated you might suddenly drop from 82 to 74, or actually rise because the fit is better.

### 3.2 Hidden attributes (players never see exact values; they can only infer them from performance)

- **Potential (PA)** (an internal dual track: current ability and potential ability): sets the OVR ceiling. Scout reports narrow the displayed range as the player ages ("★★★☆–★★★★★" → the exact ceiling is shown after age 24)
- **Determination**: growth speed and success rate in adversity events
- **BigMatch**: probability modifier for Key Moments in finals/penalty shoot-outs/derbies
- **Consistency**: season-to-season performance variance (low Consistency = wild swings in output, but breakout seasons run even hotter)
- **Injury Proneness**: injury trigger rate and recovery speed

### 3.3 Growth model

```
Annual growth = base age curve(age)
        × playing-time factor(role: star 1.25 / starter 1.0 / rotation 0.65 / sub 0.3 / frozen 0.05)
        × training-focus bonus(chosen attribute ×1.6, all others ×0.85)
        × coaching quality(0.8 ~ 1.3)
        × determination factor(0.8 ~ 1.25)
        × (1 - CA/PA)^0.6        ← the closer to potential, the harder it is to grow
        × injury penalty
        + seeded noise
```
Age curve: steep growth 16–21 → steady growth 22–26 → peak plateau 27–30 → gentle decline 31–33 → rapid decline 34+ (Physical/Pace fall fastest; Passing/Positioning barely fall at all — **decline is per-attribute**).

### 3.4 Personalities (12 types; random at start, can shift through events)

Model Professional / Perfectionist / Resolute / Rebellious Genius / Dressing-Room Leader / Lone Wolf / Fragile Ego / Party Animal / Loyalist / Mercenary / Reserved / Media Darling

Effects: growth factor, event-pool weighting, rate of relationship change, unlockable traits.

### 3.5 Traits (30+; can be unlocked / can be lost)

Free-Kick Maestro · Penalty Killer · Big-Game Player · Dressing-Room Leader · Made of Glass · Faded Prodigy · Derby King · Iron Man · Chronically Late · Slow Starter · Weak-Foot Monster · Aerial Dominator · Set-Piece Header Threat · Full-Pitch Orchestrator · Offside-Trap Breaker · Dressing-Room Poison · Loyalty Icon · Transfer-Rumour Regular …

Every trait carries real numeric modifiers, and each is **material for the ending evaluation and the share card**.

---

## 4. World model

### 4.1 Clubs

Fields: `reputation (0-100)` `wealth` `league/tier (tier1-5)` `academy quality` `head-coach style` `preferred formation` `dressing-room atmosphere` `fan expectations` `city/country` `kit colours`

**Head-coach styles** (six): high press / possession / counter-attack / deep defence / wing play and crossing / free to roam — named in plain words on screen (I struck "Gegenpress" as jargon on 2026-09-23)
→ Each style has an **attribute-preference vector for every position**. How well your attributes fit the style directly determines your playing time and statistical output.
> So "join the more prestigious club" is no longer the brainless optimum — move to a big club that doesn't suit you and you may rot on the bench. **This is our single most important source of strategic depth.**

### 4.2 Leagues and competition system

**Selection principle: recognisability first.** A player must be able to tell a club's level instantly from its name. The club pool therefore **contains no South American clubs** (recognition in the Chinese and English-speaking markets is too low to support informed choices), but **national teams stay global** — Argentina/Brazil are irreplaceable in World Cup storytelling.

| Tier | Leagues | Strength coefficient |
|---|---|---|
| **T1** | Premier League, La Liga, Serie A, Bundesliga, Ligue 1 | 1.00 / 0.97 / 0.94 / 0.94 / 0.86 |
| **T2** | Primeira Liga, Eredivisie, Süper Lig, Belgian Pro League, Scottish Premiership, Russian Premier League | 0.62 – 0.72 |
| **T3** | **Saudi Pro League**, Chinese Super League, J1 League, K League, MLS, A-League | 0.40 – 0.58 |
| **T4** | Championship, Segunda División, 2. Bundesliga, Serie B, Ligue 2, China League One, J2 League | 0.30 – 0.45 |
| **T5** | League One/League Two, China League Two and below | 0.15 – 0.28 |

- Within each league, clubs are further split into 5 reputation bands, with promotion and relegation
- Continental: Champions League / Europa League / Conference League, AFC Champions League Elite / AFC Champions League Two, CONCACAF Champions Cup, Club World Cup
- National teams: U20 → U23/Olympics → senior side; continental cups (4-year cycle), World Cup (2026/2030/2034… on a real-year axis)
- **League strength coefficients run through everything**: 30 goals in China League One ≠ 20 goals in the Premier League — they directly affect market value, transfer fees, national-team call-up thresholds, and Ballon d'Or voting weight

### 4.3 ⚡ The Saudi Trap (dedicated design)

The Saudi league is this game's **single most important strategic decision**, because it is the first place where "money" and "legend" stand in direct opposition:

**Upside**
- A **3–5×** wage premium plus an enormous signing bonus
- **0% personal income tax** (vs 45% in the Premier League / 47% in La Liga) → the after-tax income gap stretches further, to 6–8×
- Top-tier club wealth → high transfer fees, directly pumping the Total Transfer Fees board
- High odds of winning the AFC Champions League (next to the UCL it is practically a free trophy)

**Downside**
- Growth factor **×0.85** (weaker opponents, lower training intensity, less competitive fire)
- League strength coefficient of only ~0.5 → goals and assists are heavily discounted for market value and awards
- **Ballon d'Or voting weight ×0.25** — effectively waving goodbye to the game's highest individual honour
- National-team call-up threshold **+4 OVR** ("you've left the mainstream spotlight")
- Reduced media exposure → shrinking endorsement offers
- The only continental honour available is the ACL, with a low Legacy Score weight

**Age decides whether this is a retirement plan or self-destruction**
| Age at signing | Framing | Typical endings |
|---|---|---|
| ≤ 26 | Selling your future | "Fallen Prodigy", "Petro-Discard" |
| 27–30 | The dangerous middle ground; depends on the achievements already banked | "Uncrowned King", "Petrodollar Passer-By" |
| ≥ 31 | Rational cashing-out; chase the wealth board and the ACL | "Oil Tycoon", "Last Dance in the East" |

**Dedicated story chain**: a Saudi offer arrives → three-way choice (① stay in Europe ② accept ③ **use the offer to strong-arm your current club into a raise** — succeed and your wages double without moving; fail and the dressing room freezes you out while your coach relationship craters). This chain turns "money" into a resource you can wield as a weapon, not just a number.

### 4.3 Honours and awards

League · Domestic cup · Continental cup · Secondary continental cup · Club World Cup · Continental (international) cup · World Cup
Ballon d'Or · Golden Boot · Golden Glove · Best Newcomer · League MVP · Team of the Season · Man of the Match · World Cup Golden Ball

---

## 5. Relationship system

Six relationship tracks (0–100); each gates its own event pool and directly modifies the numbers:

| Relationship | Benefits when high | Consequences when low |
|---|---|---|
| Head coach | Role upgrades, positional protection | Frozen out, transfer-listed |
| Dressing room | Teammates look for you more (assists ↑), leader-trait unlocks | Infighting events, Dressing-Room Poison |
| Fans | Home-ground boost, Loyalty Icon, a statue after retirement | Boos (temporary OVR−), forced transfer |
| Media | Ballon d'Or voting bonus, endorsement offers ↑ | Smear-story chains, suppressed match ratings |
| Agent | More offers, better contract terms | Exploitative contracts, agent-absconds storyline |
| Family | Mental stability, protection in adversity | "Come home" pressure events, divorce storyline (net worth −50%) |

---

## 6. Transfer fees, wages, and finances (scoring lines two and three)

> This game has **three parallel scoring lines**: honours (Legacy Score), **career earnings**, and **total transfer fees**. All three feed global leaderboards (see §10.5).
> Design intent: make "was my career great?" and "did my career pay?" two goals that can be pursued separately — or sacrificed for one another.

### 6.1 Transfer fee system

```
Transfer fee = market value
       × contract-years-remaining factor (1 yr left ×0.45 / 2 yrs ×0.75 / 3 yrs ×1.0 / 4+ yrs ×1.25)
       × buyer wealth factor (0.8 ~ 1.6)
       × seller stance factor (fire sale 0.7 / normal 1.0 / not for sale 1.8)
       × age premium (age 22 ×1.3 / age 27 ×1.0 / age 32 ×0.5)
       × agent relationship modifier (0.9 ~ 1.15)
       ↑ if a release clause is triggered, the clause amount applies directly
```

**Real strategies that fall out of this**:
- **Free transfer** (run the contract down): fee = 0, but the signing bonus and wages jump → the optimal play for the Career Earnings board, and suicide for the Total Transfer Fees board
- **Proactive renewal**: raises the years-remaining factor → a higher fee on the next move → feeds the Total Transfer Fees board
- **Low release clause**: at signing you can "trade a lower release clause for higher wages" → giants can buy you more easily, but you have surrendered pricing power
- **Loan (with option to buy)**: a low-risk way to farm playing time, but that year's transfer-fee income is 0

### 6.2 Contract terms

Weekly wage · length · signing bonus · appearance bonus · goal/assist bonuses · title bonus · loyalty bonus · release clause · image-rights share

Negotiation is a **four-way tug-of-war**: wage ↔ length ↔ release clause ↔ guaranteed playing time. Want top wages? Accept a weak playing-time guarantee. Want guaranteed minutes? Take a pay cut. Your agent relationship determines how many of these you can win at once.

### 6.3 💰 What wages can buy (this is where "money" becomes "gameplay")

> If money is just a number on the results screen, it isn't gameplay. Every unit of income must have **somewhere to go that changes the numbers**, and those destinations must compete for the same budget.

| Spending direction | Effect | Cost |
|---|---|---|
| **Training team** (personal coach / nutritionist / physio / sports scientist / psychologist) | Growth factor up to **+30%**, injury rate **−40%**, slow gains to mental attributes | Renewed yearly; a fully staffed team eats roughly 25% of your weekly wage |
| **Lifestyle** (mansion / sports cars / private jet / nightclubs) | Media relationship +, endorsement offers +, exposure + | Professionalism − (growth factor ↓), dressing-room relationship − ("playing the big shot"), triggers negative events |
| **Family** (buy your family a home / marriage / children) | Maxes the family relationship → permanently blocks "come home" pressure events, shields mental attributes in adversity | Large one-off outlays; **the divorce story chain deducts 50% of net worth** |
| **Image management** (PR team / charity foundation / social-media operation) | PR: suppresses smear events; charity: fan relationship + and the Humanitarian trait; social media: exposure → endorsements | Ongoing spend; overdone charity gets mocked by the media as a publicity stunt |
| **Investments** (restaurant / esports team / farm / crypto) | On success, net worth compounds and the post-retirement Business Empire ending unlocks | Can blow up (crypto most of all); a blow-up triggers the **bankruptcy story chain** |
| **Retirement reserve** | Net worth directly determines the option pool for the 3-act epilogue: buy your hometown club / open a youth academy / become a pundit / end up broke | — |

### 6.4 Tax rates (turning "where do I play" into a financial decision)

Premier League 45% · La Liga 47% · Serie A 43% (relief for new arrivals) · Bundesliga 45% · Ligue 1 45% · Chinese Super League 45% · J1 League 45% · MLS 37% · **Saudi 0%** · UAE 0%

→ After-tax and pre-tax career earnings are **tracked separately**. Leaderboards use pre-tax (fair); the results screen shows both (honest).

### 6.5 Endorsements

Boots (four tiers by OVR + exposure) · energy drinks · esports/gaming · cars · fashion · airlines · home-country national brands (nationality-linked; Chinese players get a dedicated line)

Offer = f(OVR, exposure, media relationship, league strength, national-team standing). A scandal gets endorsements **terminated, with damages payable**.

---

## 7. The match layer: Key Moments

1–3 per season (more in Deep), occurring in finals/derbies/relegation deciders/national-team knockout ties:

| Type | Judged on |
|---|---|
| Cup-final penalty (taker / goalkeeper perspectives) | BigMatch + Shooting / Reflexes |
| Free kick from outside the box | Shooting + Free-Kick Maestro trait |
| One-on-one with the keeper | Shooting + composure |
| Last-minute clearance | Defending + Positioning |
| Stoppage-time counter-attack carry | Pace + Dribbling |
| Half-time dressing-room speech | Leadership + dressing-room relationship |
| Post-match mixed zone (facing a provocative question) | Personality + media relationship |

**Success odds are displayed openly**, spelled out in full: "your Shooting 84 + BigMatch → 78%". Outcomes go straight onto the career highlights timeline and into the share card.

---

## 8. Event system architecture

Events are not a flat weighted pool. Instead:

```ts
Event {
  id, chapter?          // chapter = story-chain ID, for multi-act events
  conditions: {          // prerequisite gates
    ageRange, roleIn, clubTierIn, relationBelow/Above,
    personalityIn, traitHas/NotHas, hasTrophy, seasonForm,
    nationalityConfederation, contractYearsLeft, netWorthAbove, ...
  }
  weight, cooldown, oncePerCareer
  options: [{ label, shownOdds, effects, unlocksChapterStep, relationDeltas }]
}
```

**Content-volume targets**:
- 120+ generic events
- 20 story chains (3–5 acts each): diving scandal → trial by media → comeback redemption; academy best friend → becomes a rival → reunion in a final; agent scam → lawsuit → bankruptcy/turnaround; and so on
- 30+ position-specific events (goalkeepers, full-backs, and No. 9s each get exclusive content)
- 30+ country/culture-specific events (the Chinese player's move-abroad narrative, South Americans seeking their fortune in Europe, African age-fraud gates…)
- 25+ endings

---

## 9. Naming and copyright strategy ✅ Decided

**Use real club names**. Rationale: immersion is this game's core asset — the sentence "I fought my way from China League One to Man City" has to be possible.

**Enforcement boundaries (to control risk without hurting the experience)**:
- ✅ Use club **names and home cities** (plain-text information only)
- ❌ **No** crests, registered trademark graphics, or official kit patterns → kit colours are self-drawn as **abstract colour bands / geometric shapes**
- ❌ **No real player names or likenesses whatsoever.** Legend gacha cards and teammates/opponents are all original archetypes ("The German Sweeper", "The Balkan Metronome", "The British No. 9")
- ❌ No official league logos or registered abbreviated marks (use phrasing like "England's top flight" or plain-text league names)
- ⚠️ App-store/mini-program listings carry the note "This is a work of fictional simulation, unaffiliated with any real club, league, or player"

**Known residual risk** (on record; I am aware of it and have chosen to accept it): club names themselves remain registered trademarks, so a rights-holder claim is theoretically possible; WeChat review **may** demand proof of authorisation. If rejected, the fallback is to switch club names to "real city + invented name" — which is why **the club data table must be structured so that `displayName` is wholly replaceable**, keeping the fallback cost to a single content-pack change.

---

## 10. Meta progression and retention

> **Status, 2026-09-17: two of these six exist and the other four are not being
> built.** The September review asked for a decision either way rather than a
> section that reads like a roadmap and has been static for four months, and
> my answer was that the round in progress was for repairs, not
> additions. So this is a declined list, not a queue — anyone picking an item
> off it needs my word first.
>
> - **Daily challenge — built**, and since 2026-09-17 it has the leaderboard
>   this line promised. `apps/web/src/lib/daily.ts`.
> - **Career archive — built, then removed.** A cut-down version (the last
>   twenty careers as summaries on the device, with personal bests) shipped on
>   2026-09-17 and was removed on 2026-09-23. Not planned
>   again without my word.
> - **Achievement wall, legend cards, weekly scenarios, unlockable starts —
>   not built, not planned.** Each is a system rather than a feature, each
>   needs its own content, and the game's problem in September 2026 was not a
>   shortage of things to unlock. It was that chasing the biggest badge beat
>   reading a squad role, which is fixed in the engine rather than here.

- **Achievement wall, 100+** (including hidden achievements)
- **Legend card collection**: completing specific careers unlocks original legend cards, usable for a "draft start" in a new run
- **Daily challenge**: one global seed + one starting identity + a leaderboard (resets at 00:00 UTC)
- **Weekly scenarios**: limited-time starts with an explicit goal ("fight from China's lower leagues to a Champions League final")
- **Unlockable starts**: only the standard start at first; later unlock Wonderkid / Late Bloomer / Naturalised Player / Goalkeeper Specialist / Weak-Foot Genius, and more
- **Career archive**: past careers are saved, comparable, and replayable (seed replay)

## 10.5 🏆 Global leaderboards (three dimensions)

**At the end of every run, show this player's three global ranks and percentiles.** This is the core retention-and-sharing device — a screenshot reading "global top 3% Legacy Score" travels further than any stats page.

| Board | Metric | Design intent |
|---|---|---|
| **Legacy board** | Legacy Score | Pure sporting merit: honours + stats + peak + awards |
| **Wealth board** | Career Earnings (cumulative pre-tax wages) | Rewards the completely different route of "Saudi moves / long contracts / high wages at weak clubs" |
| **Valuation board** | Total Transfer Fees | Rewards a third route: "frequent big-money moves / staying on long contracts to inflate the price" |

> The three boards conflict by design: free transfers feed the wealth board but wreck the valuation board; a one-club lifetime earns legacy but leaves both money boards at the bottom. **No single route can sweep all three** — and that is the replay motivation.

**Results-screen presentation**:
```
🏆 Legacy board     global #12,847   top 3.2%
💰 Wealth board     global #431      top 0.1%   ← your Saudi decade
📈 Valuation board  global #96,220   top 41%
```
Add per-board bracket titles (e.g. top 0.1% on the wealth board = "Oil Tycoon"), which go straight onto the share card.

**Technical requirement (important)**: the leaderboards **promote the backend from phase two to a launch requirement**. A submission consists of `seed + decision sequence`; the server re-runs the identical engine to verify the score, ruling out tampering — this is exactly where the deterministic engine architecture pays off. Board views: all-time / this week / friends / by nationality. Runs that used rewarded video go onto a separate "assisted board".

---

## 11. Endings and the Legacy Score

```
Legacy Score = Σ honours points (weighted by difficulty: World Cup > continental cup > league > domestic cup, multiplied by league strength)
             + stats points (goals/assists/appearances, normalised by position)
             + peak points (career-high OVR, consecutive years at peak)
             + individual-award points (Ballon d'Or ×N carries the highest weight)
             + legend points (loyalty / one-club legend / adversity comebacks / Key Moment success rate)
             + wealth points (low weight, displayed separately)
             - stain points (bans / scandals / dressing-room poison)
```

**25+ ending titles** (examples):
Sunday-League Legend · CSL Workhorse · Bench Philosopher · Glass Genius · Loyalty Icon · Soul of One Club · Championship Puzzle Piece · The Broker's Favourite · Late Bloomer · Light of Asia · Uncrowned King · Mr Ballon d'Or · Galáctico Core · **The GOAT** · Fallen Prodigy · Banned in Disgrace · Bankrupt Star · Dressing-Room Poison · Immortal in One Match …

**Career Card (share image)**: player card (attribute hexagon) + peak OVR + honours wall + Key Moment timeline + ending title + **three-board global ranks and percentiles** + career earnings / total transfer fees + QR code/short link. This is the entire project's viral engine, and it gets the highest UI priority.

---

## 12. Monetisation design (IAA · rewarded video first)

| Placement | Format | Frequency | Fairness |
|---|---|---|---|
| Before career results | Interstitial | 1 per run | — |
| Main menu / results screen | Banner | Persistent | — |
| "Retry a Key Moment" | Rewarded video | 1 per run | Disabled in daily challenge |
| "Specialist treatment" halves an injury's impact | Rewarded video | 1 per run | Disabled in daily challenge |
| "One more offer" — an extra transfer-window option | Rewarded video | 1 per run | Disabled in daily challenge |
| "In-depth season report" unlocks the full stats page | Rewarded video | Unlimited | Pure information, no advantage |
| "One more season" extends a forced retirement | Rewarded video | 1 per run | Disabled in daily challenge |
| Daily check-in | Rewarded video | 1 per day | Exchanged for legacy points (unlocks cosmetics/legend cards) |

**Red line**: leaderboard and daily-challenge scores must come from "no-reward runs"; if rewarded ads were used, the score goes onto the separate "assisted board".

> **Status, 2026-09-17: the game has one of these placements, and the red line
> is moot because of it.**
>
> The only ad is a **rewarded video on "play again"** — the first replay each
> day is free, then 5/10/15/20/30 seconds, skippable at halfway, and the reward
> is granted even if the network fails. Nothing interrupts a career, and the
> interstitial and the persistent banner in the table above are things this
> game deliberately does not do: `apps/web/src/lib/ads.ts` has the reasoning,
> and it is the opposite of the first two rows here.
>
> Because no reward touches a career in progress, there is nothing for an
> "assisted board" to separate. If a slot is ever added that *does* change a
> run, the red line comes back with it — and it also has to survive the
> anti-cheat, which replays `seed + identity + decisions` and would reject a
> career that was helped unless the help is itself in the decision list.
>
> **A second slot is deliberately on hold.** The review proposed one; the
> answer is to wait until R-01 and the funnel have produced an actual revenue
> number to reason from, and then take at most one — the daily check-in, which
> is the only row above that cannot touch a career in progress.
> `docs/monetisation.md` carries this.

---

## 13. Bilingual and localisation

- All copy lives in JSON content packs (`content/i18n/{en,zh-CN}/*.json`), with ICU variables/plurals
- The Chinese is **localised writing, not translation**: commentator's cadence, sports-media voice ("What a thunderbolt into the top corner!"), plus China-exclusive narrative lines about playing abroad, naturalisation, and the academy system
- Number formats, currency (switchable € / ¥), dates, and name order are all handled per locale
- pt/es reserved

---

## 14. Primary UX principles (mobile)

- One-handed play: decision cards in the lower half of the screen, large tap targets, swipe left/right to choose
- Zero perceived loading: first screen < 1.5s, data split into lazy-loaded packs
- Every screen answers exactly one question
- Screenshot-friendly results screen (fixed 9:16 safe area)
- Interrupt-and-resume support (local save + schema version migration)
- Dark/light dual themes
