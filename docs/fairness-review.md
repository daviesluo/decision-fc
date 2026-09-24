# Is the game fair?

A deliberate audit of every way this game could be unfair to a player, asked as
questions with measurable answers rather than as a code read. Three of the
answers were good. One was not, and it was the one that mattered most.

Two later rounds (§3b–§3d) added the two questions that catch the faults a code
read never does: *does choosing an option do what the option said*, and *was the
player given a choice at all*. Both are asked of every option of every card
across hundreds of played careers, because both bugs they found were properties
of whole careers rather than of any one card.

Everything here is reproducible: `pnpm fairness`, and `pnpm fairness --assert`
fails the build if any of it slips back.

---

## 1. Are the printed odds the real odds?

**Yes.** This is the load-bearing promise of the whole game — every gamble
states a percentage and asks the player to bet on it — so it was measured end to
end rather than read out of the resolver: 2,500 careers, recording what each
card said and what the engine then did.

| option | printed | actual | n | drift |
|---|---|---|---|---|
| `january_window_itch:fight_for_it` | 45% | 51.4% | 144 | +6.4 |
| `captain_armband:take_it` | 60% | 64.4% | 87 | +4.4 |
| `position_competition:compete` | 50% | 46.1% | 380 | −3.9 |
| … 36 gambles with 80 or more plays | | | | |

Every one inside four standard errors of its printed number (four, because 36
are tested at once), and pooled over all 41 the rolls land 0.2 points above the
printed odds (z = 0.68). The card and the engine take the same value from the
same place: the panel prints
`Math.round(odds × 100)` and the resolver rolls `chance(rng, odds)`.

**The rolls the mercy rule forces are not in that tally** (since 2026-09-23).
Three red gambles in a row force the fourth green, so 2.7% of gambles — 646 of
23,506 in this sweep — were never rolled at the printed odds, and counting them
lifted every card's "actual" by about a point. Card by card that hid inside the
band; pooled over every gamble it was 1.3 points and z = 4.1. So the forced rolls
are left out, the deck is checked pooled as well as card by card (it fails
beyond 3σ; the ordinary rolls read +0.2 points, z = 0.68), and a career that
sees four red gambles in a row fails the build.

## 2. Is the randomness independent?

**Yes.** Randomness is channel-addressed — `rngFor(seed, channel)` — so a new
draw added anywhere cannot shift results elsewhere. All 31 channels were
enumerated and checked for collisions.

There is exactly one place two call sites share a channel, and it is deliberate:
a key-moment card pre-simulates the season's trophies on
`season:N:trophies`, the same channel `playSeason` will use, so what the card
puts on the line is what the club would genuinely have won. A separate channel
there would make the card a lie.

## 3. Can a card show an outcome the engine cannot produce?

**It could, once.** `applyCareerEvent` destructures exactly two outcomes and
branches on the first one's odds. Any other shape a content author writes prints
on the card and never happens.

`saudi_approach:take_it` had two outcomes and no odds on the first, so its
second line — "a weak league, a fading value, and trophies worth a fraction of
these ones" — was unreachable. It carried no mechanical effect, so nothing was
lost in play; what was wrong is that the card described a consequence the engine
was incapable of producing.

Folded into the outcome that does happen, so the warning survives. The class is
now impossible: `pnpm fairness` fails the build on any option with more than two
outcomes, or with two and no odds on the first.

## 3b. Does choosing an option do what the option said?

**It did not, on one card, three ways at once — and a player found it before any
tool did.**

`applyLoanReturn` implemented `buyout:` and let every other option fall through
to "went back to the parent club". On the loan-expiry card that meant the two
priced `transfer:` offers did nothing, a further loan spell did nothing, and the
`return:` option ignored the wage and contract length printed on its own face —
a player came back to €1.2k a week after being shown €23k. Three of the four
options were fiction. He chose Lyon twice and was handed his old club.

Nothing in this repository could have caught it. The options were well-formed,
so there was no type error. Nothing threw. No test covered it, because a test
only covers the branch somebody remembered to write.

So the check is a property asked of **every option of every decision**, by
forking the state and applying each one:

1. An option that names a club puts you at that club.
2. An option that prints terms gives you at least those terms — better is
   allowed, because a player under contract cannot be made worse off by a loan
   ending, but worse is never allowed.
3. An option that names the club you are already at does not move you.

**5,375 options checked, every one honest.** It is exhaustive by construction: a
new decision kind, option prefix or resolver branch is covered the moment it can
appear in a career, with nobody having to remember to extend this.

One related family was checked statically rather than by simulation: an `Effect`
field declared on a card but never applied by the resolver would promise
something that cannot happen. All 24 declared fields are applied. The consequence
lines shown on an option ("Ability +3", "Become a Regular Starter") cannot
diverge at all — they are generated from the same effect object the engine
applies.

