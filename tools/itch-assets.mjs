#!/usr/bin/env node
/**
 * The pictures the itch.io page is made of, and the proof the zip works.
 *
 * Three jobs, one tool, because all three need the same two things — a browser
 * and the built game served the way itch serves it.
 *
 * 1. **The cover.** 630×500, which is the shape itch shows in every browse
 *    list and on every tag page. Drawn from the same floodlight-and-stripes
 *    language as the game's own intro screen, so the thumbnail and the thing it
 *    opens look like one product.
 *
 * 2. **The screenshots.** Taken on a real iPhone viewport at a real iPhone
 *    pixel ratio, with the safe-area insets a notched phone actually reports —
 *    so the wrapping, the type size and the spacing are what a player sees,
 *    not what a 375px desktop window happens to produce. What is *not* faked is
 *    the status bar: these are the game's pixels, with no drawn-on clock or
 *    battery, because a screenshot with a fictional 9:41 on it is a mock-up.
 *
 * 3. **The check that matters.** Everything is served from a nested path —
 *    `/html/<id>/`, exactly like `html-classic.itch.zone` — and every response
 *    is watched. On itch a leftover absolute URL is a 404 that never happens
 *    locally, because locally the game *is* at the root. Any 404, any console
 *    error, and this exits non-zero with the URL.
 *
 *   pnpm build:itch && node tools/itch-assets.mjs            # both languages
 *   node tools/itch-assets.mjs --only=en                     # one, the other kept
 *   node tools/itch-assets.mjs --only=en --frames=4-offer    # one picture, from any career
 *   node tools/itch-assets.mjs --frames=cover                # the cover's own career
 *   node tools/itch-assets.mjs --cover                       # redraw the cover from cover-shot.png
 */
