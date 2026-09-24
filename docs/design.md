# Design

How Decision FC works and why: the systems that make it a game, and the balance
acceptance numbers they are held to. The front page is [README.md](README.md);
where each system lives in the code is [map.md](map.md).

## The systems that make it a game

### Squad status is ability, not luck

Six rungs:

**Fringe Player · Impact Sub · Squad Player · Regular Starter · Important
Player · Star Player**

`roleCeiling(player, club, league)` is the best rung a player's ability can
reach at that club, and **everything that could otherwise hand out a role is
clamped to it** — a contract clause, an event card that promotes you, a loan
guarantee, a good run in the side. A 68-rated player is a squad player at a
Champions League club whatever the paper says. Getting promoted means getting
better first.

Two functions sit on top of it and they mean different things:

- `promisableRole` is what a **contract may state** — exactly the rung his
  ability earns, so the card and the top bar agree the morning after he signs.
  It used to add a rung of "clubs oversell a signing" optimism, which it added to
  every offer in the game, so every contract was wrong by precisely one rung.
- `roleCap` is the ceiling **once the season is running** — one rung higher, and
  that rung is the whole of the upside an event card or a good run in the side
  can buy. Something a season earns, never something a signature grants.

Long service (four *consecutive* seasons at a club) is worth one more rung on
both. A loan breaks the run: the loan season is spent at the borrowing club, so
a returning player starts his service count again — the same measure the rest of
the engine uses, and the offer audit fails the build if a card promises a rung
service has not bought.

**The debut season is a fringe season**, whatever the ladder says. A
sixteen-year-old gets three to eight games — cup ties, dead rubbers, the last
twenty minutes of a win — and the role now says the same thing the appearance
rule always did. The two were written apart and disagreed: a boy who joined a
small enough club cleared its bar, opened his career labelled *Squad Player*
and then played five matches against a squad player's range of 25–39.

**The squad standard is the division as well as the club.** `starterBar` takes
the higher of what the club's reputation demands and `leagueFloor` — 56 at the
foot of Ligue 2, 74 in the Premier League. Reputation alone cannot express that
gap: our data puts Leeds at 60 and Southampton at 55, so without the floor a
Premier League club and a Championship club asked the same ability of a player,
and a 65-rated footballer was a Premier League regular. Always pass the league
the club is in **now** — a career moves clubs between divisions, so
`club.leagueId` is only where the world started.

The role is shown beside the club in the top bar, on every transfer contract and
on every loan card.

### Growth, and the constant that decides how far a career can go

Development is a table of age bands and talent profiles (`PROFILE_TABLES` in
`model/growth.ts`). Minutes do **not** accelerate it; they only penalise a
benched veteran from the fourth cycle on.

That makes it **additive**: what a player gains has nothing to do with what he
already is, so a career's peak is very nearly `start + the sum of his cycles`.
Which makes the starting rating the single most load-bearing number in the game.

**Decline is bounded per season.** The age tables run negative after the peak,
and a bad-form multiplier used to *divide* that loss — at the 0.5 floor it
doubled it — so a poor season with a lasting injury on top once took a player
from 85 to 68 in a single year. A sub-1 multiplier now only slows gains, never
deepens decline (`developPlayer`), no single season's curve may strip more than
`MAX_SEASON_DECLINE`, and the curve plus an injury together are capped at
`MAX_TOTAL_SEASON_DROP`. Real decline is a step down, not a cliff.

**A banned season is a banned season.** The record's contract — no minutes, no
silverware, no growth — used to be one-third enforced: growth froze, but the
season still simulated appearances for a fringe role and the trophy roll still
credited medals. Now a suspension zeroes the season's stats, credits no trophy
or award to the player (the club can still go up or down around him) and pays
nothing — the consequence line on the card says "a season lost, unpaid", because
a card must never hide a real cost. Keepers also no longer score for their
country: the international goal model used to lump GK in with defenders.

The growth table is tuned from a start of **OVR 50**. Careers used to start at a
median of 44 — so every career ran six points behind for its entire length,
peaked at a median of 75, and the biggest clubs (squad standard 88) were
unreachable. `START_BASE` in `model/attributes.ts` puts the median on 50.

**Do not change `START_BASE` without re-running `pnpm balance` and updating the
acceptance table and `DISTRIBUTIONS` together.**

### A market that reads like football

- Offers come from leagues near the player's level, and **last season decides
  which way the ladder points** — star for a mid-table side and the clubs above
  come calling; spend the year on the bench and the clubs below smell a bargain.
- **One window is one football world.** Both the league spread (`WINDOW_SPREAD`)
  and the club-standing spread (`WINDOW_REPUTATION_SPREAD`) are enforced across
  the whole window, not against whichever club was drawn first. Napoli and
  Cremonese are both Serie A, and offering them together is exactly as
  incoherent as crossing divisions.
- **Nobody leaves a club he has not played a season for.** The window is
  structurally between seasons; event cards are gated at the source.
- Spin-off markets (Saudi, MLS, Japan, China) are a late-career money move or a
  way out when Europe stops calling — never more than one per window, never a
  normal next step for a wanted 24-year-old. Loans stay in Europe's pyramid,
  downward only.
- **A player who has outgrown his division is offered the level he has earned,
  not the level he is at.** The window used to be seeded from his current club
  alone, so an 82-rated twenty-two-year-old at a mid-table Championship side had
  his band centred on 0.48 — with a spread of 0.22 that put the ceiling at the
  Eredivisie, and every big-five top flight was arithmetically out of reach. The
  band now centres on whichever is higher, the division he is in or what his
  ability and last season argue for. Measured over 400 played careers, a 78+
  player in a second tier is now offered a big-five top flight in **95%** of the
  clubs he is shown, against Twente and AZ before.
- **The big five rank the way I say they rank**, and so do their second
  divisions: England first, the other four each other's equals. Ligue 1 was
  0.86 against 0.94–0.97 for Italy, Germany and Spain — far enough below to sit
  in a band of its own and catch 23% of big-five offers against Spain's 16% —
  and Ligue 2 was 0.37 against 0.41–0.42. At 0.91 and 0.41 the shares read
  England 27%, the rest 16–20% in the top flights.
- **Portugal, the Netherlands and Belgium bid with their title race and their
  European places, or not at all.** By design: these three sit below the
  big five, and a career that has earned a big-five move should not be reading
  Eredivisie offers half the time. Their pull is a fifth of a big-five top
  flight's (`leaguePull`), and `clubMayBid` returns false for any club in them
  outside the top two standings — on the transfer screen *and* on the event
  cards that carry an inline move, which is where a quarter of those offers were
  still coming from after the first fix. 92% of the offers they now make are
  from their title or European places, and the remainder are loans.

### What a league pays is not what it is worth

Every league carries a `wageIndex` alongside its sporting `strength`, because
the two genuinely come apart. An ordinary Premier League side outpays a giant in
Serie A; the Championship pays like a European top flight while playing
fourth-tier football; Ligue 1 is strong and cheap outside Paris. **Only the wage
moves with it** — fees, market value, awards and legacy stay on `strength`.