## 3c. Was the player ever given a choice at all?

**Not always.** §3b asks whether an option does what it says. This asks the
question one step earlier: was there a decision on the card in the first place?

Two faults, both found by sweeping played careers rather than by reading code,
because neither card looked wrong on its own:

- **A transfer window with nobody to join.** The rule that drops an offer losing
  to the renewal on every axis (added so a window could not be padded with
  filler) was applied to a draw of exactly as many suitors as the card had room
  for. When both drawn clubs were worse, all of them were dropped and the
  "transfer window" arrived with one button on it saying *stay*. **One career in
  six** hit it — including an 82-rated regular at a Premier League club, the
  player a market is least likely to ignore.
- **A loan card with one destination.** The home rung looks only at clubs in the
  parent club's own country that are below it and would play him. A country with
  a single division in this world often has one such club, or none.

Both are the same shape as the season-focus card this project rebuilt a month
earlier: a card that is a tap rather than a decision. The fixes are structural
rather than statistical:

1. The window draws **two spare suitors**, so the filler rule can throw offers
   away without taking the card down with it.
2. If the filter still empties the card, the market's own first choice among the
   rejects is kept — the guarantee moves from probable to structural.
3. The second, floor-free look now triggers on **no suitors** rather than on no
   options, and drops the coherence anchor: a last resort is by definition not
   coherent with the rung he is leaving.
4. A mid-contract window that still finds nobody is not shown at all. A summer
   in which nobody bid is a real thing; a card announcing it is not.
5. A home loan his country cannot fill falls to the next rung of the ladder, and
   a loan window that cannot find two clubs is not dealt.

`pnpm fairness` now sweeps every card of hundreds of careers and fails on any
card that is not a decision: more than `CARD_SLOTS` options, fewer than two, a
transfer window with no suitor, or the same option printed twice. **7,640 cards
checked, every one a real choice.**

## 3d. The rules this project only stated in prose

The two bug families behind everything above are worth naming, because they
recur:

1. **The card promises what the engine does not do** — a resolver branch nobody
   wrote (§3b). Answered by an exhaustive property, not by more test cases.
2. **A rule is written down in one place and enforced in some of the others.**
   The comment said "there is always at least one", and it was true on the path
   its author was looking at. Prose cannot fail.

So the normative claims in the engine's comments, the README (now
`docs/design.md`) and these design docs were collected and turned into executable assertions — one test each,
quoting the file that makes the claim, in `engine.test.ts` under *the rules this
project states in prose*: every event fires at most once per career; a card is
never more than three options and never fewer than two; a transfer window always
has somewhere to go; OVR is derived at every step of every career; a veteran is
always offered the walk-away; a club that would never go down never does;
consistency changes the spread and not the career average; loans go down the
pyramid and never out of it; a zero weight is never drawn; a card whose kind
nothing resolves cannot be answered.

That last one closed a live hole: `decide` ended its switch with
`default: break`, and `DecisionKind` carried two members (`key_moment`,
`contract_renewal`) that no builder produced and no resolver read. A card of
either kind would have been dealt, chosen, and applied nothing — §3b's bug
waiting to happen. The union now lists only what exists and the switch is
exhaustive, so adding a kind without a resolver stops compiling.

**The suite itself was not typechecked.** `tsconfig.json` excludes `*.test.ts`
because it emits, so `pnpm typecheck` never looked at a test file. Writing these
assertions found a test calling `mulberry32('a-string')` — a number parameter —
which seeds NaN and hands every "sample" the same value: 400 measurements of one
season, reported as a distribution. A suite that measures nothing looks exactly
like one that passes. `tsconfig.check.json` now typechecks src *and* tests in
both packages, and it immediately found a content test asserting against a
`Player` shape three fields out of date.

## 4. Can the leaderboard be gamed?

**Not by forging a score.** Every submission is replayed server-side through a
hash-pinned copy of this engine, and all four claimed numbers — achievements,
gross earnings, fees, peak value — must reproduce exactly or the submission is
rejected with a 422. There is no way to post a number the engine would not
produce.