import { createServer } from 'node:http';
import { copyFile, cp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dist = join(root, 'apps', 'web', 'dist-itch');
const out = join(root, 'itch');
const shots = join(out, 'screenshots');

if (!existsSync(join(dist, 'index.html'))) {
  console.error('\n  ✗ apps/web/dist-itch is not built. Run `pnpm build:itch` first.\n');
  process.exit(1);
}

/**
 * The path itch serves a game from, imitated.
 *
 * The number is arbitrary and that is the point: nothing in the build may
 * assume it, so serving from a directory nobody has ever seen is the test.
 */
const PREFIX = '/html/2846120';
// Any free port, so several runs can go at once (2026-09-23: waiting
// on screenshots one career at a time was too slow). `--frames=` per process.
let PORT = 0;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  if (!url.pathname.startsWith(PREFIX)) {
    res.writeHead(404).end('outside the game directory');
    return;
  }
  let rest = url.pathname.slice(PREFIX.length) || '/';
  if (rest.endsWith('/')) rest += 'index.html';
  const file = join(dist, normalize(rest).replace(/^(\.\.[/\\])+/, ''));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    // Deliberately a real 404 rather than an index.html fallback: itch has no
    // single-page-app rewrite either, so a wrong URL has to fail here too.
    res.writeHead(404).end('not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
PORT = server.address().port;
const BASE = `http://127.0.0.1:${PORT}${PREFIX}/`;

const BROWSER = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(BROWSER) ? { executablePath: BROWSER } : {});

/**
 * `--only=en` or `--only=zh` re-shoots one language and leaves the other's
 * files where they are. A flaw in one language's set used to mean re-running
 * both, twenty minutes, because this deleted the whole directory first — the
 * point, since 2026-09-23, is to look at each language as soon as it is
 * done and redo only the one that needs it. The cover is drawn from the English
 * summary, so it is redrawn only when English is shot.
 */
const ONLY = process.argv.find((arg) => arg.startsWith('--only='))?.slice('--only='.length) ?? null;
if (ONLY !== null && ONLY !== 'en' && ONLY !== 'zh') {
  console.error(`\n  ✗ --only takes en or zh, not "${ONLY}".\n`);
  process.exit(1);
}
/**
 * `--frames=4-offer[,5-odds…]` goes further and replaces only those pictures,
 * from the first career that produces a clean one, and stops there — no need
 * to play the rest out or rank it. The set does not have to be one career
 * (2026-09-23: pick the best frames from any run), so one bad frame is
 * a two-minute fix rather than a new set.
 */
/**
 * The cover is a career of its own (2026-09-23): drawn from the summary
 * screenshot it had shown the same player as `7-summary` beside it in the
 * README. `--frames=cover` plays that career — a different player from every
 * screenshot — and keeps its summary in `itch/cover-shot.png`, outside
 * `screenshots/` so it is not uploaded as one. `--cover` only redraws the cover
 * from that file, after picking one by hand.
 */
const COVER_ONLY = process.argv.includes('--cover');
const FRAME_NAMES = ['1-start', '2-identity', '3-first-card', '4-offer', '5-odds', '6-career', '7-summary', 'cover'];
const COVER_SHOT = join(out, 'cover-shot.png');
const FRAMES =
  process.argv
    .find((arg) => arg.startsWith('--frames='))
    ?.slice('--frames='.length)
    .split(',')
    .filter(Boolean) ?? null;
if (FRAMES !== null && (FRAMES.length === 0 || FRAMES.some((f) => !FRAME_NAMES.includes(f)))) {
  console.error(`\n  ✗ --frames takes a comma list of ${FRAME_NAMES.join(', ')}.\n`);
  process.exit(1);
}
/**
 * Every attempt's pictures are kept under `itch/takes/<run>/<locale>-<n>/`
 * (ignored by git), so the published set can be picked frame by frame from
 * every run there has been. That was the need on 2026-09-23 —
 * the best of each title from all the screenshots so far — and two runs'
 * worth could not be offered because each run had overwritten the last.
 */
const TAKES = join(out, 'takes', `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`);
if (ONLY === null && FRAMES === null && !COVER_ONLY) await rm(shots, { recursive: true, force: true });
await mkdir(shots, { recursive: true });
if (ONLY !== null || FRAMES !== null) {
  for (const file of await readdir(shots)) {
    if (!file.endsWith('.png')) continue;
    const zh = file.startsWith('zh-');
    if (ONLY !== null && zh !== (ONLY === 'zh')) continue;
    if (FRAMES !== null && !FRAMES.includes(file.replace(/^zh-/, '').replace(/\.png$/, ''))) continue;
    await rm(join(shots, file));
  }
}

let failed = false;
const problems = [];

const COVER = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 630px; height: 500px; background: #070a09; color: #f4f7f2;
    position: relative; overflow: hidden;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .glow { position: absolute; left: -25%; right: 10%; top: -42%; height: 95%; border-radius: 50%;
    background: radial-gradient(ellipse at 50% 0%, rgb(184 255 60 / 0.34) 0%, rgb(155 238 22 / 0.08) 44%, transparent 72%); }
  .stripes { position: absolute; inset: 0;
    background: repeating-linear-gradient(97deg, transparent 0 44px, rgb(255 255 255 / 0.022) 44px 88px); }
  .wrap { position: relative; height: 100%; padding: 44px 40px; display: flex; align-items: center; gap: 26px; }
  .copy { width: 296px; flex: none; }
  .eyebrow { display: flex; align-items: center; gap: 11px; margin-bottom: 16px; }
  .rule { width: 32px; height: 4px; border-radius: 99px; background: #9bee16; }
  .brand { font-size: 14px; font-weight: 800; letter-spacing: 0.26em; text-transform: uppercase; color: #a3e635; }
  h1 { font-size: 38px; line-height: 1.0; font-weight: 800; letter-spacing: -0.03em; }
  .lede { margin-top: 14px; font-size: 15.5px; line-height: 1.38; color: rgb(244 247 242 / 0.58); max-width: 22ch; }
  .chips { margin-top: 22px; display: flex; flex-wrap: wrap; gap: 7px; }
  .chip { border: 1px solid rgb(255 255 255 / 0.14); background: rgb(255 255 255 / 0.04);
    border-radius: 999px; padding: 5px 11px; font-size: 12px; font-weight: 600; color: rgb(244 247 242 / 0.62); }
  .chip.lime { border-color: rgb(163 230 53 / 0.42); background: rgb(163 230 53 / 0.11); color: #a3e635; }
  /* The phone: a real screenshot, cropped to its top, tilted just enough to
     read as an object rather than as a rectangle pasted on. */
  .phone { position: relative; width: 218px; height: 438px; flex: none; border-radius: 30px;
    border: 6px solid #1b201c; background: #0b0f0c; overflow: hidden;
    transform: rotate(4deg) translateY(6px);
    box-shadow: 0 26px 60px rgb(0 0 0 / 0.6), 0 0 0 1px rgb(255 255 255 / 0.05); }
  .phone img { width: 100%; display: block; }
</style></head><body>
  <div class="glow"></div><div class="stripes"></div>
  <div class="wrap">
    <div class="copy">
      <div class="eyebrow"><span class="rule"></span><span class="brand">Decision FC</span></div>
      <h1>Twenty seasons.<br />Five minutes.</h1>
      <p class="lede">A footballer's whole career, one decision at a time.</p>
      <div class="chips">
        <span class="chip lime">Free</span>
        <span class="chip">In your browser</span>
        <span class="chip">EN · 中文</span>
      </div>
    </div>
    <div class="phone"><img src="data:image/png;base64,__SHOT__" /></div>
  </div>
</body></html>`;

// ---------------------------------------------------------------------------
// 1 · the screenshots, on a phone
// ---------------------------------------------------------------------------
/**
 * An iPhone 17 Pro on iOS 26, running the game the way its best screenshot
 * exists: added to the home screen, full-screen, no browser furniture.
 *
 * 402×874 at ×3 is the device's whole screen — 1206×2622, which is exactly the
 * resolution a screenshot taken on the phone itself comes out at. The safe-area
 * insets it reports in that mode (62 top for the Dynamic Island, 34 bottom for
 * the home indicator) are set through Chromium's own safe-area emulation, so
 * `env(safe-area-inset-*)` answers exactly as it does on the phone — every
 * component that reads it, not only the ones that read the CSS variables.
 * (It used to be a 14 Pro with the variables overridden by a style tag, which
 * the ad screen and the intro's hero never saw.)
 *
 * The first attempt used Playwright's own `iPhone 14 Pro` viewport, which is
 * 393×659 — the content area with Safari's toolbars *showing*. Subtracting 93px
 * of insets from that left 566px for a layout composed against 667, and the
 * result was a title cut in half and a subtitle that stopped mid-sentence. The
 * insets belong with the full-screen height, not with the browser one.
 */
const PHONE = {
  viewport: { width: 402, height: 874 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
};
const INSETS = { top: 62, bottom: 34, left: 0, right: 0 };

const LABELS = {
  en: { start: 'Start career', confirm: 'Sign your first forms', replay: 'Play again' },
  zh: { start: '开启生涯', confirm: '签下第一份合同', replay: '再来一次' },
};

/** Which shots to take, in which language, and how many careers it takes. */
const RUNS = [
  { locale: 'en', prefix: '' },
  { locale: 'zh', prefix: 'zh-' },
].filter((run) => (ONLY === null || run.locale === ONLY) && !COVER_ONLY);

/**
 * How good a career has to be before it is worth photographing.
 *
 * The screenshots are the shop window, and the first honest batch produced a
 * player who peaked at 82 and retired in the top 60% — a real career, and a
 * dull advert for one. So each language plays up to eight careers and keeps the
 * best: peak ability first, then trophies (capped), then awards — see `rank`. Everything
 * shown is still a career the game actually produced from ordinary play; the
 * only thing being chosen is which of them to show.
 */
const GOOD = { peak: 86, trophies: 5, elite: 4 };
const ATTEMPTS = 8;

/**
 * The giants, read off the world rather than typed out: every club at 85
 * reputation or more — Real Madrid, Barcelona, Bayern, City, PSG, Liverpool
 * and the rest of the fourteen. The verdict on a World Cup winner who
 * played for Stoke, Palermo and Athletic: the numbers were high and nothing on
 * the screen looked like the top of the game. So the summary is chosen for
 * seasons spent at these clubs, and scrolled to show them.
 */
const { WORLD } = await import('../packages/content/dist/index.js');
const ELITE = new Set(WORLD.clubs.filter((club) => club.reputation >= 85).map((club) => club.id));

/**
 * One player per picture (2026-09-23): apart from the title screen,
 * every screenshot is a different career — a different name, nationality,
 * position and type — so the set reads as a game many people play rather than
 * one save photographed six times.
 */
const CAST = {
  en: {
    '2-identity': { name: 'Santos', number: 7, foot: 'right', country: 'bra', position: 'LW', archetype: 'pace' },
    '3-first-card': { name: 'Okafor', number: 5, foot: 'right', country: 'nga', position: 'CB', archetype: 'physical' },
    '4-offer': { name: 'Moreau', number: 8, foot: 'left', country: 'fra', position: 'CAM', archetype: 'technical' },
    '5-odds': { name: 'Lindqvist', number: 6, foot: 'right', country: 'swe', position: 'CM', archetype: 'physical' },
    '6-career': { name: 'Kowalski', number: 11, foot: 'left', country: 'pol', position: 'RW', archetype: 'pace' },
    '7-summary': { name: 'Hernández', number: 9, foot: 'right', country: 'esp', position: 'ST', archetype: 'technical' },
    cover: { name: 'Hale', number: 10, foot: 'left', country: 'eng', position: 'CAM', archetype: 'technical' },
  },
  zh: {
    '2-identity': { name: '陈望', number: 10, foot: 'right', country: 'chn', position: 'ST', archetype: 'technical' },
    '3-first-card': { name: '林澈', number: 4, foot: 'right', country: 'chn', position: 'CB', archetype: 'physical' },
    '4-offer': { name: '周野', number: 8, foot: 'left', country: 'chn', position: 'CAM', archetype: 'technical' },
    '5-odds': { name: '许川', number: 6, foot: 'right', country: 'chn', position: 'CM', archetype: 'physical' },
    '6-career': { name: '韩屿', number: 11, foot: 'left', country: 'chn', position: 'LW', archetype: 'pace' },
    '7-summary': { name: '李骁', number: 9, foot: 'right', country: 'chn', position: 'ST', archetype: 'pace' },
  },
};

/** Which pictures each career is played for: one each, the title screen riding along with the first. */
function jobsFor(run) {
  const wanted = FRAMES ?? FRAME_NAMES;
  const jobs = wanted
    .filter((frame) => frame !== '1-start' && frame !== 'cover')
    .map((frame) => ({ frames: [frame], tag: frame, who: CAST[run.locale][frame] }));
  // The cover's career is played like a summary and kept somewhere else.
  if (wanted.includes('cover') && run.locale === 'en') {
    jobs.push({ frames: ['7-summary'], tag: 'cover', who: CAST.en.cover, dest: COVER_SHOT });
  }
  if (wanted.includes('1-start')) {
    if (jobs.length > 0) jobs[0].frames.unshift('1-start');
    else jobs.push({ frames: ['1-start'], who: CAST[run.locale]['2-identity'] });
  }
  return jobs;
}

async function fillIdentity(page, who) {
  await page.locator('input:not([type="number"])').first().fill(who.name);
  await page.locator('input[type="number"]').first().fill(String(who.number));
  await page.click(`[data-foot="${who.foot}"]`);
  await page.click(`[data-position="${who.position}"]`);
  await page.click(`[data-archetype="${who.archetype}"]`);
  await page.click('[data-country-picker]');
  await page.waitForTimeout(350);
  await page.click(`[data-country="${who.country}"]`);
  await page.waitForTimeout(450);
}

/** Reads the finished career off the app's own test hook, not off the copy. */
async function careerScore(page) {
  return page.evaluate(() => {
    const state = window.__fcState;
    if (!state?.seasons?.length) return null;
    const peak = Math.max(...state.seasons.map((s) => s.overallEnd ?? 0));
    const trophies = state.seasons.reduce((n, s) => n + (s.trophies?.length ?? 0), 0);
    const awards = state.seasons.reduce((n, s) => n + (s.awards?.length ?? 0), 0);
    return {
      peak,
      trophies,
      awards,
      seasons: state.seasons.length,
      ending: state.retirement?.endingId ?? null,
      clubs: state.seasons.map((s) => s.clubId),
      weights: state.seasons.map((s) => (s.trophies?.length ?? 0) + (s.awards?.length ?? 0) + (s.rating >= 7.5 ? 1 : 0)),
    };
  });
}

for (const run of RUNS) {
  const label = LABELS[run.locale];
  for (const job of jobsFor(run)) {
    const frames = job.frames;
    const tag = job.tag ?? frames.join('+');
    const staging = join(shots, `.attempt-${run.locale}-${tag}-${process.pid}`);
    let best = null;

    for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
      await rm(staging, { recursive: true, force: true });
      await mkdir(staging, { recursive: true });

      const context = await browser.newContext({ ...PHONE, locale: run.locale === 'zh' ? 'zh-CN' : 'en-GB' });
      const page = await context.newPage();

      const errors = [];
      const missing = new Set();
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('response', (r) => r.status() >= 400 && missing.add(`${r.status()} ${r.url()}`));

      // Never the live board: these are throwaway careers and they are not ranked
      // against real players. Stubbed rather than blocked so the summary screen
      // still renders its real ranked state rather than the offline fallback.
      //
      // In the real response's shape — `verified` and `boards` — which this stub
      // did not have: it answered with the three boards at the top level, the
      // client read that as a failure, and every summary screenshot showed the
      // offline estimate instead of a rank. The numbers are the order of the
      // real board (just under two thousand careers) rather than a hundred
      // thousand nobody has, and the ranks are where a career good enough to be
      // photographed actually lands on it.
      await page.route('**/functions/v1/career-submit', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            verified: true,
            boards: {
              legacy: { rank: 41, total: 1912, percent: 2.14 },
              wealth: { rank: 63, total: 1912, percent: 3.3 },
              value: { rank: 52, total: 1912, percent: 2.72 },
              sameWorld: { rank: 1, total: 1, percent: 100 },
            },
          }),
        }),
      );
      await page.addInitScript((loc) => {
        localStorage.setItem('fc:locale', loc);
        // The app publishes its state to `window.__fcState` behind this flag, so
        // the career can be judged on what it was rather than on parsed copy.
        localStorage.setItem('fc:testhook', '1');
      }, run.locale);
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: INSETS });
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(700);

      /**
       * The career table is a scroll box, and a screenshot catches it wherever it
       * happens to be — usually with the top row sliced through the middle. That
       * is invisible while playing and glaring in a still, so before every shot
       * the list is pushed to the newest season and then snapped back to a row
       * boundary. Bottom-aligned, because the newest seasons are the ones the
       * card on screen is about.
       */
      /**
       * Make the record table start and end on a row.
       *
       * It is a scroll box inside a flexible column, so a screenshot catches it
       * wherever it happens to be — and a still with a season sliced through the
       * middle reads as a rendering fault rather than as a list. Two moves, and
       * both are needed: a box of n equal rows whose height is not a multiple of
       * a row can have a clean top edge or a clean bottom edge, never both by
       * scrolling alone.
       *
       *   1. scroll so the topmost visible row starts exactly at the top edge;
       *   2. shorten the box to the last row that fits under it whole.
       *
       * The scroll starts at the end, because the newest seasons are the ones the
       * card on screen is about. No content changes; the box loses up to one row
       * of height, which the column below simply takes back.
       */
      // Set for the summary only: a weight per season, and the table is scrolled
      // to the stretch that carries the most of it instead of to its end.
      let snapWeights = null;
      const snapRecord = async () => {
        await page.evaluate((weights) => {
          for (const box of document.querySelectorAll('[data-career-table] .overflow-y-auto')) {
            if (box.children.length === 0) continue;
            // Reset first: this runs before every screenshot on the same page,
            // and leaving the last one's height in place shrank the box once per
            // shot until the table was a single row of nothing.
            box.style.flex = '';
            box.style.height = '';
            void box.clientHeight;
            box.style.flex = 'none';
            box.style.height = `${box.clientHeight}px`;

            const rows = [...box.children];
            const edge = box.getBoundingClientRect().top;
            // The box is not always what does the cutting. On the summary screen
            // it sits inside `min-h-[86px] flex-1 overflow-hidden`, and it is that
            // ancestor's bottom edge which slices a season in half — so measuring
            // against the box's own height reported "clean" while the picture
            // plainly was not. The visible floor is whichever edge comes first.
            let foot = edge + box.clientHeight;
            for (let el = box.parentElement; el; el = el.parentElement) {
              const flow = getComputedStyle(el).overflowY;
              if (flow === 'hidden' || flow === 'auto' || flow === 'scroll') {
                foot = Math.min(foot, el.getBoundingClientRect().bottom);
              }
            }
            // And the rows pinned *under* the box — the national team — need
            // their room below it. Measured only against the clipping ancestor,
            // the box grew to that ancestor's floor and pushed the England row
            // half out of the picture on both summaries of the 2026-09-23 batch.
            for (let sib = box.nextElementSibling; sib; sib = sib.nextElementSibling) {
              foot -= sib.getBoundingClientRect().height;
            }

            // Whole rows only, counted rather than measured after the fact: the
            // box is cut to exactly the rows that fit above the floor, then
            // scrolled by row index, so the top and bottom edges are both clean
            // whatever the box's height was before. The zero-height end marker
            // is not a row.
            const seasons = rows.filter((row) => row.getBoundingClientRect().height > 0);
            if (seasons.length === 0) continue;
            const pitch =
              seasons.length > 1
                ? seasons[1].getBoundingClientRect().top - seasons[0].getBoundingClientRect().top
                : seasons[0].getBoundingClientRect().height;
            const rowHeight = seasons[0].getBoundingClientRect().height;
            const fits = Math.max(1, Math.min(seasons.length, Math.floor((foot - edge - rowHeight) / pitch) + 1));
            box.style.height = `${(fits - 1) * pitch + rowHeight}px`;

            // Which rows: by default the newest, because the card on screen is
            // about now. With weights (the summary), the run of that many seasons
            // that weighs the most — a career's best stretch, not its first
            // eleven years or its last.
            let from = seasons.length - fits;
            if (weights) {
              let bestSum = -1;
              for (let start = 0; start + fits <= seasons.length; start += 1) {
                let sum = 0;
                for (let i = start; i < start + fits; i += 1) sum += weights[i] ?? 0;
                if (sum > bestSum) {
                  bestSum = sum;
                  from = start;
                }
              }
            }
            // Rows are not all one height — the "Deciding…" row is taller — so
            // the box is sized to the rows actually shown, one fewer if they
            // do not fit.
            const span = (a, b) => seasons[b].offsetTop + seasons[b].offsetHeight - seasons[a].offsetTop;
            let shown = fits;
            while (shown > 1 && span(from, from + shown - 1) > foot - edge + 0.5) {
              if (!weights) from += 1;
              shown -= 1;
            }
            box.style.height = `${span(from, from + shown - 1)}px`;
            box.scrollTop = seasons[from].offsetTop - seasons[0].offsetTop;
          }
        }, snapWeights);
        await page.waitForTimeout(80);
      };

      /**
       * A celebration blurs the whole screen behind it. Right for the moment it
       * lands in, useless in a still — one of these was shipped with the career
       * table blurred out behind a golden boot. So wait it out before shooting,
       * and never choose a card to photograph while one is up.
       */
      // Clear for a second and a half, not clear at one instant: a celebration
      // lands a beat *after* the card it belongs to, so a single check could
      // pass and the shot still catch "Relegated" fading in over the card title —
      // which is how an English offer frame went out once.
      const settled = async () => {
        let clear = 0;
        for (let wait = 0; wait < 80 && clear < 10; wait += 1) {
          clear = (await page.locator('[data-celebration]').count()) === 0 ? clear + 1 : 0;
          await page.waitForTimeout(150);
        }
        return clear >= 10;
      };

      const taken = new Set();
      const dirty = new Set();
      const shot = async (name) => {
        taken.add(name);
        await settled();
        // Twice, with a beat between. `CareerList` scrolls itself to the newest
        // season whenever its state changes, and on the summary that effect lands
        // *after* the first snap — which left the table with a clean top edge
        // computed for a scroll position it no longer had, and the last season
        // sliced along the bottom.
        // Snap, then check, then snap again until it holds. `CareerList` scrolls
        // itself to the newest season whenever its state changes, and on the
        // summary that lands *after* the first snap — once when the screen mounts
        // and again when the leaderboard reply arrives — so a single pass left
        // the table cropped for a scroll position it no longer had and the last
        // season sliced along the bottom. Six tries, then say so rather than
        // ship it.
        let clean = false;
        for (let tries = 0; tries < 6 && !clean; tries += 1) {
          await snapRecord();
          await page.waitForTimeout(220);
          clean = await page.evaluate(() =>
            [...document.querySelectorAll('[data-career-table] .overflow-y-auto')].every((box) => {
              const { top, bottom } = box.getBoundingClientRect();
              const sliced = [...box.children].some((row) => {
                const r = row.getBoundingClientRect();
                return (r.top < top - 0.5 && r.bottom > top + 0.5) || (r.top < bottom - 0.5 && r.bottom > bottom + 0.5);
              });
              // The rows under the box must be whole too, measured against
              // whatever ancestor actually clips them.
              let floor = Infinity;
              for (let el = box.parentElement; el; el = el.parentElement) {
                const flow = getComputedStyle(el).overflowY;
                if (flow !== 'visible') floor = Math.min(floor, el.getBoundingClientRect().bottom);
              }
              let under = false;
              for (let sib = box.nextElementSibling; sib; sib = sib.nextElementSibling) {
                const r = sib.getBoundingClientRect();
                if (r.height > 0 && r.bottom > floor + 0.5) under = true;
              }
              return !sliced && !under;
            }),
          );
        }
        // Only the pictures this run is for count: a career played for its
        // summary passes through the other screens on the way, and those
        // frames are not kept.
        if (!clean && frames.includes(name)) {
          failed = true;
          problems.push(`${run.locale} ${name}: a season row is still sliced by the edge of the record box`);
        }
        const bad = await page.evaluate(() => {
          const d = document.documentElement;
          const out = [];
          if (d.scrollWidth > d.clientWidth + 1) out.push(`x ${d.scrollWidth}>${d.clientWidth}`);
          if (d.scrollHeight > d.clientHeight + 1) out.push(`y ${d.scrollHeight}>${d.clientHeight}`);

          // The one the document check cannot see. A column that overflows inside
          // `overflow-hidden` does not scroll the page — it just loses the top of
          // the heading and the end of the sentence, which is exactly how the
          // first batch of these went out with a title cut in half. So look at
          // the things a reader is meant to read and check they are on screen.
          const height = d.clientHeight;
          const scrollable = (el) => {
            for (let p = el.parentElement; p; p = p.parentElement) {
              const flow = getComputedStyle(p).overflowY;
              if (flow === 'auto' || flow === 'scroll') return true;
            }
            return false;
          };
          for (const el of document.querySelectorAll('h1, h2, button, [data-option-id]')) {
            if (scrollable(el)) continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            if (r.top < -1 || r.bottom > height + 1) {
              out.push(`clipped <${el.tagName.toLowerCase()}> "${(el.textContent ?? '').trim().slice(0, 28)}"`);
            }
          }
          return out;
        });
        if (bad.length > 0 && frames.includes(name)) {
          failed = true;
          problems.push(`${run.locale} ${name}: ${bad.join(', ')}`);
        }
        // A flawed picture is not kept: the next career gets a go at it.
        if ((!clean || bad.length > 0) && frames.includes(name)) dirty.add(name);
        await page.screenshot({ path: join(staging, `${name}.png`) });
      };

      /**
       * How many seasons are behind the player — an empty table is a screen of
       * nothing, and the first batch had three rows and a void where the career
       * should be.
       *
       * Read off the app's own state rather than counted in the DOM. The DOM
       * count was `[data-career-table] .overflow-y-auto > *`, which matched more
       * than the season rows and reported ten at nineteen years old, so every
       * "mid-career" screenshot was taken three seasons in.
       */
      const seasonsPlayed = () => page.evaluate(() => window.__fcState?.seasons?.length ?? 0);

      await shot('1-start');

      await page.getByText(label.start, { exact: false }).first().click();
      await page.waitForTimeout(500);
      await fillIdentity(page, job.who);
      await shot('2-identity');

      await page.getByText(label.confirm, { exact: false }).first().click();
      await page.waitForTimeout(900);
      await shot('3-first-card');

      // Play the career out, stopping to photograph the three screens that show
      // what the game is. None of them is taken before the record has six seasons
      // on it: at seventeen the table is two rows and the middle of the screen is
      // a void, which is honest and sells nothing.
      let tookOffer = false;
      let tookOdds = false;
      let tookRecord = false;
      for (let card = 0; card < 400; card += 1) {
        const options = page.locator('[data-option-id]');
        const count = await options.count();
        if (count === 0) break;
        const seasons = await seasonsPlayed();
        const celebrating = (await page.locator('[data-celebration]').count()) > 0;

        // Two crests at least: a transfer window, not an event card that happens
        // to carry one club — which is what the Chinese shot caught once, a
        // two-option dilemma with most of the screen empty above it.
        // Not in a loan season: the header then carries an "On loan" pill and
        // truncates the manager's style ("Gege…") to fit it, which is fine in
        // play and a flaw on a shop window.
        // And two of them with a wage on: a loan card has crests too but no
        // contract, and the frame exists to show what a deal looks like. Not
        // after a result printed in red, either — the line above the table is
        // the first thing read.
        const onLoan = await page.evaluate(() => Boolean(window.__fcState?.loan));
        const offers = await page
          .locator('[data-option-id]:has(img[src*="crests/"]):has-text("/wk"), [data-option-id]:has(img[src*="crests/"]):has-text("/周")')
          .count();
        const grimNow = await page
          .locator('[data-result]')
          .evaluate((el) => /rgb\(2[0-9]{2},\s*\d+,\s*\d+\)/.test(getComputedStyle(el).color))
          .catch(() => false);
        if (!tookOffer && !celebrating && !onLoan && !grimNow && seasons >= 6 && offers >= 2) {
          await shot('4-offer');
          tookOffer = true;
        }
        if (!tookOdds && !celebrating && seasons >= 6 && (await page.locator('[data-option-id]:has-text("%")').count()) > 0) {
          await shot('5-odds');
          tookOdds = true;
        }
        // A full table and prose that is not a disaster: the mid-career shot is
        // the one that has to look like a career going well.
        if (!tookRecord && !celebrating && seasons >= 10) {
          const grim = await page
            .locator('[data-result]')
            .evaluate((el) => getComputedStyle(el).color)
            .catch(() => '');
          if (!/rgb\(2[0-9]{2},\s*\d+,\s*\d+\)/.test(grim)) {
            await shot('6-career');
            tookRecord = true;
          }
        }
        if (frames.every((frame) => taken.has(frame))) break;

        const before = await page.getAttribute('[data-decision]', 'data-decision');
        await options.nth(card % count).click();
        await page
          .waitForFunction(
            (prev) => {
              const el = document.querySelector('[data-decision]');
              return !el || el.getAttribute('data-decision') !== prev;
            },
            before,
            { timeout: 8000 },
          )
          .catch(() => {});
        await page.waitForTimeout(120);
      }

      const take = join(TAKES, `${run.locale}-${tag}-${attempt}`);
      await cp(staging, take, { recursive: true });

      if (!frames.includes('7-summary')) {
        const got = frames.every((frame) => taken.has(frame) && !dirty.has(frame));
        if (got && errors.length === 0 && missing.size === 0) {
          for (const frame of frames) {
            await copyFile(join(staging, `${frame}.png`), join(shots, `${run.prefix}${frame}.png`));
          }
          best = { attempt, frames };
        }
        await context.close();
        console.log(
          `  · ${run.locale} ${job.who.name} attempt ${attempt}: ${got ? `took ${frames.join(', ')}` : `no clean ${frames.filter((f) => !taken.has(f)).join(', ')}`}`,
        );
        if (best !== null) break;
        continue;
      }

      await page.waitForTimeout(1400);
      {
        const clubs = await page.evaluate(() => window.__fcState?.seasons?.map((s) => ({ club: s.clubId, won: (s.trophies?.length ?? 0) + (s.awards?.length ?? 0), rating: s.rating ?? 0 })) ?? []);
        snapWeights = clubs.map((s) => (ELITE.has(s.club) ? 3 : 0) + s.won + (s.rating >= 7.5 ? 1 : 0));
      }
      await shot('7-summary');
      await cp(join(staging, '7-summary.png'), join(take, '7-summary.png'));

      const score = (await careerScore(page)) ?? { peak: 0, trophies: 0, awards: 0, seasons: 0 };
      // A shelf photographs, so trophies count — but capped, and ability counts
      // three times over. Uncapped at four points each, twelve second-tier and
      // Eredivisie trophies outranked a peak of 88 and a Ballon d'Or, and the
      // Chinese summary went out as a 75-rated career: a real one, and a poor
      // advert. An 85 who won nothing still loses to an 82 who won a European
      // Cup, which was the point of weighting trophies at all.
      //
      // And the ending is the headline of the summary shot, so it counts too: a
      // doping ban ("Tainted Record — the way you got there was not") is a real
      // ending and the worst possible caption for a shop window, and one of the
      // great ones is the best.
      const HEADLINE = ['goat', 'ballon_dor_winner', 'world_champion', 'continental_king', 'serial_winner'];
      const elite = (score.clubs ?? []).filter((club) => ELITE.has(club)).length;
      const rank =
        score.peak * 3 +
        Math.min(score.trophies, 8) * 3 +
        score.awards * 2 +
        Math.min(elite, 8) * 5 +
        (HEADLINE.includes(score.ending) ? 15 : 0) -
        (score.ending === 'disgraced' ? 1000 : 0);

      if (errors.length > 0) {
        failed = true;
        problems.push(`${run.locale}: console errors — ${errors.slice(0, 3).join(' | ')}`);
      }
      if (missing.size > 0) {
        failed = true;
        problems.push(`${run.locale}: ${missing.size} failed requests — ${[...missing].slice(0, 5).join(' | ')}`);
      }
      const complete = frames.every((frame) => taken.has(frame) && !dirty.has(frame));
      if (complete && (best === null || rank > best.rank)) {
        for (const file of await readdir(staging)) {
          if (!frames.includes(file.replace(/\.png$/, ''))) continue;
          await copyFile(join(staging, file), job.dest ?? join(shots, `${run.prefix}${file}`));
        }
        best = { rank, ...score, elite, attempt };
      }
      await context.close();

      console.log(
        `  · ${run.locale} ${job.who.name} attempt ${attempt}: peak ${score.peak}, ${score.trophies} trophies, ` +
          `${score.awards} awards, ${elite} seasons at a giant, ${score.ending}${complete && best?.attempt === attempt ? ' — kept' : ''}`,
      );
      if (
        complete &&
        score.peak >= GOOD.peak &&
        score.trophies >= GOOD.trophies &&
        elite >= GOOD.elite &&
        HEADLINE.includes(score.ending)
      )
        break;
    }

    await rm(staging, { recursive: true, force: true });
    if (best === null) {
      failed = true;
      problems.push(`${run.locale} ${tag}: no attempt produced a clean picture`);
    } else {
      console.log(
        best.frames
          ? `  ✓ ${run.locale} ${tag}: ${job.who.name}, attempt ${best.attempt}`
          : `  ✓ ${run.locale} ${tag}: ${job.who.name}, attempt ${best.attempt} — peak ${best.peak}, ${best.trophies} trophies, ${best.elite} seasons at a giant, ${best.ending}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 2 · the cover, drawn around a real screenshot
// ---------------------------------------------------------------------------
// 630×500 is what itch shows in every browse list and on every tag page, at
// about half that size. Type alone reads as a blog post at thumbnail size, so
// the right half is the game itself — the career screen, in a phone, because
// "twenty seasons in five minutes" is a claim and a filled-in career table is
// the evidence for it.
if (COVER_ONLY || ((ONLY === null || ONLY === 'en') && (FRAMES === null || FRAMES.includes('cover')))) {
  // A summary: the one screen that shows what a whole career looks like —
  // twenty rows, the trophies, the three world rankings. It is the payoff, and
  // a thumbnail has one chance to say what the game gives you. Its own career,
  // so the cover and the summary screenshot are two players, not one twice.
  const inside = (await readFile(COVER_SHOT)).toString('base64');
  const page = await browser.newPage({ viewport: { width: 630, height: 500 }, deviceScaleFactor: 2 });
  await page.setContent(COVER.replace('__SHOT__', inside), { waitUntil: 'load' });
  await page.screenshot({ path: join(out, 'cover.png') });
  await page.close();
  console.log('  ✓ itch/cover.png            630×500 (@2x)');
}

await browser.close();
server.close();

if (problems.length > 0) {
  console.log('');
  for (const line of problems) console.log(`  ${failed ? '✗' : '!'} ${line}`);
}
console.log(
  failed
    ? '\n  ✗ the itch build is broken from a nested path — fix it before uploading\n'
    : `\n  ✓ served from ${PREFIX}/ with no 404s and no console errors\n`,
);
process.exit(failed ? 1 : 0);