The Gulf is the wage trap: the highest index in the pack against a middling
strength, huge net wages (0% tax), weak-league exposure quietly shrinking market
value and legacy points scaled by league strength. A genuine trade, not a free
lunch. A money-league offer is floored so it actually pays more than the player
currently earns — a trap that undercuts you baits nothing.

### The pyramid moves

Promotion and relegation are real: the club changes division and plays there
from the next season on. The world is shared and immutable, so the change is
recorded on the career (`CareerState.leagueMoves`) and applied by `indexWorld` —
every question about which division a club is in then answers with that career's
own history.

**The club decides the range; the player decides where in it the season lands.**
Base rates come from `club.reputation` (a well-run second-tier side goes up far
more often than a poor one, whoever plays for it), and the player's standing
against the squad bar is a *multiplier* on that base, not a number added to it.
Additive, a passenger at Manchester United handed them an 8% relegation chance,
because their base rate is zero and anything added to zero is the whole of it.
In about 87% of careers, a club he plays for changes division.

### The floors a career stands on

Four rules put a floor under the stories the sweeps kept catching, all of them
asserted by `pnpm plausibility` and `pnpm fairness`:

- **A spin-off signing is the product.** Every offer from Saudi Arabia, the US,
  Japan or China promises at least an **Important Player** — the floor lives in
  `promisableRole`, so the offer builder and the market audit read one rule —
  and the arrival season delivers it absolutely, over the ability cap and over
  event-card demotions, the way a loan guarantee already outran ability. From
  the second season, ability decides again. The Gulf event card deals Saudi
  clubs only.
- **Nobody under 35 is retired by an empty window.** Below the retirement age
  an empty transfer card retries as a last resort, and the last resort ends in
  a register-him-somewhere pool: one club his ability would not embarrass takes
  him on whatever terms. A forced `no offers` retirement — and the `frozen_out`
  ending — is only reachable as a 35-plus veteran the market genuinely stopped
  calling.
- **No cliff between rows.** From one season's close to the next, a career
  loses at most 8 rating — curve, lasting injury and event-card costs inside
  one budget. The one exemption is a position switch, which reprices the player
  honestly and prints the new position on the row.
- **The mercy rule.** Three gambles landing red in a row force the fourth
  green. Deliberately unexplained in the game, in either language — the printed
  odds stay the odds of every ordinary roll, which `pnpm fairness` verifies
  card by card and pooled over every gamble, with the forced rolls (2.7% of
  gambles) left out of its tally, and it fails if any career sees four
  straight reds. Counted in, the forced rolls lift the pooled figure 1.3
  points above the printed odds (z = 4.1) — too little for any one card's
  check to see, which is why the pooled check exists.

Positions are down to ten: I retired LM and RM (the type keeps them so
old saves replay; nothing generates them). The green bars on an offer row show
**club strength** — the squad-quality number that decides the role you would
get there — not league strength, which the division name already carries.

### Forty-eight cards, and a career sees under half of them

A career draws **20.7 event cards** at the standard pace (`tools/pace.ts`). When
the deck was thirty, the 18.6 a career drew then dealt 62% of it, and the second
career a player started was mostly cards they had already answered — while
`events.ts` opened by claiming the pool was big enough that nothing needed to
come round twice.

Twenty new cards take it to forty-eight: the agent who wants to sign you, the
armband, the new manager's fifteen minutes, the winter break, January when you
have not started since October, the boot deal, the free kicks nobody has
claimed, the language lessons, Thursday-Sunday, the wages in the paper, the
family two thousand miles away, the coaching badges.

Each one is still an `Effect` object — so the consequence printed on the option
is generated from the thing the engine applies — and still fires at most once
per career.

### Every card has a face, and every offer says what kind of club it is

- **A drawn mark on every card**, not an emoji: 🩺 is a stethoscope on iOS, a
  flat cross on Android and a shrug on Windows, none of them in this palette. Fifteen glyphs — the pitch, the
  treatment room, the training ground, the contract, the press, the corner flag
  — one stroke weight, `currentColor`, keyed by subject rather than one per
  card so a new event still gets a sensible mark.
- **An offer says what kind of club it is**: *title race*, *European places*,
  *mid-table*, *survival fight*, measured by quartile **inside that club's own
  division** so it means the same thing in the Premier League as in Ligue 2.
  The card printed the division, the wage, the length and the role, and still
  did not answer the first question anybody asks about a club they have never
  heard of. Outside UEFA there is no European place to finish in, so a Chinese
  or Saudi side reads *continental places*, never *European places* — the label
  a player rightly queried on a 中超 offer.
- **Europe is qualified for by that standing, not by a badge.** Continental
  football (and so the chance of winning it) belongs to the *title race* and
  *European places* clubs; a *mid-table* or *survival* side is not in it,
  however famous — which is why a mid-table West Ham is no longer entered in the
  Champions League and winning it, and why the Thursday-night and league-or-
  Europe cards are never dealt to a club with no European football
  (`continentalEntry`, tested).
- **A club is priced into the division it plays in.** Promotion and relegation
  move a club's title odds, its relegation risk and its promotion chances onto
  its *current* division's field, not the one the data assigns it — a promoted
  Southampton is a survival case in the Premier League, not the champion it
  was a division down, and it won the title at exactly those old odds before
  this was true. The standing also damps the title roll: a survival-band club
  never wins the league that season and a mid-table champion is
  Leicester-rare. Single-tier countries never produce a "relegated" season the
  world has no division to serve. All of it is asserted by
  `pnpm plausibility` (`tools/plausibility.ts`), which plays 1,500 careers and
  audits every season as a football story.
- **And whether you suit the manager.** `tacticalFit` spans 0.88–1.12, and the
  squad role reads it as up to two rating points either way (`standingDelta`),
  enough to decide a place at a club whose numbers you already match. Each offer
  names the manager's style and leaves the judgement to the player (see
  *Whether the manager's football suits you is your read*, below).

### Nothing happens off the card

`Effect` opens with "everything here is something the player can *see* happen —
there is deliberately no invisible meter", and four of its fields were breaking
that promise. The consequence lines described ability, minutes, silverware and
transfers, and said nothing about **money, development, injury risk or the
wage** — so the charity match read as "risk an injury against doing nothing"
while its second option quietly wrote a cheque, and the sports-science programme
read as a free +2 with a €300,000 bill and a lower injury risk both silent. Ten
cards moved money without mentioning it; two changed the wage; four changed how
fast the player developed. A named attribute — the boot deal's point of pace,
the free-kick duty's shooting — was applied and never printed either.

All of them are on the card now, and they say the right thing for the player
in front of them: a growth multiplier is *"you develop faster this season"* on
the way up and *"you hold your level better this season"* once the curve has
turned, because I read the first sentence on a thirty-three-year-old
taking his coaching badges. Which one appears is read off the same development
table the engine draws from (`stillImproving`), so an early bloomer sees the
second at twenty-eight and a late one is still seeing the first at thirty.

The mirror of the rule holds too: **the dictionary may not carry copy no screen
can ask for.** Forty-two leaves did — a
relationships panel that was cut, a growth panel that was cut, six summary
labels replaced by a different layout, a scouted potential range never built —
and each of them read like a feature to anyone skimming the file and cost real
work to translate twice. `pnpm test` fails on both faults now.

