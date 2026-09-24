/**
 * The mandatory UI check: play a whole career in both languages and fail on
 * anything a player would notice.
 *
 *   pnpm build
 *   npx vite preview --port 4173 --host 127.0.0.1 apps/web &
 *   node tools/verify-ui.mjs                      # 375×667, the phone
 *   node tools/verify-ui.mjs --desktop            # 1440×900, 1920×1080, 1280×720
 *   node tools/verify-ui.mjs --desktop --day=…    # replay a specific day's daily
 *
 * It asserts the five things that keep breaking: the document must never
 * scroll (the one-screen rule), no card may carry more than three options, no
 * console errors or broken images, no raw i18n key on screen, and no engine id
 * reaching a Chinese screen untranslated. Screenshots of the summary land in
 * `SHOTS` for eyeballing.
 *
 * `--desktop` adds the four things that only mean anything with a mouse and a
 * wide window, and each of them is here because it was once wrong: the game
 * panel must be a centred, height-capped object rather than a 420px column
 * stretched down a 1080px window; the rewarded ad must fill that panel and not
 * the browser; a sheet must dock to the panel rather than to the bottom of the
 * screen a long way beneath it; and the number keys must actually play the
 * career.
 *
 * This used to be a scratch script re-derived from memory every time, which is
 * how it ended up clicking a selector the UI no longer had and reporting a
 * clean run over a career it never actually played. It lives here now.
 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

/**
 * Engine ids that must never reach a Chinese screen.
 *
 * A consequence line interpolates params — `{role}`, `{competition}` — and each
 * one carries an engine id that the panel has to look up. The `competition`
 * lookup was simply missing, so a card touching three competitions printed
 * "league夺冠机会变大". That is not a raw i18n key, so the dotted-string check
 * below could never have caught it: it is a correctly-resolved sentence with an
 * untranslated word inside.
 *
 * Word-boundary matched, and only on the Chinese run, where any Latin word from
 * this list is by definition a bug.
 */
const ENGINE_IDS = [
  'league', 'cup', 'continental',
  'star', 'important', 'regular', 'squad', 'impact_sub', 'fringe',
  'rival', 'first', 'escape', 'foreign', 'money',
  'ballon_dor', 'golden_boot', 'golden_glove', 'best_defender', 'best_playmaker', 'team_of_the_season',
];
const ID_PATTERN = new RegExp(`(?<![A-Za-z_-])(${ENGINE_IDS.join('|')})(?![A-Za-z_-])`, 'g');

async function checkUntranslated(page, into) {
  const text = await page.evaluate(() => document.body.innerText);
  for (const m of text.matchAll(ID_PATTERN)) into.add(m[1]);
}

const BASE = process.env.BASE ?? 'http://127.0.0.1:4173';
const SHOTS = process.env.SHOTS ?? '/tmp';
const DESKTOP = process.argv.includes('--desktop');

/**
 * The day the desktop run plays, pinned for the whole run.
 *
 * The desktop career comes in through the daily challenge, whose seed is the
 * calendar date. That is what makes the run deterministic, and it had two holes
 * in it. A run that crosses midnight between the first click and the summary
 * plays yesterday's career and is then asked for today's daily standing, which
 * it correctly does not have — the same class of flake the ad ladder had at
 * 23:59 and the same fix. And a desktop failure could only be reproduced until
 * midnight, after which the seed was gone.
 *
 * `page.clock.setFixedTime` freezes what the page reads from `Date` and leaves
 * the timers alone, so animations, the ad countdown and every `setTimeout` in
 * the app run exactly as they do for a player — this is not a fake-timer
 * install. Noon rather than midnight so a machine on a non-UTC clock lands on
 * the same date either way.
 *
 * `--day=2026-09-18` replays a specific day, which is how a failed desktop run
 * is looked at tomorrow.
 */
const DAY = process.argv.find((a) => a.startsWith('--day='))?.slice(6) ?? new Date().toISOString().slice(0, 10);
const DAY_NOON = new Date(`${DAY}T12:00:00Z`);
if (Number.isNaN(DAY_NOON.getTime())) {
  console.error(`verify-ui: --day=${DAY} is not a date. Use --day=YYYY-MM-DD.`);
  process.exit(1);
}

/**
 * Which Chromium.
 *
 * The dev container ships one at a fixed path and Playwright will not find it
 * on its own; CI installs its own and there is nothing at that path. Pointing at
 * a binary that is not there fails with a stack trace rather than a useful
 * message, so the path is used only if it exists and Playwright resolves its
 * own otherwise.
 */
const BROWSER = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
const LAUNCH = existsSync(BROWSER) ? { executablePath: BROWSER } : {};

