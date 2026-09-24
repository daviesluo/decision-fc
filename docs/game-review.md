# Game review — functionality, logic, interaction, coherence

`docs/codebase-review.md` reviewed the repository. This one reviews the *game*: whether each
system does what it says, whether the rules agree with each other, whether the
screens behave consistently, and whether the interface is one thing rather than
several.

Everything below was checked against running code. Where a claim has a number
on it, that number came from a probe over hundreds of careers, not from reading.

---

## 1. Rules that do not do what the code says they do

### 1.1 The academy contract is three years, and it cancels the loan chapter ⚠️

`ACADEMY_CONTRACT_YEARS = 4` exists, carries a long comment explaining exactly
why the first youth deal has to be four years, and is **not used by the academy
card**. The academy decision is handled by `applyAcademy`, which hardcodes
`yearsRemaining: 3`; the constant is only read by the offer-less branch of
`applyTransfer`.

The comment is right about the consequence, so this is worth quoting:

> Two meant his contract ran out at eighteen, which is both wrong and the exact
> age the loan window opens: a deal with one year left cannot be loaned out (see
> `LOAN_MIN_CONTRACT_YEARS`), so the short academy contract was quietly
> cancelling the loan chapter as well as producing an expiry card.

Three years does the same thing, one year later. Signed at 16 with three years:
after the season at 16 there are two left, after 17 there is one — and at 18,
the first year the loan window is open, `LOAN_MIN_CONTRACT_YEARS` (2) refuses
it. A loan at 18 can only happen to a player who has already transferred and
picked up a normal 4–5 year deal.

Measured over 600 standard-pace careers, random play:

| | careers with a loan | loan seasons at 18 | at 19 | at 20 |
|---|---|---|---|---|
| today (3 years) | 43.3% | 17 | 28 | 122 |
| with `ACADEMY_CONTRACT_YEARS` (4) | 71.7% | 313 | 166 | 27 |

So the loan is currently a *twenty-year-old's* move. It was designed as an
eighteen-year-old's first move, and the rule I set — "the first
loan at 18 offers only big-five second-tier clubs" — is written and almost never
fires.

**Fix:** use the constant in `applyAcademy`. But note the second column: the
one-line fix takes the loan rate from 43% to 72% of careers, which is a balance
change and probably wants `loanWindowOdds` pulled down to land somewhere
deliberate. That is a design decision, to be made on purpose rather than as a
side effect.

### 1.2 Offer cards print the manager the club had at kick-off

`DecisionPanel`'s `safeClub` resolves through `INDEX` — the world as it started.
The panel already knows this is wrong for divisions; its own comment describes
fixing exactly that bug and the league lookup does go through `indexFor(state)`.
The manager was missed.

`indexWorld` applies `managerChanges` inside `club()`, so `indexFor(state).club(id)`
returns the current manager and `INDEX.club(id)` returns the original. Tactical
fit — which decides the squad role and therefore the wage printed on the same
row — reads the current one. So the card contradicts itself.

Manager changes are only ever recorded for the club the player is at, which
means this shows up on the rows that name that club: **stay**, **run the
contract down**, and **go back to your parent club** after a loan.

Measured over 300 careers: 1,086 option rows named a club whose manager this
career had changed, and 1,028 of them (94.7%) printed the wrong style.

**Fix:** one line — resolve through the career's index, keeping the `try/catch`
for ids the roster no longer has.

### 1.3 The daily challenge is not the same challenge

`lib/daily.ts` opens by promising:

> Everybody who plays today gets the *same* career: the same starting
> attributes, the same academy offers, the same event deck in the same order,
> the same clubs calling in the same windows. Only the decisions differ.

Half of that holds. Checked directly on `daily-2026-07-29`:

- **Academy offers are shared** — Blackburn, Bournemouth, Brentford for every
  pace and every identity. Good.
- **Starting attributes are not.** They are a function of position and player
  type, which the player chooses: 52 OVR as a technical ST, 48 as a physical GK,
  51 as a pace CB, with entirely different attribute spreads.
- **The deck is not.** `IntroScreen` passes whatever pace is selected, and pace
  changes both how many cards a season deals and how far each effect is scaled.

So it is the same *world*, not the same career, and two players comparing
results are not comparing like with like.

**Fix, either way round:** pin the daily to one pace (and if it is meant to be a
true head-to-head, one position and type as well), or rewrite the promise so it
says what it delivers — same world, same cards, your player and your calls. The
second is cheaper and still a good mode; the first is what a leaderboard would
need.

---

## 2. Interaction

### 2.1 Reduced motion removes the moment, not just the movement