### Money is counted in weeks, not euros

A flat figure on a card is a fortune to a seventeen-year-old on £600 a week and
pocket change to the same player at thirty on £300,000. The boot deal was
€900,000 whoever you were. Event money is written as `cashWeeks` — how many
weeks of the player's *current* wage — and resolved against that wage in the
same function that applies the pace weighting, so the number the option shows is
the number it pays.

Money a card pays also **counts on the wealth board**, which it did not: the
earnings ranking summed the contract only, so the boot deal, the testimonial
gate and every other card whose subject is money moved the total in the corner
of the screen and nothing else. Money a card *costs* is an expense — it comes
out of what he has, not out of what he ever earned.

### Would anybody ever pick the other one?

`pnpm fairness` holds the floor — two or three options, no printed outcome the
engine cannot produce, and the odds shown are the odds rolled. All three are
about honesty. None of them asks the question a *player* asks, so `pnpm deck`
prices every option in one currency and names the cards that are not decisions.
It found thirteen of thirty-nine:

- **Three had a right answer.** A month in the reserves paid two points of
  ability *and* a rung against an option that cost a rung and gave nothing — 24
  points clear. Shouting at a referee cost the whole season at 65%, which is 34
  points clear of walking away. Playing on an injury could not win at all.
- **Six were ties.** Learning a new position landed on exactly the number
  refusing landed on, so the card could not be played wrong.
- **Two were free rolls.** The boot deal paid the same money on both branches,
  so signing had no downside and refusing was sentiment.
- **Two were coin flips with nothing on them** — the charity match risked an
  ankle against a cheque and both came to the same number.

All of them are trades now: **35 of the deck's priced cards are a real
weighing-up, with 0 dominated, 0 flat, 0 free lunch, 0 free roll and 0 that risk
points for no premium.** The referee card is the one worth naming, because the
fix ran the other way — the *copy* had always said "three matches" and the
*effect* took the season, so the effect changed to match the copy rather than
the reverse.

**And every downside now says why it happens, on the card, before the choice.**
`effects` gives the price — "Ability −3 · Higher injury risk" — and the reason
used to live only in the result prose, which arrives once the decision is made.
So a player was told what a branch costs and never what causes it: forty per
cent of the time the boot deal leaves you slower, and nothing said it was
because boots you cannot play in also pay you nothing. The rule is one clause
per negative outcome (`OutcomeHint.whyKey`), and the content suite fails the
build on a negative outcome that does not have one in both languages.

`deck` prints and does not fail the build, because some of what it flags is
deliberate: `decisive_penalty` is a coin flip because that is what a penalty is,
and `mysterious_substance` is a temptation with a terrible tail on purpose.

**And no card deals an option that another option beats on every count.** `deck`
prices the *event* deck; the cards that offer clubs are priced by the market and
were never asked the question. They should have been: a window could offer
Valencia, Getafe and Mallorca on the same squad role with Valencia paying the
most, and an escape card could open onto Plymouth and Nürnberg with Plymouth
paying twice as much. **Three offer cards in ten were that card.**

One rule now covers all three places that deal clubs (`outbids` in
`model/market.ts`): an option that another option matches or beats on stature —
club reputation plus its division, weighted the way a player reads it — *and* on
promised role *and* on wage is filler, and comes off. Two guarantees survive it:
a window always has at least one club to join, and the loan-return card always
deals three answers, so when the frontier is a single club the best of the
discarded goes back on rather than leaving a button missing. Measured over 400
played careers, **the rate fell from 30% of offer cards to 15%**, and on the
event deck from 50% to 4%.

The cost is honest and worth stating: deleting the obviously-worse button means
indifferent play is no longer punished for pressing it, so the floor rose by a
tenth of a career (`unambitious` 1,627 → 1,785 legacy) while deliberate play
stayed where it was. The number that says whether choice still matters did not
move — 31% of the visible range either side of that change — and `pnpm skill
--assert` now measures the best deliberate policy rather than `ambitious`
specifically, on 1,600 seeds rather than 400, because at 400 the gate flaked
either side of its own threshold. It reads **30%** today, after the trophy-share
and minutes changes further down; the acceptance table carries the current
number and this paragraph is about what deleting the button did.

### Every card is a decision

A card with one button on it is a tap, not a choice, and the game has shipped
three of them. Two came from the market, and from rules that *remove* options
rather than add them: the filter that drops an offer losing to the renewal on
every axis, and the loan rung that looks only at clubs in the boy's own country.
When the filter dropped every drawn suitor, the "transfer window" arrived with
nothing but *stay* on it — **one career in six**, including an 82-rated regular
at a Premier League club.

So a rule that can remove an option is now paired with something that refills
the slot: the window draws three spare suitors, keeps the market's own first
choice if the filters still empty the card — two of them now, the one that drops
an offer losing to the renewal on every axis and the one that drops an offer
another offer beats on every axis — and looks again without the coherence anchor
when nobody at all turned up. A summer in which the market
really did produce nobody is told by **not dealing a card** rather than by
dealing an empty one. A home loan the player's country cannot fill drops to the
next rung of the ladder, and a loan window that still cannot find two clubs is
not dealt.

Under contract, staying is always answerable. A club that has stopped picking a
player can decline to renew him at the end of the deal — that is the game's
honest failure state — but it cannot tear up the years he has left, and the
window must never read "leave, or leave" for a player with three seasons to run.

`pnpm fairness` sweeps every card of hundreds of careers and fails the build on
any that is not a decision: more than three options, fewer than two, a transfer
window with no suitor or the same option printed twice.

### A loan is one season

**What a borrowing club guarantees depends on where it sits in its division**,
which is what makes the card a choice rather than three flavours of the same
move. The rule:

| The club is | It guarantees | Which is |
| --- | --- | --- |
| chasing promotion, or in the play-off places | Squad Player | 25–39 appearances |
| mid-table | Important Player | 38–48 |
| fighting relegation | Star Player | 42–50 |

Better football with less of it, against a weaker club where he plays every
week. It used to be a flat two rungs above his ability for everybody, so every
loan card in the game read *Star Player* three times over. The role is a
guarantee rather than a ceiling — it genuinely outruns ability, and this is the
one place in the game where that is right rather than a bug: the parent club
lends the boy *on condition that he plays*, and that clause is why a
seventeen-year-old rated below every senior starting bar in the database has
anywhere to go at all. The offer audit knows it and exempts loan seasons; every
other season is still ability plus at most two rungs.

Up to three spells — a year at home at seventeen, the big five's second tier at
eighteen and a bottom-half top-flight club from the second spell on, for a
player who has earned it. Each one runs **exactly one season**. There is no
*stay another year* button, deliberately: the card has three slots and an
extension took one from the clubs, so a boy who had just spent a season
somewhere was shown that same club again and only two others. A second season at
one club still happens — it comes back through the ordinary rungs, on merit.

Every spell needs **two years on the parent contract**, on the way out *and* on
the way back. A club does not lend an asset whose deal expires the moment he
returns, and the return card used to offer the next rung without that check —
the one card that could break the rule was the one that did.