/** Buttons are found by their copy, so these must match the dictionaries. */
const START = { en: 'Start career', zh: '开启生涯' };
const CONFIRM = { en: 'Sign your first forms', zh: '签下第一份合同' };
const BOARDS = { en: 'The three world rankings', zh: '三个世界排名' };
const HOWTO = { en: 'How to play', zh: '玩法' };
const NEWS = { en: "What's new", zh: '更新了什么' };
const SETTINGS = { en: 'Settings', zh: '设置' };
const HANDBOOK = { en: 'Strategy handbook', zh: '进阶攻略' };
const ABOUT = { en: 'About Decision FC', zh: '关于游戏' };
const FAQ = { en: 'FAQ', zh: '常见问题' };
const DAILY = { en: 'Daily challenge', zh: '每日挑战' };
const DAILY_START = { en: "Today's career", zh: '今天的生涯' };
const DAILY_STANDING = { en: "Today's challenge", zh: '今日挑战' };

/**
 * What a player who used the career archive still has on their device.
 *
 * The archive was removed on 2026-09-23 and `storage.ts` now deletes its key at
 * boot, because a privacy page that lists what this game stores should not
 * have an exception it does not mention. Written before the app loads, exactly
 * as the locale rename below is, and asserted gone once it has — the only way
 * to prove a deletion is to have something there to delete.
 */
const RETIRED_HISTORY = JSON.stringify([{ seed: 'fixture-0', legacy: 900, endingId: 'solid_pro' }]);
const REPLAY = { en: 'Play again', zh: '再来一次' };

/**
 * What gets played, and where.
 *
 * The full career runs at one size per mode — twenty-five cards is a minute of
 * wall clock and running it six times says nothing the first two runs did not.
 * The other desktop sizes get the layout checks, which is where a size-specific
 * bug would actually show up.
 */
const VIEWPORTS = DESKTOP
  ? [
      { width: 1440, height: 900, career: true },
      { width: 1920, height: 1080, career: false },
      { width: 1280, height: 720, career: false },
    ]
  : [{ width: 375, height: 667, career: true }];

/** The cap declared in `styles/app.css`. Kept in step by the check below. */
const FRAME_MAX_HEIGHT = 780;
/**
 * One column, and two.
 *
 * Everything except the career screen is composed for a phone's column and is
 * capped at 420: widening the intro or the identity picker leaves the content
 * in a 420px band with dead space beside it, which is the fault the frame was
 * built to fix. The career screen is the one that earns the width, because it
 * has a second thing worth showing — the record — and on a computer the
 * question and the record belong in view together.
 */
const FRAME_MAX_WIDTH = 420;
const FRAME_MAX_WIDTH_TWO_COL = 880;
/** Below this the career screen is one column too; see `wide` in app.css. */
const TWO_COL_MIN_WIDTH = 1040;

const browser = await chromium.launch(LAUNCH);
let failed = false;