With the setting on, `Career.tsx` skips the celebration overlay **and** the
relegation overlay entirely. Winning the Champions League or the Ballon d'Or
produces nothing but a new row in the table.

The code says why that is wrong, two lines above the check that causes it:

> An individual award is as big a night as a trophy — the Ballon d'Or used to
> land as a small star in a table row and nothing else.

Reduced motion should cut the animation, not the announcement. **Fix:** render
the overlay without the burst particles and with a tap-to-dismiss instead of a
timer.

### 2.2 The OS reduced-motion preference is ignored, and the CSS misses the worst offenders

`DEFAULTS.reducedMotion` is `false` and nothing reads
`matchMedia('(prefers-reduced-motion: reduce)')`. A player who has set it
system-wide still gets the full 2.3-second roulette on every gamble.

The stylesheet does have a `prefers-reduced-motion` block, but it only resets
`.animate-rise`, `.animate-pop` and `.stagger > *`. The two strongest animations
in the app are not in it:

- `.roulette-0` / `.roulette-1` — `roulette-flash 400ms linear **infinite**`,
  a 2.5 Hz strobe on the decision card, which is precisely the kind of thing the
  media query exists for;
- `.burst-particle` — the celebration burst.

**Fix:** seed the setting from `matchMedia`, and add both classes to the media
query so the CSS is right even before the setting is read.

### 2.3 Switches are not switches

`SettingsSheet`'s `Toggle` is a `<button>` drawn to look like a switch, with no
`role="switch"` and no `aria-checked`; `Choice` (currency, language) has no
`aria-pressed`. A screen reader announces "Show odds, button" and gives no way
to know whether it is on. Three attributes fix all of it.

### 2.4 Running the contract down does not say what it costs

`runout` sets `yearsRemaining: 1` unconditionally. It is only offered
mid-contract, so a player who has just signed a five-year deal and takes it is
tearing up four years. The card says "Leave for nothing next summer — and take a
much bigger bonus with you", which is true and is only half of it.

This got sharper with the recent move to longer contracts: the deals that are
now common are exactly the ones with the most to give up.

**Fix:** say it — "your deal ends next summer" — or make the option only appear
in the last two years of a contract, where the fiction is honest without extra
copy.

### 2.5 A contract in its final summer reads "0y"

`career.contractYears` is `'{years}y'`, and the transfer window opens when
`yearsRemaining <= 0`, so the header prints "0y" for the whole time the expiry
card is on screen. Technically true, reads like a rendering fault. A "final
year" or "expiring" label costs one key.

---

## 3. Coherence and consistency

### 3.1 A system glyph sits directly above two hand-drawn icons

`IntroIcons.tsx` exists because system emoji were the wrong texture for the
daily-challenge and rankings cards. Two rows above those cards, the settings
button is a raw `⚙`, and `PlayerHeader` uses the same glyph mid-career. It is
the same problem the icons were drawn to solve, in the same viewport.

### 3.2 Flag emoji do not exist on Windows

`flagOf` builds regional-indicator pairs. Windows ships no flag glyphs at all,
so Chrome and Edge on desktop render "BR", "AR", "JP" as letter boxes, and the
England/Scotland/Wales tag sequences as a bare black flag. That affects the
country picker, the career table, the summary — and `shareCard.ts`, which draws
the flag into the 1080×1920 image that is the game's main growth surface.

Mobile is fine, which is where the players are. Worth knowing rather than urgent.
An SVG flag set, or dropping the flag in favour of the three-letter code, both
solve it.

### 3.3 Small inconsistencies

- The same settings button is labelled `settings.open` in `PlayerHeader` and
  `settings.title` on the intro screen.
- The settings sheet labels its own language section with `intro.language`.
- `CareerScreen` declares a `league` prop, `App.tsx` passes it, nothing reads it.
- The intro screen has an EN/中文 toggle *and* a language section inside its own
  settings sheet, one tap apart. Defensible — the inline one is what a first-time
  Chinese visitor needs — but it is two controls for one setting in one view.

---

## 4. What is genuinely solid

Worth writing down, because a review that only lists faults misrepresents what
is there.

- **The squad ladder.** Role follows ability through one function with a hard
  cap, the header shows the exact distance to the next rung, and the market
  audit proves no season ever hands out a place ability could not earn.
- **Offer coherence.** 14 rules over 500 played careers, all holding: wages,
  bonuses, contract lengths, promised roles, and whether the clubs in one window
  belong to the same football world.
- **The world moving under the career.** Promotion, relegation and manager
  changes are recorded against the career rather than the shared world, which is
  the right design; §1.2 is a missed *read* of it, not a flaw in it.
