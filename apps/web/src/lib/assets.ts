/**
 * A URL for something in `public/`, valid wherever the build is served from —
 * and, for the bundled artwork, in the format the build actually ships.
 *
 * The site is served at the root of decisionfc.com, so `/crests/arsenal.png`
 * was always right and never needed thinking about. The itch.io build is not:
 * itch unpacks a game into a numbered directory and serves it from
 * `html-classic.itch.zone/html/<id>/`, where a leading slash points at the root
 * of itch's own host and every crest, trophy and font 404s.
 *
 * `import.meta.env.BASE_URL` is Vite's answer: `/` for the normal build, `./`
 * for the itch one (`base` in vite.config.ts). So the production URLs are
 * byte-for-byte what they were, and the itch build asks for the same files
 * relative to wherever its index.html landed.
 *
 * Pass a path with no leading slash — `asset('crests/arsenal.png')`.
 *
 * ## Why the extension changes here
 *
 * **The repository stores PNG and the build ships WebP**, and this function is
 * where the two names meet.
 *
 * The crests and trophies are 128px and 192px already — `tools/shrink-images.mjs`
 * did that — but they are still 5 MB of a 6.7 MB site as PNG, and the same
 * pixels as WebP are 1.7 MB. That is the single largest thing left in a cold
 * load on a phone.
 *
 * PNG stays the source of truth on disk for two reasons, and both are the
 * workflow rather than a technical preference: `docs/crests.md`
 * says to drop a PNG into `public/crests/<club id>.png`, and
 * `tools/crests.mjs` lists, checks and fetches PNGs. Neither should have to
 * change because of a delivery format. `apps/web/scripts/build-crests.mjs`
 * converts them after every build and deletes the PNGs from the output, so
 * nothing ships twice.
 *
 * Rewriting the extension in one place rather than at fourteen call sites also
 * keeps it out of the content package: the trophy and award art are named by
 * filename in `@bg/content`, and a delivery format has no business in the
 * world data.
 */
export const asset = (path: string) =>
  import.meta.env.BASE_URL + (path.endsWith('.png') ? path.replace(/\.png$/, '.webp') : path);

/**
 * Where the privacy policy is, from wherever this build is being served.
 *
 * The policy is a static page at `/privacy/` on the site, and the Settings
 * sheet links to it — which was right until the itch.io build existed. That
 * build is served from `html-classic.itch.zone/html/<id>/` and
 * `apps/web/scripts/build-itch.mjs` deletes `privacy/` from the zip, because a
 * copy of decisionfc.com's policy sitting on somebody else's host is a page
 * that can go stale without anybody noticing. So on itch a root-absolute
 * `/privacy/` was a link to itch's own root: a 404, from the one build that
 * most needs the link to work, since the funnel counts itch players like any
 * other (`REAL_HOSTS` in `lib/supabase.ts`).
 *
 * `BASE_URL` is the same signal `asset()` uses — `/` for the site, `./` for
 * itch — so the site keeps the relative link it always had, and every other
 * build points at the one copy of the policy that is kept up to date.
 */
export const PRIVACY_URL =
  import.meta.env.BASE_URL === '/' ? '/privacy/' : 'https://decisionfc.com/privacy/';