**The card that ends a loan deals three answers, and says in its body what the
parent club has decided.** It used to open on how the loan went — *you played
well* or *you did not* — and now opens on what that earned him: *they want you
back in the side*, or *you are still not in their plans*, keyed on whether his
ability takes a real place there.

Going back is offered when they want him. When they do not, a return would be
fringe minutes on the bench, which is not an answer worth a slot — so my
rule **replaces it with another loan** when one can be dealt, a spell
somewhere he actually plays (*still not in their plans, go find your football*).
When even that is impossible — his final contract year, or the loan rungs spent —
the club does the other thing an unwanted asset gets: it moves to **sell him
before he leaves for nothing**. That card is two sale offers (the buy option he
earned on loan and one from the market) and, last, the resigned choice of going
back to run the deal down from the bench (*still not in their plans, and they
mean to sell you*). Whenever going back is shown, it is not a new deal:

| what is left on the parent contract | what the card offers |
| --- | --- |
| two years or more | he returns on the deal he signed, printed as time remaining |
| final year, and they want him | new terms, priced as a renewal and labelled as one |
| final year, and they do not | the last season, and a line saying he leaves for nothing next summer |

That middle-and-bottom split is the fix for a quiet one: the return option
carried a freshly priced market wage and the resolver took the better of it and
his existing deal on each axis, so *every* return raised his pay and read as an
automatic renewal with no club having decided anything.

The third slot is filled by the market — the same offer builder a transfer
window uses — when there is no next loan rung to deal. It comes out two only for
a player nobody in the database would sign (measured at 4 cards in 805), and
inventing a suitor for him would be worse than showing two.

It used to be written for one *or two* seasons at the moment the loan was
agreed, and a third of all spells came out two — a year of a career decided
without a card. On the quicker paces, where a card comes every second season
anyway, the player disappeared for what felt like an age.

The clock is deliberately independent of the card cadence. The game prefers to
alternate an event round with a transfer round, but that is a preference: the
return card is dealt the season the loan ends, at every pace.

### The manager gets sacked, and you are told

A new manager is the most common reason a real career turns — same player, same
club, a different idea of what a midfielder is for — and for a long time it was
the quietest thing in this game. `managerChanges` switched the club's style,
tactical fit moved with it, the squad role followed a season later and no
screen ever said a manager had been sacked.

The **transfer window** now opens on that news when the new man suits him worse
(a lost rung on the ladder, or three points of tactical fit — a quarter of the
whole ±12% range). It names both systems — *they pressed for the ball; he wants
it played out* — and everything under the headline is an ordinary window: two
suitors, the renewal or the run-down, the retirement option for a veteran and
all the coherence rules that keep a window one football world. Deliberately not
an event card: club offers written by a second builder would be a second,
quietly different market.

It is the one thing that bypasses the settle rule. A player whose manager is
sacked in May has every reason to go in June, whatever the calendar says about
how long he has been there. Measured at **3.7% of seasons and 11.6% of windows**
over 300 careers, with a manager change happening at the player's own club far
more often than that — most of them suit him no worse, and good news does not
need a transfer window attached to it.

### A reason to stay

Every incentive used to point at leaving: loyalty paid a small legacy bonus at
retirement and nothing during a career, while every window offered a raise. A
one-club career is one of football's best stories and had no mechanical account
of itself.

Four seasons at a club now buy a **rung of standing** — the club picks the
player it knows ahead of a signing of identical ability — and the renewal offer
pays for service on top of ability, the only offer in the game that does.
Leaving costs you both, which is what makes staying a decision rather than what
happens when nothing better arrives.

### When a manager goes

Sackings follow results — relegation is close to a certainty, a barren season at a big
club is a real risk, a trophy is near-safe — and the replacement always plays
something different. About 95% of careers see one at a club they played for.

Recorded on the career (`managerChanges`) and applied in `indexWorld`, the same
way division changes are, because the world is shared and immutable.

### You can see the ladder you are climbing

The squad ladder is deterministic on purpose, so "three more rating points and I
start here" is knowable — it was just only knowable by reading the engine. The
header now says it: *+3 OVR to be a Regular Starter here*.

### Whether the manager's football suits you is your read

`tacticalFit` is worth up to two rating points either way when the squad role
is decided (`standingDelta`), which is enough to decide a place. The September review added a **Suits you / Wrong for you** verdict
to every offer row; on 2026-09-23 I took it off again, because reading a
manager's style against your own game is meant to be the player's judgement,
not the screen's. What replaced it is the other half of that bargain:

- **The inputs are on the screen.** Every offer shows the manager's style, and
  *How to play* now says what each style asks for — legs and stamina, passers,
  pace and a finish, defenders and strength, quick dribblers — so the read can
  be made.
- **The read can always pay off.** Every transfer window has at least one club
  whose football suits the player, and the card does not say which. "Suits" is
  `suitableStyles` in `career/decisions.ts`: his best system and any within
  0.02 of it (the median gap to his second best), widened until at least 48
  clubs — a quarter of the world — play one of them. Without that floor a
  winger's only suitable system was wing play, which seventeen clubs play,
  which is not football. When a window has none, one offer is swapped for a
  suitable club **matched to it in level** — from the clubs the window already
  drew, or a fresh draw held to the same coherence spans — and in the rare
  window at the very top where no club at his level plays a suitable system
  (about one in seven hundred), the next best system counts rather than a club
  from another level being dropped in.
- **It does not move the market.** Measured over 900 careers before and after:
  offered clubs' reputation 65.9 → 65.7 on average with the same percentiles,
  reputation against the player's ability −7.5 → −7.7, league strength and the
  spin-off share unchanged, peak ability 80.62 → 80.64. A swapped-in club sits
  a median one reputation point from the one it replaced, in the same league
  tier. About 38% of windows get a swap, and `pnpm market` and
  `pnpm plausibility` hold every window they deal to the same rules as before.

### Not playing costs you, at every age

Two things used to pay for chasing a badge you could not hold a place at.

A **club trophy** was scaled by league strength and by nothing else, so the
fringe player at a title-winning giant scored exactly what the captain who
played thirty-eight games scored. A medal is now worth your part in it: the
same club, the same trophy, and the man who played it is worth twice the man
who watched it, with a floor because he does have the medal.

**Development** owed nothing to playing time until a player's twenty-fourth
birthday. A sixteen-year-old who signed for a giant and sat on the bench
improved at exactly the rate of one playing every week somewhere smaller —
wrong about football, and it quietly made the loan ladder decorative, since the
whole point of a loan is to get a boy minutes. Minutes now scale a season's
gains, graded by role, alongside coaching and form.

Together they flip the thing the review called the deepest problem in the game:
**`shrewd` — go as high as you can and still play — now beats `ambitious`** on
all three boards. It was the other way round, which meant the squad ladder the
whole game is built on was decoration.

The cost of that honesty is in the acceptance table below, and it is real: peak
ability ≥90 fell from 6.5% of careers to 5.0%, and the median legacy score with
it. A game where the bench is free produces better players than football does.

### Two sheets on the intro: how to play, and what changed