for (const viewport of VIEWPORTS) {
  const size = `${viewport.width}×${viewport.height}`;

  for (const locale of ['en', 'zh']) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();
    // Only the desktop run: the phone run starts a random career, and its
    // value is that it sees a different world every time.
    if (DESKTOP) await page.clock.setFixedTime(DAY_NOON);
    // The phone run is an iPhone SE, so it gets an iPhone SE's status bar:
    // 20pt of the 667 that no screen may put anything under. Without it every
    // screen was checked with room a real phone does not have.
    else {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 20, bottom: 0, left: 0, right: 0 } });
    }
    const errors = [];
    const notFound = new Set();
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('response', (r) => r.status() >= 400 && notFound.add(`${r.status()} ${r.url()}`));

    /**
     * The harness must not talk to the live leaderboard.
     *
     * Two reasons, and the second is why CI went red rather than why this is
     * merely tidy.
     *
     * It was posting every one of these throwaway careers to the production
     * board. Four fake retirements per run, on every push, ranked against real
     * players. That is junk in a live product and nobody had noticed.
     *
     * And it made the harness fail on exactly the changes it should pass. The
     * leaderboard verifies a submission by replaying it through the *deployed*
     * engine; a pull request that changes the engine is therefore guaranteed a
     * 422 "claimed scores do not reproduce", because the client already scores
     * the new way and the server still scores the old way until the bundle
     * redeploys on merge. The scoring fix in this branch turned that into a red
     * build for a difference that was entirely correct.
     *
     * Stubbed rather than aborted so the summary screen still runs its real
     * leaderboard path — an abort would silently exercise the offline fallback
     * instead, which is not the code a player hits.
     */
    await page.route('**/functions/v1/career-submit', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        // The real response shape, which this stub did not have. It answered
        // with the three boards at the top level and no `verified`, so
        // `submit()` read it as a failure, returned null, and the summary fell
        // back to the local estimate — the exact code path the comment above
        // says is being avoided. Two years of "the real leaderboard path runs
        // here" that did not.
        body: JSON.stringify({
          verified: true,
          boards: {
            legacy: { rank: 1234, total: 100000, percent: 1.2 },
            wealth: { rank: 2345, total: 100000, percent: 2.3 },
            value: { rank: 3456, total: 100000, percent: 3.5 },
            sameWorld: { rank: 3, total: 47, percent: 6.4 },
          },
        }),
      }),
    );

    /**
     * The **old** locale key, deliberately.
     *
     * Seven storage keys in three prefixes were renamed into one `fc:`
     * namespace, and `migrateStorage()` moves the four old names at boot. That
     * migration has no unit test — `apps/web` has no test runner — so it is
     * tested here instead, and tested by something that cannot pass while
     * broken: if the rename stops working, this run gets English when it asked
     * for Chinese and every zh assertion below fails on its own text.
     *
     * When the migration is eventually deleted, this line becomes
     * `KEYS.locale` and the check goes with it.
     */
    await page.addInitScript((loc) => localStorage.setItem('bg:locale', loc), locale);
    await page.addInitScript((history) => localStorage.setItem('fc:history:v1', history), RETIRED_HISTORY);
    /**
     * The app's own state hook, on, for one reason: **a failure here has to
     * name the career that caused it.**
     *
     * This harness plays an unseeded career, which is deliberate — the random
     * coverage is what found the stacked celebration-and-relegation overlay
     * that a fixed seed would have missed for months. The cost was that a
     * failure could never be looked at again. CI went red on a docs-only
     * commit with `key 1 did not resolve card 15`, and the only way to find out
     * why was to read the source and reason about which season could produce
     * it.
     *
     * So the seed is published and printed on every failure. The run still
     * cannot be replayed *through the screen* — there is no seed entry point in
     * the UI and adding one for a test would be the tail wagging the dog — but
     * it can be replayed through the engine, which is where the answer was
     * last time and is a two-line script rather than an afternoon.
     */
    await page.addInitScript(() => localStorage.setItem('fc:testhook', '1'));
    await page.goto(BASE, { waitUntil: 'networkidle' });

    /**
     * The seed of the career being played, read once it exists.
     *
     * Held in a variable rather than fetched inside `fail` so that `fail`
     * stays synchronous: it is called from twenty-nine places, several of them
     * inside non-async callbacks, and an unawaited log would race
     * `process.exit` at the bottom of this file and print nothing at all. The
     * seed does not change during a career, so one read is enough.
     */
    let seed = null;
    const readSeed = async () => {
      seed = await page
        .evaluate(() => (window.__fcState && window.__fcState.seed) || null)
        .catch(() => null);
    };

    const fail = (message) => {
      failed = true;
      console.log(`  ✗ ${size} ${locale} ${message}${seed ? `  [seed ${seed}]` : ''}`);
    };

    // The invariant is that the *document* never scrolls. Individual elements
    // may overflow their box on purpose — the decorative glows are deliberately
    // oversized and clipped by an `overflow-hidden` ancestor.
    const overflow = async (label) => {
      const bad = await page.evaluate(() => {
        const d = document.documentElement;
        const out = [];
        if (d.scrollWidth > d.clientWidth + 1) out.push(`x ${d.scrollWidth}>${d.clientWidth}`);
        if (d.scrollHeight > d.clientHeight + 1) out.push(`y ${d.scrollHeight}>${d.clientHeight}`);
        return out;
      });
      if (bad.length) fail(`document scrolls at ${label}: ${bad.join(', ')}`);
    };

    /**
     * No line may end a block of text with a single character or word.
     *
     * The rule since 2026-09-23: a Chinese line whose last row is one lone
     * 字, or an English one ending on a single word, reads as a layout fault
     * even when nothing overflows — and the one-screen rule makes it worse,
     * because a stranded character costs a whole line of a screen that has
     * none to spare. `text-wrap: pretty` in app.css is the fix; this is what
     * proves it held, on every screen the run passes through, in both
     * languages and at every size.
     *
     * Measured per rendered line, not per string: a string is fine or not only
     * at a width, and the widths are what change between the phone and the
     * three desktop sizes. Each character's box is read with a Range, grouped
     * into lines by vertical overlap, and the last line of every wrapping block
     * is judged — one CJK character (punctuation does not count as company), or
     * one Latin word. Text that cannot wrap (`nowrap`, `truncate`) or is
     * clamped is skipped: it has no last line to strand.
     */
    const orphans = async (label) => {
      const found = await page.evaluate(() => {
        const BLOCKY = new Set(['block', 'flex', 'grid', 'list-item', 'table', 'table-cell', 'flow-root', 'inline-block', 'inline-flex', 'inline-grid']);
        const blockOf = (node) => {
          let el = node.parentElement;
          while (el && !BLOCKY.has(getComputedStyle(el).display)) el = el.parentElement;
          return el;
        };
        const blocks = new Set();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (!n.nodeValue.trim() || n.parentElement?.closest('svg,script,style')) continue;
          const block = blockOf(n);
          if (block) blocks.add(block);
        }
        const out = [];
        for (const block of blocks) {
          const cs = getComputedStyle(block);
          if (cs.visibility === 'hidden' || cs.whiteSpace.includes('nowrap') || cs.textWrapMode === 'nowrap') continue;
          if (cs.webkitLineClamp && cs.webkitLineClamp !== 'none') continue;
          const box = block.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) continue;
          const chars = [];
          const tw = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
          for (let t = tw.nextNode(); t; t = tw.nextNode()) {
            if (blockOf(t) !== block) continue;
            const text = t.nodeValue;
            for (let i = 0; i < text.length; i += 1) {
              if (/\s/.test(text[i])) {
                chars.push(null);
                continue;
              }
              const range = document.createRange();
              range.setStart(t, i);
              range.setEnd(t, i + 1);
              const rect = [...range.getClientRects()].find((q) => q.width > 0);
              if (rect) chars.push({ ch: text[i], top: rect.top, bottom: rect.bottom });
            }
          }
          const lines = [];
          let prev = null;
          for (const c of chars) {
            if (c === null) {
              if (lines.length) lines[lines.length - 1] += ' ';
              continue;
            }
            if (!prev || c.top >= prev.bottom - 1) lines.push('');
            lines[lines.length - 1] += c.ch;
            prev = c;
          }
          if (lines.length < 2) continue;
          const last = lines[lines.length - 1].trim();
          const cjk = [...last.replace(/[\p{P}\p{S}]/gu, '')];
          const loneHan = cjk.length === 1 && /[\u3400-\u9fff]/.test(cjk[0]);
          const loneWord = /^[\p{L}\p{N}’'-]+[\p{P}]*$/u.test(last) && !/[\u3400-\u9fff]/.test(last);
          if (loneHan || loneWord) out.push(`“${lines.slice(-2).join(' / ').slice(-60)}”`);
        }
        return out;
      });
      for (const f of found) if (!orphanSeen.has(f)) orphanSeen.set(f, label);
    };
    const orphanSeen = new Map();

    await overflow('intro');
    await orphans('intro');

    /**
     * Every reference sheet, read while it is open.
     *
     * The densest text in the game is not on a card — it is the handbook, the
     * FAQ, About and How to play, paragraph after paragraph at a narrow
     * measure, which is exactly where a stranded last character lives. None of
     * them was ever opened by this harness (the rankings sheet was, and then
     * closed before anything read it). So each is opened, checked for orphans
     * and closed, at every size and in both languages.
     */
    const readOpenSheet = async (label) => {
      await page.waitForTimeout(350);
      if ((await page.locator('[data-sheet]').count()) === 0) {
        fail(`the ${label} did not open`);
        return;
      }
      await orphans(label);
      for (let tries = 0; tries < 4 && (await page.locator('[data-sheet]').count()) > 0; tries += 1) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    };
    for (const [label, door] of [
      ['how-to-play sheet', HOWTO],
      ['rankings sheet', BOARDS],
      ['news sheet', NEWS],
    ]) {
      const button = page.getByText(door[locale], { exact: false }).first();
      // The news line only exists while there is something unread.
      if ((await button.count()) === 0) continue;
      await button.click();
      await readOpenSheet(label);
    }
    for (const [label, row] of [
      ['handbook', HANDBOOK],
      ['about sheet', ABOUT],
      ['FAQ', FAQ],
    ]) {
      await page.getByRole('button', { name: SETTINGS[locale] }).first().click();
      await page.waitForTimeout(300);
      await orphans('settings');
      await page.locator('[data-sheet]').getByText(row[locale], { exact: true }).first().click();
      await readOpenSheet(label);
    }

    // The retired archive key, written before boot, must be gone after it.
    if ((await page.evaluate(() => localStorage.getItem('fc:history:v1'))) !== null) {
      fail('the retired career-archive key survived boot — storage.ts did not delete it');
    }

    // ---- desktop layout -----------------------------------------------------
    if (DESKTOP) {
      const frame = await page.locator('.app-frame').boundingBox();
      if (!frame) {
        fail('no .app-frame — the desktop shell did not render');
      } else {
        // Capped, not stretched. This is the whole point of the frame: before
        // it, a 900px window put the header at the top, the decision card at
        // the bottom, and four hundred pixels of nothing between them.
        if (frame.height > FRAME_MAX_HEIGHT + 1) {
          fail(`frame is ${Math.round(frame.height)}px tall, cap is ${FRAME_MAX_HEIGHT}`);
        }
        if (frame.height >= viewport.height - 1) fail('frame fills the window height — is the cap applied?');
        if (frame.width > FRAME_MAX_WIDTH + 1) fail(`frame is ${Math.round(frame.width)}px wide`);
        const centre = frame.x + frame.width / 2;
        if (Math.abs(centre - viewport.width / 2) > 2) fail(`frame is off-centre by ${Math.round(centre - viewport.width / 2)}px`);
      }

      // A sheet has to dock to the game, not to the browser window. `fixed`
      // resolving against `.app-frame` is what does this, and it is one CSS
      // property away from silently reverting to viewport-fixed.
      await page.getByText(BOARDS[locale], { exact: false }).first().click();
      await page.waitForTimeout(300);
      const sheet = await page.locator('[data-sheet] > div:last-child').boundingBox();
      if (!sheet) fail('the rankings sheet did not open');
      else if (frame && sheet.y + sheet.height > frame.y + frame.height + 2) {
        fail(`the sheet hangs ${Math.round(sheet.y + sheet.height - frame.y - frame.height)}px below the frame`);
      }
      // Escape closes it — the desktop affordance that did not exist.
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      if ((await page.locator('[data-sheet]').count()) > 0) fail('Escape did not close the sheet');
      await overflow('sheet');
      await orphans('sheet');
    }

    if (!viewport.career) {
      // Layout-only pass: through the identity screen to the first card, which
      // is where a size-specific overflow would show, then stop.
      await page.getByText(START[locale], { exact: false }).first().click();
      await page.waitForTimeout(300);
      await overflow('identity');
      await orphans('identity');
      await page.locator('input:not([type="number"])').first().fill('Hernández');
      await page.getByText(CONFIRM[locale], { exact: false }).first().click();
      await page.waitForTimeout(600);
      await readSeed();
      await overflow('first card');
      await orphans('first card');
      if (errors.length) fail(`console errors: ${errors.slice(0, 3).join(' | ')}`);
      if (orphanSeen.size) {
        fail(
          `${orphanSeen.size} block(s) of text end on a lone character or word: ` +
            [...orphanSeen].slice(0, 8).map(([text, where]) => `${text} (${where})`).join(' · '),
        );
      }
      console.log(`${size} ${locale}: layout ok`);
      await context.close();
      continue;
    }

    /**
     * Which door the career comes in by, and why the two runs differ.
     *
     * The **phone** run starts a random career. That randomness is not
     * laziness — it is what found the season that brought both silverware and
     * relegation, whose stacked overlays each ate a keypress and failed a
     * keyboard binding that was working. A fixed world would have missed it for
     * months.
     *
     * The **desktop** run comes in through the daily challenge, which fixes the
     * seed to today's date. That buys two things a random start cannot. The
     * daily standing on the summary only renders for a daily career, so this is
     * the only way it is ever behind a gate at all. And with the clock pinned
     * at `DAY_NOON` the run is reproducible for good, with `--day=`, rather
     * than until the next midnight.
     *
     * Between them: random coverage every run, and a deterministic run that
     * still sees a different world tomorrow.
     */
    if (DESKTOP) {
      await page.getByText(DAILY[locale], { exact: false }).first().click();
      await page.waitForTimeout(300);
      await overflow('daily sheet');
      await orphans('daily sheet');
      // Scoped to the sheet: the intro card's own hint line carries the same
      // words, and once the sheet is open that line is behind it — Playwright
      // found the card, the sheet intercepted the click, and the run timed out.
      await page
        .locator('[data-sheet]')
        .getByText(DAILY_START[locale], { exact: false })
        .first()
        .click();
    } else {
      await page.getByText(START[locale], { exact: false }).first().click();
    }
    await page.waitForTimeout(300);
    await overflow('identity');
    await orphans('identity');

    await page.locator('input:not([type="number"])').first().fill('Hernández');
    await page.getByText(CONFIRM[locale], { exact: false }).first().click();
    await page.waitForTimeout(500);
    await readSeed();
    await overflow('first card');
    await orphans('first card');

    /**
     * The two-column career screen, which only exists on a wide window.
     *
     * Asserted here rather than at the intro because the intro is deliberately
     * *not* two columns — the flag that widens the frame is set by the screen
     * that has a second column to put in it.
     */
    if (DESKTOP) {
      const wide = viewport.width >= TWO_COL_MIN_WIDTH;
      const record = await page.locator('[data-record-column]').boundingBox();
      const frame = await page.locator('.app-frame').boundingBox();
      if (wide) {
        if (!record) fail('no record column on a wide window');
        if (!frame || frame.width <= FRAME_MAX_WIDTH) fail('the frame did not widen for the career screen');
        if (frame && frame.width > FRAME_MAX_WIDTH_TWO_COL + 1) {
          fail(`two-column frame is ${Math.round(frame.width)}px wide`);
        }
        const decision = await page.locator('[data-option-id]').first().boundingBox();
        if (record && decision && record.x <= decision.x) {
          fail('the record column is not beside the decision');
        }
      } else if (record) {
        fail(`record column showing at ${viewport.width}px, below the two-column threshold`);
      }
    }

    let cards = 0;
    let keyboardWorked = false;
    const untranslated = new Set();
    for (; cards < 400; cards += 1) {
      if (locale === 'zh') await checkUntranslated(page, untranslated);
      const options = page.locator('[data-option-id]');
      const count = await options.count();
      if (count === 0) break;
      if (count > 3) fail(`${count} options on one card`);

      // Waiting on the card actually changing, rather than on a fixed delay: the
      // settle beat is 800ms but a gamble holds the roulette for 2.3s.
      //
      // `data-decision` counts answered decisions, so it changes on exactly the
      // event we are waiting for. It replaced comparing the first option's id,
      // which is not an identity: ten cards in the deck open with the same
      // option id as another card, so two of them back to back read as a card
      // that never moved and failed a keypress that had worked.
      const before = await page.getAttribute('[data-decision]', 'data-decision');
      const slot = cards % count;
      // Every fourth card is played from the keyboard, so the binding is
      // exercised across real cards rather than once in isolation — including
      // the ones that follow a celebration, which is where a guard that never
      // releases would show up.
      const byKey = DESKTOP && cards % 4 === 3;
      const settled = () =>
        page
          .waitForFunction(
            (prev) => {
              const card = document.querySelector('[data-decision]');
              return !card || card.getAttribute('data-decision') !== prev;
            },
            before,
            { timeout: 6000 },
          )
          .then(() => true)
          .catch(() => false);

      if (byKey) {
        /**
         * Overlays eat a keypress each, and they STACK — which is why this
         * presses up to three times rather than twice.
         *
         * A celebration and a relegation card are both tap-to-dismiss cards
         * sitting over the decision, and `Career.tsx` renders the relegation
         * one *behind* silverware (`{!celebrate && relegation ? … }`) rather
         * than instead of it. Its key handler dismisses whichever is on top and
         * returns, so a season that brings both a medal and the drop needs
         * press one to clear the celebration, press two to clear the
         * relegation, and only press three chooses an option. Two presses were
         * the whole allowance, so that season failed a keyboard binding that
         * was working perfectly — which is what it did on 2026-09-05, once, on
         * a documentation-only commit, at card 15 of an English 1440×900
         * career. The harness plays an unseeded career, so that run cannot be
         * replayed; the same commit passed on re-run and in four local runs.
         *
         * The allowance is one press per dismissable layer plus the one that
         * chooses. It is not a blind retry loop: a keyboard binding that is
         * genuinely broken, or the guard that never releases which this check
         * exists to catch, still fails here, because a third press with nothing
         * left to dismiss has nothing else to be consumed by.
         */
        const DISMISSABLE_LAYERS = 2; // celebration, then relegation behind it
        let moved = false;
        for (let press = 0; press <= DISMISSABLE_LAYERS && !moved; press += 1) {
          await page.keyboard.press(String(slot + 1));
          // The short wait is enough for a press that landed on the decision;
          // a press consumed by an overlay cannot have moved the card, so
          // there is nothing to wait for. The last press gets the full settle,
          // which is what a gamble's roulette needs.
          moved =
            press === DISMISSABLE_LAYERS
              ? await settled()
              : await page
                  .waitForFunction(
                    (prev) => {
                      const card = document.querySelector('[data-decision]');
                      return !card || card.getAttribute('data-decision') !== prev;
                    },
                    before,
                    { timeout: 1200 },
                  )
                  .then(() => true)
                  .catch(() => false);
        }
        if (moved) keyboardWorked = true;
        else fail(`key ${slot + 1} did not resolve card ${cards}`);
      } else {
        await options.nth(slot).click();
        await settled();
      }
      if (cards % 9 === 0) await overflow(`card ${cards}`);
      // Every card, not every ninth: each one is new copy at this width.
      await orphans(`card ${cards}`);
    }

    await page.waitForTimeout(800);
    await overflow('summary');
    await orphans('summary');

    /**
     * The daily standing, asserted in both directions.
     *
     * The server returns a same-seed board for *every* run — it has no opinion
     * about which seed today's is — so the decision about whether the player
     * earned a challenge board is made on the client from the seed's shape and
     * the pace. Both halves of that gate are worth a check: the desktop run
     * played the daily and must show it, the phone run played a random career
     * and must not, even though the stub handed it the same board.
     */
    const dailyRow = await page.getByText(DAILY_STANDING[locale], { exact: false }).count();
    if (DESKTOP && dailyRow === 0) fail('a daily career shows no daily standing on the summary');
    if (!DESKTOP && dailyRow > 0) fail('a random career shows a daily standing it did not earn');

    await page.screenshot({ path: `${SHOTS}/verify-${DESKTOP ? 'desk-' : ''}${locale}-summary.png` });

    // ---- the ad, which must not take the whole screen ----------------------
    /**
     * Spend today's free replay, so the button at the end of the career opens
     * the rewarded ad instead of restarting silently. The shape is `Stored` in
     * `lib/ads.ts`.
     *
     * Written **here**, immediately before the click, rather than once at page
     * load — the ladder resets on the calendar day, and a career takes ninety
     * seconds. A run that started at 23:59 UTC seeded the 29th, finished on the
     * 30th, and `replaysToday` correctly threw the stale record away and handed
     * out a free replay. The check then waited thirty seconds for an ad that was
     * never coming and killed the whole harness. Exactly what "the ladder
     * resets daily" is supposed to do, and exactly the wrong thing to assume
     * would not happen during the run.
     */
    await page.evaluate(() => {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      localStorage.setItem('fc:ads', JSON.stringify({ day, replays: 1 }));
    });
    await page.getByText(REPLAY[locale], { exact: false }).first().click();
    // Bounded, and reported rather than thrown. A missing ad is one failed
    // assertion among many; it should not take the other five sizes down with it.
    const ad = await page
      .waitForSelector('[data-ad]', { timeout: 8000 })
      .then((handle) => handle.boundingBox())
      .catch(() => null);
    if (!ad) {
      fail('the rewarded ad did not open on the second replay of the day');
    } else {
      await page.screenshot({ path: `${SHOTS}/verify-${DESKTOP ? 'desk-' : ''}${locale}-ad.png` });
      if (DESKTOP) {
        // A requirement, and a check rather than a comment: on a
        // computer the ad is a panel in the middle of the page, never a
        // takeover. `fixed inset-0` resolving against `.app-frame` is what
        // holds it there.
        const share = (ad.width * ad.height) / (viewport.width * viewport.height);
        if (ad.width > FRAME_MAX_WIDTH + 1) fail(`the ad is ${Math.round(ad.width)}px wide — it escaped the frame`);
        if (share > 0.35) fail(`the ad covers ${Math.round(share * 100)}% of the window`);
      }
      await overflow('ad');
      await orphans('ad');
    }

    const keys = await page.evaluate(
      () => (document.body.innerText.match(/\b[a-z]+\.[a-zA-Z_.]+\b/g) ?? []).slice(0, 6),
    );
    const broken = await page.evaluate(() =>
      [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src).slice(0, 5),
    );

    console.log(`${size} ${locale}: ${cards} cards, ${errors.length} console errors, ${broken.length} broken images`);
    if (errors.length) fail(`errors: ${errors.slice(0, 4).join(' | ')}`);
    if (orphanSeen.size) {
      fail(
        `${orphanSeen.size} block(s) of text end on a lone character or word: ` +
          [...orphanSeen].slice(0, 8).map(([text, where]) => `${text} (${where})`).join(' · '),
      );
    }
    if (broken.length) fail(`broken images: ${broken.join(' ')}`);
    // A career that stops after a handful of cards means the harness lost the
    // flow, not that the career was short. Silence there is worse than a failure.
    if (cards < 15) fail(`career ended after ${cards} cards — check the selectors`);
    if (untranslated.size) fail(`engine ids reached the screen untranslated: ${[...untranslated].join(', ')}`);
    if (DESKTOP && !keyboardWorked) fail('no card was ever resolved by a number key');
    if (notFound.size) console.log('  ? non-200 responses:', [...notFound].slice(0, 4));
    if (keys.length) console.log('  ? dotted strings (check for raw i18n keys):', keys);
    await context.close();
  }
}