**But it can be ground.** The engine is deterministic and runs on the client, so
nothing stops a player replaying the same seed until a good run appears and
submitting only that one. The daily challenge is the answer to this in
principle, and in practice `playedToday` is a `localStorage` flag: clearing site
data or opening a private window resets it, and the server accepts unlimited
submissions for the same seed by design ("must land as distinct runs, not dedupe
into one").

**Open, and deliberately not fixed here.** Closing it needs identity — accounts,
or server-side per-seed rate limiting — which is a product decision and not a
balance change. Left open on purpose, rather than solved by inventing an auth
system the game does not need.

**Narrowed, 2026-09-17.** Two things changed and neither closes it:

- A **rate limit** now caps submissions at 20 per minute per address. That
  prices grinding at scale — a thousand seeds an hour is no longer free — but a
  patient player on one seed is unaffected, and anyone with more than one
  address is unaffected too. It is a ceiling on volume, not on the tactic.
- The **daily board** is now real: a career is ranked against the other careers
  played on its own seed at its own pace. That is the board the daily challenge
  was always supposed to have, and on it the seed cannot be shopped for,
  because everybody got the same one. Grinding it still works — replay today's
  world until a good run appears — so it changes *what* a grinder has to do
  rather than whether they can.

**A second thing this section should have said all along: a percentile ranks a
run, not a player.** `total` is every career anybody ever finished, so somebody
who plays fifty careers contributes fifty rows and moves the denominator fifty
times. "Top 5%" therefore means "in the best 5% of careers submitted", which is
not the same claim as "better than 95% of players" and is quietly easier for a
heavy player to reach. This is inherent to a board with no accounts and is
stated here rather than fixed.

## 5. Is the character you create a fair start?

Same seeds, same policy, one choice varied. Any gap is the choice.

**Archetype: fair.** 2–8% between best and worst.
**Nationality: fair.** 6–8% across England, Spain, Brazil, Norway, Ireland,
Japan and Nigeria.

**Position: it was not fair at all.**

| | before | after |
|---|---|---|
| ST | 3089 | 2874 |
| LW / RW | 2713 | 2605 |
| GK | 2226 | 2660 |
| LB / RB | 1739 | 2303 |
| CB | **1536** | 2216 |
| CDM | 1560 | **1894** |
| **spread** | **101%** | **52%** |

A striker scored twice what a centre-back did, on identical seeds, played
identically, to a peak ability within two points. Somebody who picked centre-back
at sixteen could not reach the top of a global leaderboard however well they
played, and nothing in the game said so.

### Why

The achievements score paid for `goals × 3.2 + assists × 2.1`. Career medians
run from 264 goals at striker to 27 at centre-back. Meanwhile a centre-back's
actual career — **4,547 tackles, interceptions and headers won, 202 clean
sheets** — was worth nothing at all, because those columns were recorded,
displayed, and then never scored.

Individual honours made it worse. Golden Boot is for forwards, Golden Glove for
keepers, and there was no third. Measured over 250 careers, an attacking
midfielder finished with **zero** award points and a striker with 368. Not
because he played worse — because his position had nothing to win.

### What changed

- **Output is scored against the position's par.** A season's productive work —
  goals, assists, clean sheets, saves, defensive actions, key passes,
  appearances — is divided by what a typical career in that shirt produces per
  game (`OUTPUT_PAR`, regenerate with `pnpm par`). A par career is worth the
  same everywhere, and *outplaying your position* is what earns points. This is
  also how anyone actually judges a footballer: 27 goals is a quiet season for a
  striker and a remarkable one for a centre-half.
- **Defender of the Season**, worth the same 160 points as the other two, judged
  on defensive actions per game and clean sheets, and banded separately for
  centre-halves and holding midfielders because the two jobs produce different
  volumes.
- **Playmaker of the Season**, for midfielders, on assists and key passes — the
  award the creator never had.
- **Longevity means seasons near your own peak**, not seasons above a flat OVR
  80. A position's rating comes out of its own attribute weighting, so a holding
  midfielder peaks around 82 where a striker peaks around 84; a fixed line at 80
  paid one of them for most of his career and the other for a third of it (252
  points against 56).

### What is left, and why it stays

52% is not 0%, and closing the rest would mean lying about football. A striker
is worth more in the transfer market, so he moves to bigger clubs, wins more
there, and peaks a rating point or two higher — €114.7M career earnings against
€69.9M for a holding midfielder, on the same seeds. That difference then shows
up in trophies and peak ability, which the score counts and should.

The unfairness that is gone is the *scoring artefact*: a defender's job now
scores, and every position has an honour it can win. What remains is the game
saying that goalscorers are valuable, which is true.

`pnpm fairness --assert` holds the line at 60%.

---

## Consequences of the scoring change

Achievements scores moved for everybody, so:

- **Percentile anchors were regenerated** (`pnpm balance` → `DISTRIBUTIONS` in
  `apps/web/src/lib/game.ts`).
- **Existing leaderboard entries are no longer comparable** with new ones. They
  were computed under the old formula and cannot be recomputed, because the
  server stores scores and not decision lists.
- **The edge bundle redeploys on merge**, as it does for any engine change, so
  the server verifies against the same scoring the client uses.
- **Saves in progress become unrankable**, which is the existing, deliberate
  behaviour for any engine change: the career still plays to its end and the
  summary says plainly that it cannot be ranked globally.