Both are there so that a first-time player can read the game before the first
card arrives.

- **How to play**, in seven lines: one career from sixteen, everything happens
  on a card, the seasons play themselves, the percentages are real, ability
  decides where you stand, every manager plays his own football, the ending is
  earned. The seventh, on managers' styles, was added on 2026-09-23 when the
  offer cards stopped judging tactical fit for the player — this is where he
  learns to judge it.
- **What changed**, shown once per version. A returning player has no way of
  knowing loans work differently now. A dot on the intro rather than a popup —
  nothing on that screen should get between a player and the button that starts
  a career. `NEWS_VERSION` in `lib/news.ts` is what decides whether the dot
  comes back; bump it whenever the notice copy changes.

### Three references in Settings: handbook, about, FAQ

The intro's *how to play* teaches the rules in seven lines and stops there. The
questions after that — how a high score is actually built, what the game even
is and the practical "is it free / do I need an account / why won't a big club
sign me" — do not belong on the last screen before a career starts, so they live
one tap away in **Settings** (`components/SettingsSheet.tsx`), each behind its
own sheet. They are deliberately non-overlapping, which is why they are three
sheets and not one:

- **Strategy handbook** — the only one about *winning*: how each of the three
  boards is topped and why you cannot top all three at once, ability as the
  engine everything flows from, playing over sitting, the loan as a launchpad,
  reading the deal not the badge and one section each for a legend, a record
  valuation and a fortune. It scrolls inside its sheet; it is the one place in
  the game where scrolling is the point.
- **About** — what Decision FC is, that you steer while the seasons simulate,
  the real football world behind it and that it is free and independently made.
- **FAQ** — the practical questions, answered in a line each, with a link to the
  privacy policy.

All of the copy is in the dictionaries under `settings.*` (`hb_*`, `ab_*`,
`faq_*`); `SettingsSheet.tsx` holds only id lists, so there is never a sentence
to translate in a component. If a fact belongs to two surfaces it is written for
a different question in each — the how-to-play is never repeated.

### No line ends on a lone character

