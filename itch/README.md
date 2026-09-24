# Upload folder — itch.io

Everything in this directory is meant to be uploaded to itch.io by hand. It is
generated: `pnpm build:itch` writes the zip, `node tools/itch-assets.mjs` writes
the cover and the screenshots. Regenerate both after any change worth
re-publishing — see `docs/itch-io.md` for how the build differs from the one
that goes to decisionfc.com, and why.

| File | What it is |
|---|---|
| `decision-fc-itch.zip` | The playable build. `index.html` is at the root of the archive, which is where itch looks for it. |
| `cover.png` | 1260×1000, i.e. itch's 630×500 cover at 2×. This is the image every browse list and tag page shows. Drawn around `cover-shot.png`, a career of its own — a different player from every screenshot. |
| `cover-shot.png` | The summary screen inside the cover. Not for upload; kept so the cover can be redrawn. |
| `screenshots/*.png` | Phone screenshots, 1206×2622: an iPhone 17 Pro's whole screen at its real pixel ratio, emulated in Chromium as an installed home-screen app with the safe areas iOS 26 reports (62pt Dynamic Island, 34pt home indicator) rather than faked in CSS. Each language is the best of up to eight real careers — peak ability, trophies and awards decide which one is photographed; nothing on screen is edited. `zh-` prefixed ones are the same screens in Chinese. Regenerated 2026-09-23. |

Suggested gallery order: `6-career`, `7-summary`, `4-offer`, `5-odds`,
`1-start`, then `zh-6-career` to show it is bilingual. Six is plenty; itch
shows the first few and hides the rest behind a scroll.

---

## Filling in the project page

**Dashboard → Create new project.** Field by field:

| Field | Value |
|---|---|
| **Title** | `Decision FC` |
| **Project URL** | `decision-fc` |
| **Short description / tagline** | `Twenty seasons of a footballer's career, one decision at a time. Free, in your browser, in four to eleven minutes.` |
| **Classification** | Games |
| **Kind of project** | HTML |
| **Release status** | Released |
| **Pricing** | No payments |
| **Uploads** | `decision-fc-itch.zip` — then **tick "This file will be played in the browser"** |
| **Embed options** | Manual size, **420 × 780**. Tick *Mobile friendly* and *Fullscreen button*. |
| **Genre** | Simulation |
| **Tags** | `football` `soccer` `sports` `career` `simulation` `text-based` `singleplayer` `mobile` |
| **Links** | `https://decisionfc.com` |
| **Community** | Comments on |
| **Visibility** | Draft first. Play it through once in the embed, then Public. |

The one that people get wrong: **"This file will be played in the browser"**.
Without that tick there is no Play button and the page offers a zip download
instead.

420 × 780 is the game's own frame size, so the embed matches what the game
composes itself for. It is playable at other sizes, but that one wastes no
space.

---

## Page description

Paste this into the description box. The first sentence carries the name and the
URL on purpose — an itch page that names the game and links its home is how
"Decision FC" starts being a proper noun to a search engine rather than two
ordinary words.

> **Decision FC** (decisionfc.com) is a football career simulator you play
> entirely through decisions. You are the player, not the manager.
>
> Start at sixteen. Pick an academy, fight your way into the side, go out on
> loan and come back wanted. Then choose, season after season: the move that
> makes you or the move that pays you, the country you represent, the contract
> you sign, the year you finally stop. Twenty seasons take four, six or eleven
> minutes, at the pace you pick.
>
> - **191 real clubs** in twelve countries — England, Spain, Italy, Germany and
>   France at two levels each, plus Portugal, the Netherlands and Belgium. Saudi
>   Arabia, the USA, Japan and China turn up late in a career, when a move for
>   money actually belongs.
> - **Your place in the side is earned.** Six squad roles, from fringe player to
>   the team being built around you, decided by ability against that club's
>   standard rather than by a dice roll — and the game shows you how far off the
>   next rung you are.
> - **Not a luck game, and that is measured.** Playing well returns a median
>   career score of 1991 against 1585 for playing at random, and wins on 70% of
>   identical starting positions.
> - **Free, no account, nothing to install.** Works on a phone or a computer.
> - **English and 简体中文** — the Chinese version is a rewrite, not a
>   translation.
>
> Three world leaderboards — achievements, career earnings and highest transfer
> value — and a daily challenge that gives everybody the same football world for
> a day. Both live at **[decisionfc.com](https://decisionfc.com/)**, which is
> also where the newest build always is.

---

## After it is public

1. Post a **devlog** from the project page. It goes into itch's own feed and it
   is a second page carrying the name.
2. Add the itch link back on decisionfc.com so the two point at each other.
3. Nothing else. Do not re-upload for a copy change; re-upload when there is a
   reason for somebody to play it again.

## What this does not do

**No ads run on itch, and no money comes from it.** The AdSense tag only loads
on `decisionfc.com` — `apps/web/index.html` checks the hostname before it loads
anything — so the itch build serves no ads at all. That is deliberate and it is
also what keeps it safe: serving AdSense from a host that is not in the AdSense
account is a policy violation. Never "fix" this by removing the hostname check.

itch's own revenue share applies only to money collected through itch, and this
game is free, so it does not apply either. What itch gives is players and a page
with the name on it. The funnel to the site is the line under the title on the
start screen, the link in the description and the `decisionfc.com` stamp on
every shared career image.

Leaderboard submissions from itch **do** count: it is the same game and the same
server-side replay check, so a career played there is ranked with everyone
else's.