/**
 * The title screen is whole on every phone shape, with the phone's real safe
 * areas.
 *
 * The runs above use a bare 375×667 viewport with no status bar, which is why
 * they never saw what an iPhone showed after the iOS 26 update: the
 * intro's hero centred in a box shorter than itself, spilling the eyebrow up
 * under the clock and the subtitle off the bottom. Chromium can emulate safe
 * areas over CDP, so each shape below is loaded with its own insets —
 * including the iOS 26 short window (WebKit bug 301108: one status bar shorter
 * than the screen, drawn from the top) for anybody whose home-screen icon
 * still carries the old status-bar style — and the hero is asserted whole:
 * its top below the status bar and its bottom inside its box.
 *
 * Phone only, and cheap: a page load per shape, no career.
 */
if (!DESKTOP) {
  const SHAPES = [
    ['iPhone SE', 375, 667, 20, 0],
    ['iPhone 13 mini', 375, 812, 50, 34],
    ['iPhone 13 mini, iOS 26 short window', 375, 762, 50, 34],
    ['iPhone 17 Pro', 402, 812, 0, 34],
    ['iPhone 17 Pro, iOS 26 short window', 402, 812, 62, 34],
    ['iPhone 17 Pro Max', 440, 894, 0, 34],
    ['Android', 360, 800, 0, 0],
  ];
  for (const locale of ['en', 'zh']) {
    for (const [name, width, height, top, bottom] of SHAPES) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      await page.addInitScript((loc) => localStorage.setItem('fc:locale', loc), locale);
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top, bottom, left: 0, right: 0 } });
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(700);
      const hero = await page.evaluate(() => {
        const box = document.querySelector('.intro-hero')?.getBoundingClientRect();
        const content = document.querySelector('.intro-hero > div')?.getBoundingClientRect();
        const probe = document.createElement('div');
        probe.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top,0px)';
        document.body.appendChild(probe);
        const safe = probe.getBoundingClientRect().height;
        probe.remove();
        const d = document.documentElement;
        return box && content
          ? { box: [box.top, box.bottom], content: [content.top, content.bottom], safe, scrolls: d.scrollHeight > d.clientHeight + 1 }
          : null;
      });
      const where = `${name} ${locale}`;
      if (!hero) {
        failed = true;
        console.log(`  ✗ ${where}: no intro hero on the page`);
      } else {
        const problems = [];
        if (hero.content[0] < hero.safe - 0.5) problems.push(`top ${Math.round(hero.content[0])}pt is under the status bar (${hero.safe}pt)`);
        if (hero.content[0] < hero.box[0] - 1) problems.push('spills above its box');
        if (hero.content[1] > hero.box[1] + 1) problems.push(`cut off ${Math.round(hero.content[1] - hero.box[1])}pt at the bottom`);
        if (hero.scrolls) problems.push('the document scrolls');
        if (problems.length) {
          failed = true;
          console.log(`  ✗ ${where}: the intro hero ${problems.join(', ')}`);
        }
      }
      /*
       * Choosing a pace moves nothing else on the screen (a rule since
       * 2026-09-23). Standard's description was a line shorter than the other
       * two, and the hero above takes whatever height is left — so picking it
       * slid the title and the pace buttons down 14pt in English (Deep did it
       * in Chinese), while the start button, anchored to the bottom, stayed
       * put. So the hero, the title's size, the pace buttons, the description
       * and everything after it are measured under each pace, and all of it
       * has to sit in exactly the same place.
       */
      const layoutFor = async (pace) => {
        await page.click(`[data-pace="${pace}"]`);
        await page.waitForTimeout(200);
        return page.evaluate(() => {
          const blurb = document.querySelector('[data-pace-blurb]');
          if (!blurb) return null;
          const after = [];
          let node = blurb;
          while (node) {
            let next = node.nextElementSibling;
            while (next) {
              after.push(next);
              next = next.nextElementSibling;
            }
            node = node.parentElement?.closest('.app-frame *') ? node.parentElement : null;
          }
          const above = [document.querySelector('.intro-hero > div'), document.querySelector('[data-pace="quick"]')];
          const title = document.querySelector('.intro-title');
          return [
            title ? getComputedStyle(title).fontSize : 'no title',
            ...[...above, blurb, ...after].map((el) => {
              if (!el) return 'missing';
              const r = el.getBoundingClientRect();
              return `${Math.round(r.top)}/${Math.round(r.height)}`;
            }),
          ].join(' ');
        });
      };
      const layouts = {};
      for (const pace of ['quick', 'standard', 'deep']) layouts[pace] = await layoutFor(pace);
      if (!layouts.standard || layouts.quick !== layouts.standard || layouts.deep !== layouts.standard) {
        failed = true;
        console.log(`  ✗ ${where}: choosing a pace moves the rest of the intro — ${JSON.stringify(layouts)}`);
      }
      await context.close();
    }
  }
  console.log(`intro: whole, and still under every pace, on ${SHAPES.length} phone shapes with their safe areas, both languages`);
}