- **The reveal.** Odds printed are odds rolled, and the engine's purity is what
  lets the UI show the real outcome before committing to it.
- **The copy.** Chinese is a rewrite, not a translation, and it reads like it.

---

## 5. What was done

All twelve, plus two rules I added on reading this. Numbers are measured
after the change, not predicted.

| # | Change | Note |
|---|---|---|
| 1.1 | Academy contract reads `ACADEMY_CONTRACT_YEARS` | Loans now reach **90.3%** of careers, 71% of them first at seventeen. It was 43%, almost never at eighteen |
| 1.2 | Offer cards resolve the club through the career's index | The stay/run-down/return rows print the manager the engine is actually using |
| 1.3 | Daily challenge pinned to one pace, and its promise rewritten | It shares the world; the player and the decisions are yours. The copy now says that, and a test holds both halves |
| 2.1 | Reduced motion keeps the celebration | Particles and the timer go; the trophy, the award and the relegation moment stay, tap to dismiss |
| 2.2 | Setting seeded from `prefers-reduced-motion`; CSS covers the strobe and the burst | The 2.5 Hz roulette flash was the one animation the media query most needed to catch, and was the one it missed |
| 2.3 | `role="switch"` / `role="radio"` on the settings controls | |
| 2.4 | Running the deal down says it ends next summer whatever is left | |
| 2.5 | "Final year" instead of "0y" | |
| 3.1 | Settings icon drawn | The last system glyph in the interface |
| 3.2 | Flags fall back to a country code where the platform has no flag glyphs | Detected by measuring, once, rather than by sniffing a user agent. Fixes desktop Windows and the share card |
| 3.3 | aria-label unified, `settings.language` added, the unused `league` prop removed | |

### Two rules I added, and one bug they uncovered

**The loan is a ladder, and it is walked by nearly every career.** The old
30%/70% coin is gone: a young player short of a place is offered the move.
Seventeen goes out at home — the country his *club* plays in, not his
passport, which is what had been silently excluding every Brazilian, Argentinian
and Japanese player. The first senior spell is always the big five's second tier
(0 exceptions in test). From the second spell a bottom-half big-five top flight
opens, and it is earned rather than granted: median ability at each rung runs
55 → 69 → 73, because the destination filter has always required a club that
would actually start him.

**Building it surfaced a card that lied.** The destination filter used a private
bonus worth up to seventeen rating points while the season capped the role at
what raw ability earned, so "Regular Starter — you would start every week"
resolved to impact-sub seasons. Both now go through one function,
`roleCapOnLoan`, bounded at two rungs — the same total the squad ladder already
allowed anyone else — and a test asserts the card's promise *is* the season's
ceiling rather than merely resembling it.

**"It is not a luck game" is now a measured claim.** `pnpm skill` plays the same
seeds five ways and separates the two: how far apart careers land under one
policy (luck) against how far apart one career lands under different policies
(choice). Ambitious play returns a median legacy of **1935 against 1290** for
unambitious and **1450** for random, wins on **74%** of seeds, and choice
accounts for **30%** of the range a player can see. `--assert` holds those
floors so a future change cannot quietly hand the career back to the dice.

Worth saying plainly: the best policy is currently a simple one. Chasing the
biggest club beats reading the squad role against your own ability, which means
the skill *ceiling* is shallower than the skill *floor* is deep. Making
over-reaching cost more is the obvious next lever, and it is a design decision
rather than a bug.

## 6. Suggested order (original)

| # | Change | Effort | Why |
|---|---|---|---|
| 1 | Academy contract → `ACADEMY_CONTRACT_YEARS`, retune `loanWindowOdds` | S+balance | An entire designed chapter barely fires |
| 2 | Offer cards read the career's index for the club | S | 95% of affected rows print a manager the engine is not using |
| 3 | Decide what the daily challenge is, then make the code and the copy agree | S–M | It currently promises a fair contest it does not run |
| 4 | Reduced motion: keep the moment, drop the movement | S | A trophy currently vanishes for these players |
| 5 | Seed reduced motion from the OS; add `.roulette-*` and `.burst-particle` to the media query | S | The strobe is the one animation that most needs it |
| 6 | `role="switch"` / `aria-pressed` on the settings controls | S | Three attributes |
| 7 | Say what running the contract down costs | S | Longer contracts made it a bigger decision |
| 8 | "Final year" instead of "0y" | S | One key |
| 9 | Draw a settings icon | S | Finishes the job `IntroIcons` started |
| 10 | SVG flags, or three-letter codes | M | Desktop Windows and the share card |

1 and 2 are the two that change what the player experiences. 3 is a design
decision before it is a code change.