Since 2026-09-23, no block of text may leave one character (or, in
English, one word) alone on its last line. In Chinese it was splitting words —
"营养方 / 案", "技术教 / 练" — a dozen times in one career on a phone.
`text-wrap: pretty` on the body re-breaks the last lines of every paragraph and
inherits everywhere; titles and labels, and the two short notes on the ad
screen, `balance` instead. It is enforced rather than hoped for:
`verify-ui.mjs` reads every rendered line of every screen it passes through —
the intro, every reference sheet (handbook, FAQ, About, How to play, the
rankings, What's new), the identity screen, every card, the summary, the ad —
at every size and in both languages, and fails on a stranded character. Before
the fix one run found 28; after it, none.

### Pounds and English until the player chooses, and an intro that holds still

Since 2026-09-23 a first visit opens in **English with prices in
pounds**, whatever the browser's language; the language switch and the currency
setting are one tap away, a stored choice wins from then on and `/zh` still
opens in Chinese because that URL promises it. Currency is display only — the
engine and the leaderboards stay in euros — so the default can never change a
score. And **picking a pace moves nothing else on the intro**: the three
descriptions share one grid cell and only the chosen one is visible, so the
block is always as tall as the longest. Standard's was a line shorter, and the
hero above takes whatever height is left, so choosing it used to slide the
title and the pace buttons 14pt (Deep did the same in Chinese). `verify-ui`
now measures the hero, the title's size, the buttons and everything below them
under each pace, on seven phone shapes in both languages.

### Plain words on screen

Since 2026-09-23, after "Gegenpress" turned up on an offer card: no
coaching or medical jargon in anything a player reads. The styles are now
*High press*, *Possession*, *Counter-attack*, *Deep defence*, *Wing play* and
*Free to roam*; endings are *Tainted Record*, *Followed the Money*,
*Injury-Prone Talent* and *A Hundred Caps* rather than *The Asterisk*, *The Oil
Baron*, *Glass Talent* and *The Centurion*; injuries are a broken foot and a
torn knee ligament, not a metatarsal fracture and a torn ACL. In Chinese, 污点生涯,
淘金者, 伤病天才, 一人一城, 扎根本土, 脚掌骨折 and 小腿骨折 replace the phrases
that needed a second read. The career table's stat headings stay the standard
abbreviations (GLS, AST, CS…) in English only because the full words measure
35–37px against a 26px column, and widening it is what cut club names to
"Sunderla…" before.

### The daily challenge

Everybody in the world gets the same career today: same talent, same academy
offers, same cards in the same order. Only the decisions differ.

It costs the engine nothing — a career already replays exactly from
`seed + identity + decision list`, because that is what the anti-cheat re-runs —
so a fixed UTC-dated seed is the whole feature. It exists because three
leaderboards ranked against everybody who ever played are a wall rather than a
competition, and a board that resets daily over one identical career is
something a player can actually win.

**And it has that board now.** It did not for the first six weeks: the seed was
fixed and there was nothing to compare it against, which is the same wall the
feature exists to remove. The summary screen shows the standing among everybody
who played today's world, above the three all-time tiles and styled apart from
them, because it is not the same kind of number — the tiles rank a career
against every career ever played, this one ranks it against people handed the
identical world.

The server has no opinion about which seed today's is, and that is what makes it
cheat-proof without a shared clock: `career-submit` ranks every run against the
other runs on **its own seed at its own pace**, whatever that seed is. On a
one-off seed that is a field of one and the client does not show it; on the
daily seed it is the whole field. The pace is in the key because a Deep career
and a Speed career on one seed are not the same contest, which is why
`DAILY_PACE` is fixed rather than inherited from the intro screen.

### No career archive, and no reveal-speed control — both removed

Both were built in September 2026 and **both were removed on 2026-09-23**.
Recorded here so neither comes back by accident.

- **The archive** kept the last twenty finished careers as summaries on the
  device, behind a line on the title screen. Gone with its sheet, its copy and
  its storage key; `storage.ts` deletes `fc:history:v1` at boot for anybody who
  still has one, and `verify-ui.mjs` writes the old key before every run and
  fails if it survives.
- **Reveal speed** was an instant / normal / slow control in Settings that
  scaled every staged beat. Gone; the beats run at their designed length again,
  and `reducedMotion` is once more the only switch that shortens them.

The entry card on the intro screen is also **the only place the three boards are
explained**, and deliberately so: a career is a story being lived, and a running
leaderboard position in the corner of it would turn every card into a
spreadsheet question.

### Twenty-five endings, and all twenty-five reachable

A career closes with the **rarest** ending whose condition holds, not the first
one in the list — so adding a broad ending cannot silently take a narrow one out
of the game. That rule works only if the rarity order is honest about what is
actually rare *here*, and for three endings it was not.

`centurion` — a hundred international caps — sat among the headlines, above
five-time champions and three-hundred-goal forwards. But a hundred caps happens
in one career in five in this engine, so it swallowed them: `serial_winner` was
reached by 0.08% of careers not because winning five leagues is rare, but
because a player who does it almost certainly also has a hundred caps. Moving
caps below the things that actually distinguish one great career from another
took it from 20.7% to 12.7% and brought four endings back into view.

`homegrown` — never left home — was reached by one career in twenty-five
hundred, and the cause was the loan ladder: 95% of careers go out on loan, the
second rung is a big-five second division and a season there counted as a
country he had played in. A loan is not leaving. It counts where he was
*contracted* now.

`serial_winner` was "a very high legacy score", which is permanently in the
shadow of every ending that is a *thing that happened*. It is now five league
titles: what a serial winner actually is, and true of careers that never won an
individual honour — which is exactly when it should be the ending that fits.

The one target still missed is that the two most common endings take 33.8% of
careers rather than 30%. `solid_pro` is the floor for any career worth 700
legacy, and the honest way past it is more endings, not different thresholds.

### The rest

- **Money as a real route**: fees vs wages vs signing bonuses. Running a
  contract down is the wealth route's signature move — and it genuinely pays,
  because a move with no fee collects the free-transfer bonus.
- **Position-true stat lines**: a centre-back's season reads as clean sheets and
  duels, a keeper's as saves and goals conceded.
- **Twenty-five endings** from The Greatest to Nobody Called — a goalkeeper's
  career of clean sheets, a champion in three countries, a hundred caps, the boy
  wonder who never went further — plus a legacy score with a point-by-point
  breakdown behind an (i) on the summary, and the one season the career is
  remembered for named at the top of it.

  **The rarest ending that fits is the one shown**, never the first one listed.
  That used to be the other way round, which quietly hid rare outcomes behind
  broad ones: `serial_winner` was reached in 24% of careers and shown in 3%, and
  a player banned for doping who had won enough retired as *Serial Winner*
  because the ban sat below the honours in the array. `pnpm fairness` now plays
  5,000 careers under two policies and fails the build if an ending is
  unreachable or always swallowed.

### Monetisation: one ad, at the one moment that earns it

The game is free and ad-funded (IAA), and exactly one thing is gated: **play
again**. There is no ad between seasons, none on a decision card and none when
you quit a career you are not enjoying — interrupting a career in progress would
be selling the thing the game is for.

- **The first replay each day is free.** A player who has just finished their
  very first career is at the most fragile point in the funnel: they have
  decided they might want another and have not yet decided they like the game.
- After that: **5s, 10s, 15s, 20s, then 30s.** Escalation prices the tenth
  replay of an afternoon, not the second.
- **The ladder resets daily**, so coming back tomorrow is never punished.
- **Every ad past the floor is skippable at halfway, and skipping still grants
  the replay.** A rewarded ad that traps the player buys one angry session and
  no second one.
- **The reward is never withheld.** If the network is down, missing or throws,
  the replay is granted anyway.

**On a computer the ad is a panel, not a takeover.** It fills the game frame and
leaves the rest of the browser alone — a full-screen interstitial on a 27-inch
monitor is the single most hostile thing a free web game does, and a rewarded
slot gains nothing from it. `tools/verify-ui.mjs --desktop` fails the build if
the ad ever covers more than a third of the window. The honest limit: this
governs *our* creative; a signed rewarded-video network renders its video in its
own overlay and decides for itself how much of the viewport that takes.

`apps/web/src/lib/ads.ts` holds the policy and `AD_LADDER` is pinned by tests —
changing a number there is a change to how the game earns.

**The network is Google's H5 Games Ads**, through the Ad Placement API, in
`apps/web/src/lib/ad-adsense.ts` — it is the only product that serves rewarded
video to a plain web page with no native wrapper. It loads on `decisionfc.com`
and nowhere else: not on localhost, not on a branch preview, not inside the
itch.io iframe, because serving that script from a host outside the AdSense
account is a policy violation. Off-domain — and on-domain if the network is
down, missing or throws — the *creative* is the game's own house promo, and the
countdown, skip, ladder and reward are complete and real either way. What
switches a real video on is the H5 Games Ads opt-in inside AdSense, not
anything in this repository; `docs/monetisation.md` has the steps and the
story of the build variable that used to be step four and silently earned
nothing.

### It plays on a computer, as a computer game

The layout is built for a thumb and stays that way. What changes above 760px is
the *presentation*: the game becomes a 420 × 780 panel, centred, lit from above,
with the browser window as the room it sits in — rather than a 420px column
stretched down a 1080px window with four hundred pixels of black in the middle,
which is what it was and which read as a page that had failed to load.

- **Every overlay stays with the game.** One CSS property — a `transform` on
  `.app-frame` — makes the frame the containing block for `position: fixed`, so
  the sheets, the trophy celebration and the rewarded ad are confined to the
  panel without any of them knowing the panel exists. It is documented at length
  in `styles/app.css` because deleting it looks harmless and is not.
- **The number keys play the career.** `1` / `2` / `3` pick the decision on
  screen, and each row carries the key that picks it — shown only where there is
  a keyboard to press. Escape closes a sheet.
- **Hover, cursor and focus rings**, none of which existed: with a mouse, a game
  made entirely of buttons that never answer the pointer reads as disabled.
- **Scrollbars come back** where a fine pointer is present. A pane that scrolls
  and shows no bar reads as a pane with nothing more in it.
- **From 1040px the career screen is two columns**: the decision at a phone's
  width on the left, the career record standing beside it on the right and the
  honours shelf filling the space the table left behind. That is how a career is
  read on a computer — the question and the record in view at once, rather than
  the record hidden behind the card. The frame widens only for the screen that
  has a second column to put in it: the intro, the identity picker and the
  summary are composed for one column and stay at 420, because widening them
  would leave content in a 420px band with dead space beside it, which is the
  fault the frame exists to fix.

  `verify:desktop` asserts all of it — the frame widens on the career screen and
  nowhere else, the record column sits to the right of the decision and it is
  absent below the threshold.

### The share card carries a way back

The retirement screen renders the career onto a 1080×1920 canvas — the ending,
the headline numbers, the honours — and every asset it draws is generated in
code, because one cross-origin image taints the canvas and `toBlob` then throws.
Three things about it are load-bearing:

- **The site named at the foot of the card.** A card that travels without a way
  back is an advert for nothing. This was a QR in the bottom corner; I
  removed it — a phone that has just been handed a screenshot is not going to
  scan it, and the words say the same thing without taking a corner of the
  picture. `web/lib/qr.ts` keeps the verified matrix in case it comes back.
- **The surname is the player's call.** On by default, one tap off and the card
  is rebuilt rather than covered up, so what is saved is what is shown.
- **WeChat gets a data URL, everyone else an object URL.** WeChat's browser
  offers neither `navigator.share` nor a long-press menu on a `blob:` image, and
  long-press is the only way a card is shared there.

### The board ranks players, not positions

The achievements score used to pay for `goals × 3.2 + assists × 2.1`. A career's
median goals run from 264 at striker to 27 at centre-back, so on identical seeds
played identically a striker scored **3089** and a centre-back **1536** — while
that centre-back's actual career, 4,547 tackles, interceptions and headers won
and 202 clean sheets, scored nothing. Golden Boot belonged to forwards, Golden
Glove to keepers, and an attacking midfielder finished twenty seasons with zero
award points.

Output is now measured against **what that position normally produces**
(`OUTPUT_PAR`, regenerate with `pnpm par`): a par career is worth the same
everywhere and outplaying your position is what scores. Longevity counts
seasons near your *own* peak rather than above a flat OVR 80, which was quietly
paying positions whose rating formula runs higher.

**Playmaker of the Season and Defender of the Season are both gone** (my
decision, twice). They were the crude version of the same answer — position-only
awards bolted on because a creator, and then a centre-back, finished a career
with no individual honour at all — and the position-relative output term fixes
that for every position rather than for two. The honours are the three the real
world has trophies for, the Ballon d'Or, the Golden Boot and the Golden Glove,
and **one medal**: the league Team of the Season.

Position now decides **46%** of the achievements spread rather than 101% (1,000
careers a position; the gate's 250 read 37%), and `pnpm fairness --assert` holds
the line at 60%.

The deletion above is what took it from 47% to 55% when it was made: Defender of
the Season was worth 160 points a win, and taking it off the shelf took 20% off a
centre-back's median achievements score (2,575 → 2,061) and 8% off a full-back's.
The Golden Boot and the Golden Glove are still there, because they are real
trophies, so an attacker and a keeper still have a shirt-specific honour to win
and a defender does not. **This is an open question**, not a settled number. I
chose the medal by name, not its effect on the leaderboard, and closing the gap
again is a design decision: weight Team of the Season by position, pay defensive
output more against par or leave it and accept that the honours cabinet ranks
the way football's does. The remainder is left alone on
purpose: the transfer market genuinely pays more for goals, so a striker moves
to bigger clubs and wins more there. That is football, not a scoring artefact.
The whole audit — including the odds check and one leaderboard hole that is
*not* fixed — is `docs/fairness-review.md`.

### Three leaderboards, verified server-side

Achievements · career gross earnings · highest market value ever reached.

On retirement the client submits `seed + identity + decision list + claimed
scores`; the edge function replays the career through an identical, hash-pinned
engine and stores only what reproduces. The summary shows global rank and top
percentile for all three (with a local estimate as an offline fallback).

Merging anything that touches `packages/engine` or `packages/content` therefore
**redeploys that bundle automatically** — see `.github/workflows/deploy-edge.yml`
and handbook §3.3. A stale bundle rejects every legitimate submission. The
deploy proves the new bundle reproduces this repo's engine *before* pointing the
function at it, and rolls back to the last pin that answered correctly if the
live check then fails.

The other half of the same problem is on the client. A save is stamped with a
hash of the engine it is being played under, because a career begun before a
balance change and finished after it replays to different numbers than the
player watched happen — and the server would rightly reject a run nobody
cheated on. When the stamp does not match, the career still plays to its end;
the summary simply says it cannot be ranked globally, and the next one can.

### Who is on the board

**Since 2026-09-23 most of the field is simulated, and the simulation is
played by the engine that scores it.** The 566 careers scored
under the old rules — when a medal paid the same whether you played for it or
watched — were archived (`bg_runs_archive`) and removed, because a career
finished today was being ranked against inflated history, and re-scoring them
by replay was measured and does not work (5% of old decision lists survive a
rules change). The real careers scored by the current rules stayed.

In their place, `tools/seed-boards.ts` plays careers through the live engine
and writes them the way the edge function would, with `seeded = true` so they
can always be counted, filtered or removed without touching a real player's
row. Two things keep it honest:

- **The field is shaped like the real players.** Pace, position, archetype and
  nationality weights are what the real careers since the scoring change
  actually chose — three in four on Deep, overwhelmingly attackers — and the
  careers are played by the same policies `pnpm skill` measures, with a human
  amount of noise and a card-reader for the event cards. Its median
  achievements score sits between real players trying the game (Standard,
  ~1,700) and the handful of regulars replaying Deep (~3,300). Measured on the
  live board the day it was seeded: a typical first career ranks in the top
  68% — the lower half, as it would among the real players alone — and a
  regular's in the top 32%. Nobody is flattered.
- **The daily board climbs from midnight.** Every day gets five to ten
  daily-challenge careers, each stamped with a moment in that day weighted to
  waking hours, and `bg_ranks` only counts a row once its moment has passed. So
  at 00:00 UTC today's daily board is empty and it fills through the day, like
  a real one.

`.github/workflows/seed-boards.yml` runs it every six hours, writing today and
tomorrow. Every slot is one row for ever — its id is a hash of the day and the
slot — so a late, doubled or skipped run changes nothing, and it refuses to
seed at all unless the bundle the server is running is the one this commit
builds. See `packages/backend/sql/003-…` for the column, the clock and the
archive.

**Until 2026-09-23 the board could not store a Quick career.** The table's
check still named the pace by its old name, `blitz`, so every Quick career
passed the replay and was then refused at the insert, and the player's summary
fell back to its local estimate without a word. The seeder's first insert hit
it. `sql/004` fixed the check and `schema.test.ts` now holds the database, the
edge function and the engine to one list of paces. It is also why the real
field has no Quick careers in it: not a preference, a refusal.

### When something goes wrong

The whole game is one `localStorage` key, so a crash that depends on the saved
career recurs on reload and the game is permanently a blank page. An error
boundary sits outside every provider with two buttons — reload, and discard this
career — because the second one is the only thing that fixes that case.

## Balance acceptance numbers

From `pnpm balance` (20,000 random-play careers, standard pace). These are
**acceptance criteria, not observations** — if a change moves one, either the
change is wrong or the target needs a new decision from me.

| Check | Target | Current |
|---|---|---|
| Starting OVR at 16 | median 50 (the growth table's anchor) | p10 48, p50 50, p90 53 |
| Peak OVR median | 79–83 | 81 |
| Peak OVR ≥ 90 | 3–8% of careers | 4.96% (band runs to 8 for the 1,500-career CI smoke) — down from 6.51 because development now costs a player who does not play; see `minutesGrowthMultiplier` |
| GOAT ending | < 0.65% of careers | **0.345%** (0.355% before the tactical-fit guarantee of 2026-09-23 reshuffled the windows) — my target of ≈0.35%. The trophy-share and minutes changes had pushed it down to 0.25% by taking a tenth off every legacy score; on 2026-09-23 the score bar came down by the same tenth (6,000 → 5,300) and nothing else moved: 21 careers in 20,000 went from Ballon d'Or Winner to GOAT, and every score distribution is identical. The award condition alone caps the rate at 0.40%. The 1,500-career smoke can read 0.0 here — at this rarity that sample sees five careers either way. |
| Endings no career can reach | 0 | 0 of 25 (`pnpm fairness`, 5,000 careers) |
| The two most common endings, combined | ≤ 30% of careers | 33.8% — `solid_pro` 21.3% and `centurion` 12.5%, down from 44.9%. Not met: `solid_pro` is the floor for any career worth 700 legacy, and the only way past it is more endings rather than different thresholds. |
| Endings under 0.5% of random-play careers | only the ones meant to be lottery-rare | `one_club_legend` 0.00%, `homegrown` 0.17%, `frozen_out` 0.28%, `goat` 0.34%, `boy_wonder` 0.43%, `serial_winner` 0.45%. The first two are reached by *choosing* to stay — never signing elsewhere, never signing abroad — and a sweep that answers at random moves clubs every few seasons, so it is the wrong instrument for them entirely. That is why `pnpm fairness` plays a loyal policy as well as a random one, and both of them are reachable there. |
| Highest career goals | < 800 (plausibility) | 548 |
| League titles per league-season | ≈ 1 | 0.85 (asserted in tests) |
| Elite continental cups per confederation-season | ≈ 1 | 0.85 (asserted in tests) |
| Trophies per career | p50 ≤ 4 | 2 — the 26/27 trophy field is deeper, so silverware is scarcer |
| Age a career peaks at | 26–30, and visibly different per player | p10 25, **p50 28**, p90 30 |
| Retirement age | never before 35 | p10 35, p50 37, p90 38 |
| Careers where a club the player was at changed division | the pyramid has to move under him | 87% — was 44% while reputation 70+ made a club unrelegatable; standing-based rates put promoted sides in the fight they are really in |
| Careers with a loan spell | the loan is a chapter, not a coin flip | 95.3% (asserted) |
| First senior loan in a big-five top flight | 0 — the first one is always the second tier | 0 (asserted in tests) |
| Deliberate play beats unambitious | it is not a luck game | 63% of 1,600 seeds (`pnpm skill`, gate ≥60%) — the best deliberate policy is `shrewd`, and it beats random play on 70% |
| Share of the visible range the player controls | choice against luck | 30% (`pnpm skill`; 29% before the tactical-fit guarantee of 2026-09-23) — **the September review's 40% target was not met**; see the note under this table |
| The best deliberate policy | reading a role, not chasing a badge | **shrewd** beats `ambitious` on legacy, earnings and peak value (`pnpm skill`) — it was the other way round until the trophy-share and minutes changes |
| Achievements spread across the ten playable positions | the board ranks players, not positions | 46% over 1,000 careers a position, 37% at the gate's 250 (gate ≤60%), was 101% (`pnpm fairness`) |
| Gambles whose realised odds miss the printed number | 0 of 36 | 0 (`pnpm fairness`); pooled over all 41, +0.2 points (z = 0.68, gate ≤3σ), with the 2.7% of rolls the mercy rule forced left out |
| Careers that see four red gambles in a row | 0 — the mercy rule | 0 of 2,500; the longest run is 3 (`pnpm fairness`) |
| Card outcomes the engine cannot produce | 0 | 0 (`pnpm fairness`) |
| Options that do not do what the card said | 0 | 0 of 6,552 (`pnpm fairness`) |
| Cards that are not a decision (one option, or four) | 0 | 0 of 8,625 (`pnpm fairness`) |
| Transfer windows with nobody to join | 0 | 0 (`pnpm fairness`, asserted in tests) |
| Season rating for a forward at 0.4–0.55 goals+assists a game | ≈7.0, a good season | 7.12 |
| Mean peak OVR spread across the three paces | < 3 points | 1.66 (`tools/pace.ts`, 2,500 paired seeds a pace) |
| Windows with >1 spin-off club | 0 | 0 |
| Spin-off shown to a wanted U28 | 0 | 0 |
| Big-five top flight beside a second division in one window | 0 | 0 (asserted in tests) |
| Offer-realism rules failing over 500 played careers | 0 of 15 | 0 (`pnpm market`) |
| Offer cards where one option beats every other on stature, role and wage | as few as the market honestly allows | 15%, was 30% (`outbids`) |
| Portugal/Netherlands/Belgium offers from outside their top two standings | 0 from the market | 0; the remainder are loans |

These are **random-play** numbers — every card answered arbitrarily — so they are
the floor, not the ceiling.

### The one target that was missed, and why it was not forced

The September review asked for two things of `pnpm skill`: that reading a squad
role should beat chasing the biggest badge, and that the player should control
40% of the visible range rather than 29% (30% today).

The first is done, and it was the substantive one: `shrewd` now beats
`ambitious` on all three boards. The second has barely moved (29%, now 30%), and that is a
deliberate stop rather than a failure to try.

The number is the spread between policies divided by the spread between seeds.
Raising it means widening the first or narrowing the second. Widening it means
making bad play *much* worse — a punishing game, and the review explicitly did
not ask for one. Narrowing the second means making careers resemble each other,
which is the variety the whole event deck exists to produce. Both trades cost
more than the number is worth, so the number stays and the ordering is what got
fixed. If I want 40%, it is a design decision about how punishing the
game should be, not a tuning pass.

`pnpm market` is the complementary check, and the one that catches "this offer
makes no sense". It plays 500 careers *from the player's seat* — taking the best
thing on the table most of the time — and checks every offer against fifteen
rules: wage bands, signing-bonus scale, contract length against age, release
clauses, promised role against ability, whether the clubs in one window belong to
the same football world and whether the bigger club actually pays more. Every
one of the first fourteen failed when first written; the failures are documented
at the rule that now enforces them.

Player types are held to the same standard and measured the same way (420
careers each, all ten playable positions): retirement legacy within 0.7% and gross
earnings within 1.7% across speed, technical and physical, while peak ability by
22 stays ~2.5 points apart. See `ARCHETYPE_TILT` in `engine/model/growth.ts`.

**Pace is a length setting, and mostly not a difficulty setting.** Quick (a card
every two seasons), standard (one a season) and deep (two a season) serve the
same deck at different rates, so a card's lasting consequences are weighed
against the rate it is served at (`PACE_EFFECT_SCALE` — a +4 on quick is a +6.4,
a +4 on deep is a +3.4 that arrives more often).

**Deep is still about a point and a half ahead, and these docs said 0.12
until it was re-measured.** `npx tsx tools/pace.ts` over 2,500 paired seeds per
pace puts quick on 80.62, standard on 80.85 and deep on **82.28** peak ability,
and deep 12% clear of standard on the legacy median. The unit test could not
see it: 150 careers a pace is not enough resolution for a gap that size, so it
passed for as long as nothing widened the per-player spread.

The cause is structural, not a constant that wants nudging. Deep deals three and
a half times as many cards as quick; most cards are worth taking; and the things
that carry the advantage — a rung of squad standing, a season's silverware odds
— are season-bound, which is exactly what `scaleEffectToPace` is written *not*
to touch. What it does scale is floored at ±1 so that a card can never round
away to nothing, which is why taking the deep scale from 0.95 down to 0.72 moved
peak ability only from 83.1 to 82.3. 0.86 is what the discount can honestly buy.

Closing the rest means changing what a pace *is* — dealing deep a shallower deck
rather than the same deck cheaper — and that is a design decision, not a
tuning one. It is written down here rather than hidden behind a bound nobody
reads.

Note that `PACE_DECISIONS` genuinely drives the cadence now. It did not until
this was re-timed: `cardsForSeason` hardcoded a stride of three for any rate
below one, so the constant was decorative and quick saw 7.2 cards a career
whatever it said. It sees 10.7 now. The residual on the legacy board is not
ability: a pace that offers fewer cards also offers fewer chances to leave a
club (the loyalty bonus) and fewer chances to accept a doping ban. Both are
choices, so they stay.