/**
 * The game still starts with the network switched off.
 *
 * Its own context, at the end, because going offline inside a career would take
 * the rest of the run with it. Phone only: the service worker is one piece of
 * code and running the same check at four window sizes says nothing the first
 * one did not.
 *
 * This is the gate for the offline shell, and without it that feature would
 * rot silently — the failure mode of a broken service worker is a *first* visit
 * that works perfectly and a second one that shows the browser's error page,
 * which is the one thing nobody tests by hand.
 */
if (!DESKTOP) {
  const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const page = await context.newPage();
  const offline = (message) => {
    failed = true;
    console.log(`  ✗ offline ${message}`);
  };
  try {
    await page.goto(BASE, { waitUntil: 'load' });
    // The worker registers on `load` and has to finish before the cache can
    // answer anything. Bounded: a browser that never activates it is a
    // failure, not a reason to hang.
    const ready = await page
      .waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    if (!ready) {
      offline('the service worker never took control of the page');
    } else {
      // Warm the shell the way a first visit does, then cut the wire.
      await page.waitForTimeout(1500);
      await context.setOffline(true);
      /*
       * The reload is caught, and that is the whole point of this block.
       *
       * When the worker does not serve the document — the exact failure this
       * gate exists for — Playwright's `reload()` *rejects* with
       * `net::ERR_INTERNET_DISCONNECTED`. Uncaught, that escapes to the top
       * level: the browser is never closed, `process.exit` never runs, and the
       * PASS/FAIL line never prints, so any earlier failure in the run loses
       * its verdict and the report becomes a stack trace. CI still goes red,
       * which is why this was invisible until an audit looked for it.
       */
      const reloaded = await page
        .reload({ waitUntil: 'domcontentloaded' })
        .then(() => true)
        .catch(() => false);
      const booted =
        reloaded &&
        (await page
          .waitForFunction(() => document.body.innerText.trim().length > 40, null, { timeout: 15000 })
          .then(() => true)
          .catch(() => false));
      if (!booted) offline('the game did not start from cache with the network off');
      else console.log('offline: the game starts with the network off');
    }
  } finally {
    await context.setOffline(false);
    await context.close();
  }
}

await browser.close();
console.log(failed ? 'FAIL' : 'PASS');
process.exit(failed ? 1 : 0);
