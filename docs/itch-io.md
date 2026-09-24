# itch.io

The game is published in two places from one source: **decisionfc.com**, which
is the product, and **itch.io**, which is a shop window. This file is why the
second one needs its own build at all, what that build changes, and how to
regenerate everything the page is made of.

The page copy and the field-by-field values live next to the files themselves,
in [`itch/README.md`](../itch/README.md). This document is the engineering half.

## 1. Why itch, given it earns nothing

It earns nothing on purpose. The AdSense tag in `apps/web/index.html` loads only
when `location.hostname === 'decisionfc.com'`, so the itch build serves no ads,
and that is the right answer twice over: it is what makes publishing there safe
(AdSense may only serve on a host registered to the account) and it is one less
thing to keep working on somebody else's page.

What itch gives instead:

- **A page carrying the name.** On 2026-08-06 the site was indexed and ranking
  first for `decision fc game`, and returning nothing at all for `decision fc` —
  because Google had no evidence that those two words were a proper noun. An
  entity is built from what *other* sites say, and this is the cheapest honest
  place to start (see `docs/seo.md` §8).
- **Players who are already looking.** itch is where "free browser game" is
  searched, and a five-minute career is exactly what that search wants.
- **Somewhere to point at.** A Reddit post or a Bilibili description reads
  differently when the game has a page on a platform people know.

Leaderboard submissions from itch are accepted and ranked normally. It is the
same engine and the same server-side replay check, so there is nothing to gate:
one game, one board.

## 2. What the itch build changes

`ITCH_BUILD=1` (via `pnpm build:itch`) is the whole switch. Everything below is
the same source as the site.

itch unpacks an uploaded zip into a numbered directory and serves it from
`html-classic.itch.zone/html/<id>/`, inside an iframe on the project page. Two
consequences, and both fail as a white screen rather than an error:

| | |
|---|---|
| `base: './'` | Every URL Vite writes — the bundle, the stylesheet, the icons, the `@font-face` sources — becomes relative. A leading slash would point at the root of itch's host. |
| `asset()` (`src/lib/assets.ts`) | The URLs Vite *cannot* rewrite, because the app builds them at runtime from a club or trophy id. It prefixes `import.meta.env.BASE_URL`, so production is byte-for-byte what it was. |
| `__ITCH__` in `lib/i18n.tsx` | The language switch writes `/zh/` into the address bar on the site. On itch that address bar is itch's, and the path does not exist there — a reload would land on their 404. So the switch stands down and the stored preference carries the language instead. |
| `__ITCH__` in `screens/Intro.tsx` | Adds one line under the subtitle linking to decisionfc.com. It is the only funnel the embed has: no address bar of its own, and the world leaderboards cannot follow it there. |
| `scripts/build-itch.mjs` | Strips what belongs to a site rather than to a game — canonical, `hreflang`, Open Graph, JSON-LD, the Baidu ownership tag, the AdSense loader, the manifest, `robots.txt`, `sitemap.xml`, `llms.txt`, `ads.txt`, the IndexNow key — absolutises the two boot-screen links, and zips it. |

The canonical is the one that would do real damage if it were left in: it tells
a crawler that a document on itch's host **is** decisionfc.com, which is how a
duplicate gets flagged rather than a rank shared.

`build-itch.mjs` asserts every edit. If the markup moves and a pattern stops
matching, the build fails and names what it could not find — the alternative is
a zip that silently 404s halfway down, which nobody notices until a stranger
says the game is broken.

## 3. Regenerating everything

```bash
pnpm build:itch            # → itch/decision-fc-itch.zip
node tools/itch-assets.mjs # → itch/cover.png, itch/screenshots/*.png
```

`tools/itch-assets.mjs` does three jobs because all three need the same setup:

1. **It serves the build from a nested path** — `/html/2846120/`, a directory
   number nobody has ever seen — and watches every response. A leftover absolute
   URL is a 404 there and nothing at all in local testing, because locally the
   game *is* at the root. Any 404, any console error, any screen that scrolls,
   and it exits non-zero.
2. **It photographs a whole career** on a real iPhone viewport at a real pixel
   ratio, with the safe-area insets a notched phone reports (`--safe-top` /
   `--safe-bottom` are overridden, because a headless browser reports zero and
   the game fits its screen exactly). What is not faked is the status bar: these
   are the game's own pixels, with no drawn-on clock.
3. **It draws the cover** last, around the summary screenshot, so the thumbnail
   shows a finished career rather than a sentence.

Run the second command whenever the first one changes anything visible. A
screenshot of a version that no longer exists is the same failure as a stale
README.

## 4. What is checked in, and what is not

`apps/web/dist-itch/` is ignored, like `dist/`. `itch/` **is** tracked — the zip,
the cover and the screenshots — because they are handed to a person who uploads
them, not to a machine that rebuilds them. That is the one place in this
repository where build output is committed, and it is a deliberate trade: about
10 MB, against my being able to download the exact files from GitHub on a
phone.

## 5. Keeping the two in step

The itch build lags the site by whatever is not re-uploaded, and there is no
automation for it: itch's API (`butler`) is not wired up, and a deploy that
silently republished a game page would be worse than one that did not.

So: re-upload when there is a reason for somebody to play again — a new mechanic,
a balance pass, a fixed bug they would have hit. Not for a copy fix. When you do,
regenerate both the zip and the screenshots in the same pass, and post a devlog
saying what changed.
