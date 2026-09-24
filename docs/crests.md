# Real Club Crests

**The repository ships 191 real crest PNGs** in `apps/web/public/crests/`, and
real trophy images in `apps/web/public/trophies/` (§4). Club crests and trophy
designs are trademarks of their respective owners and are used with
permission. They are not licensed by this repository's `LICENSE`.

The renderer needs no manifest: **drop a correctly named file in the folder and
that club shows it; delete it and the club falls back to a generated badge.**
A half-populated folder never produces a broken image.

**You still drop in a PNG. The site serves WebP.** The crests and trophies are
already at their display size (128px and 192px, via `tools/shrink-images.mjs`)
and were still 4.4 MB of a 6.7 MB published site. The same pixels as WebP at
quality 90 are 1.5 MB, measured across all 217 files — a 65% cut and the
largest thing left in a cold load on a phone, which took `dist` to 3.5 MB and
the itch.io zip from 5.3 MB to 2.0 MB.

One step is added to the workflow above, and it is the same step the artwork
already needed: **after dropping files in, run `node tools/shrink-images.mjs`.**
That tool has always resized the art to its display size; it now also writes a
`.webp` twin beside each PNG, and **both are committed.**

`apps/web/scripts/build-crests.mjs` then checks every PNG has a twin and
deletes the PNGs from the build output, so nothing ships twice, and
`lib/assets.ts` rewrites the extension at the single place every artwork URL is
built. The app asks for `.webp`, the repository keeps both, and neither
`tools/crests.mjs` nor the paragraph above had to learn a delivery format.

**Forgetting the tool is loud, not silent.** A PNG with no twin fails the
build, because the alternative is worse than a broken image: a crest the site
cannot serve becomes a generated badge, so the game would look perfectly fine
with every real badge quietly gone. It is not a 404 that triggers the fallback,
either — Cloudflare serves this site with the single-page-application fallback,
so a missing file answers **200 `text/html`** (checked against the live site)
and the browser falls back because it cannot decode the index page as a
picture.

**The conversion is deliberately not part of the build.** It was, for one
commit, through Chromium's canvas — which made the production build depend on a
browser that the Cloudflare deploy does not install. Four deploys went red in a
row while the live site sat on a stale version. A hand-run tool may need a
browser; a deploy may not.

---

## 1. Where files go

```
apps/web/public/crests/<club id>.png
```

Examples:

```
apps/web/public/crests/man-city.png
apps/web/public/crests/real-madrid.png
apps/web/public/crests/al-hilal.png
```

**Requirements**
- Format: `.png` (recommended, transparent background); `.svg` / `.webp` also work
- Size: **128×128 or 256×256**, square, with a little padding
- Background: transparent — the UI is dark, white boxes look broken
- Keep files small; the current set of 191 badges is about 3.7 MB as PNG at
  128 px, and 1.3 MB as the WebP the site serves

## 2. Tooling

```bash
node tools/crests.mjs list          # all club ids: "id  league  name"
node tools/crests.mjs check         # "present N/191" + writes crests-missing.txt
node tools/crests.mjs fetch "https://source/badges/{id}.png"   # generic bulk fetch
node tools/crests-fetch-tsdb.mjs    # the TheSportsDB downloader used for the bundled set
```

The TheSportsDB script carries an alias table (club-id → search name) and
league-based disambiguation; it skips files that already exist, so it can be
re-run to top up after roster changes.

Do **not** rename club ids to match an image source — ids in `clubs.ts` are
part of the save format and of the leaderboard replay contract.

## 3. How resolution works

`apps/web/src/components/Crest.tsx`, in order:

1. `club.crestUrl` — explicit URL in the content pack (unused by default; set
   it to move to CDN-hosted artwork, it has top priority)
2. `/crests/<club id>.png` — **the bundled/dropped-in file**
3. Generated badge from club colours and identity (automatic fallback via
   `<img onError>`; failure is remembered per club id)

---

## 4. Trophies

`apps/web/public/trophies/` ships real trophy images — the European Cup, the FA
Cup, the Premier League trophy, the Ballon d'Or — served locally, so nothing is
hotlinked at runtime.

Resolution in `apps/web/src/components/Trophy.tsx`: the competition's own
image, else the generic family image (`generic-league.svg` /
`generic-cup.svg`), else a drawn SVG silhouette so a broken image can never
appear. Which image a slot resolves to depends on where it was won: club →
league/cup/confederation, player's country → the international ones.
