/**
 * Play the game. Not the engine — the game, through the screen, one tap at a
 * time, the way a player meets it.
 *
 * Eighteen faults turned up in a single career's worth of play, then a
 * dozen more in the next one. Every automated check this repo already has
 * passed while those existed, because each of them checks a *property* — the
 * odds are real, the option does what it said, no card is a non-decision — and
 * none of them reads the card. A sentence that no human can parse is not a
 * property violation. Neither is a consequence that contradicts the one before
 * it, or a keeper credited with fifteen goals.
 *
 * So this harness does three things the other checks do not:
 *
 *   1. It **captures every card it is shown** — title, body, every option, every
 *      consequence line, and the result that followed — into a JSONL file. That
 *      file is then read (see `read-playtest.mjs`), which is the only way the
 *      copy class of fault gets found.
 *   2. It checks what a machine *can* judge on every single card: a raw i18n
 *      key on screen, an engine id that never got translated, text clipped by
 *      its own box, a console error, a broken image, a document that scrolls.
 *   3. It reads the career *state* behind the screen (an opt-in hook the app
 *      publishes for it — see `App.tsx`) and holds it to what football allows:
 *      ages that count one by one, ability that never falls off a cliff, a
 *      keeper who does not score, a season that never has sixty appearances.
 *      The screen saying it nicely is worthless if what it says is nonsense.
 *
 * The matrix, verbatim: 2 languages × 4 modes (quick, standard,
 * deep, and the daily challenge) × 4 player profiles (the three archetypes and
 * the goalkeeper, who plays a materially different game) = 32 combinations,
 * ×100 careers each = 3,200 careers, the full user lifecycle every time —
 * intro → identity → every card → summary → the share sheet → play again.
 *
 * Reduced motion is on deliberately: it skips the settle beat, the roulette and
 * the celebration timers, which are the only reason a career takes ninety
 * seconds instead of five. Everything those animations delay is still checked —
 * the beat is presentation, and `verify:ui` covers it at real speed.
 *
 *   node tools/playtest.mjs --combo=en/standard/technical --careers=100
 *   node tools/playtest.mjs --careers=2        # pilot: every combo, 2 each
 */
import { existsSync, appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from 'playwright';

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};

const BASE = process.env.BASE ?? 'http://127.0.0.1:4173';
const OUT = arg('out', '/tmp/playtest/run');
const CAREERS = Number(arg('careers', 2));
const ONLY = arg('combo', null); // "en/standard/technical" — one combination
const BROWSER = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
const LAUNCH = existsSync(BROWSER) ? { executablePath: BROWSER } : {};

const LOCALES = ['en', 'zh'];
/** The three paces plus the daily challenge, which pins pace and seed. */
const MODES = ['quick', 'standard', 'deep', 'daily'];
/**
 * The three archetypes, plus the goalkeeper as a profile of his own.
 *
 * A keeper is not a fourth archetype — he picks one of the same three — but he
 * is a fourth *game*: different attribute names, a near-binary appearance
 * model, his own stats columns, his own events. A sweep that cycles GK in as
 * one position among twelve gives him one-twelfth of the coverage of a game
 * that is one-quarter different, which is how `decisive_save` shipped unread.
 */
const PROFILES = ['pace', 'technical', 'physical', 'gk'];

const COMBINATIONS = [];
for (const locale of LOCALES) {
  for (const mode of MODES) {
    for (const profile of PROFILES) COMBINATIONS.push({ locale, mode, profile });
  }
}

/**
 * The words each screen is found by, per language.
 *
 * Deliberately the visible copy rather than a test id: if a button's label
 * stops making sense, this harness stops working, which is itself the signal.
 */
const UI = {
  en: {
    start: 'Start career',
    confirm: 'Sign your first forms',
    daily: 'Daily challenge',
    dailyStart: "Today's career",
    viewSummary: 'View summary',
    replay: 'Play again',
    paces: { quick: 'Quick', standard: 'Standard', deep: 'Deep' },
    types: { pace: 'Speed', technical: 'Technical', physical: 'Physical' },
    gk: 'GK',
    positions: ['CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'],
    countries: ['England', 'Brazil', 'Norway', 'Japan', 'Nigeria', 'Iceland'],
  },
  zh: {
    start: '开启生涯',
    confirm: '签下第一份合同',
    daily: '每日挑战',
    dailyStart: '今天的生涯',
    viewSummary: '查看总结',
    replay: '再来一次',
    paces: { quick: '快速', standard: '标准', deep: '沉浸' },
    types: { pace: '速度型', technical: '技术型', physical: '身体型' },
    gk: '门将',
    positions: ['中卫', '左后卫', '右后卫', '后腰', '中场', '前腰', '左边锋', '右边锋', '中锋'],
    countries: ['英格兰', '巴西', '挪威', '日本', '尼日利亚', '冰岛'],
  },
};

/**
 * Surnames cycled across careers, chosen for their failure modes: length
 * against the shirt and the status band, diacritics against the display face,
 * Chinese characters against a font stack tuned for Latin capitals.
 */
const NAMES = ['HERNÁNDEZ', 'LEWANDOWSKI', 'ØDEGAARD', 'OYARZABAL', '张', 'VAN DIJK'];

const ARCHETYPE_CYCLE = ['pace', 'technical', 'physical'];

/** Engine ids that must never reach a screen in either language. */
const ENGINE_IDS = [
  'league', 'cup', 'continental', 'star', 'important', 'regular', 'squad',
  'impact_sub', 'fringe', 'rival', 'first', 'escape', 'foreign', 'money',
  'ballon_dor', 'golden_boot', 'golden_glove', 'best_defender',
  'best_playmaker', 'team_of_the_season', 'world_cup', 'continental_nations',
  'domestic_cup', 'continental_elite', 'continental_secondary',
];
const ID_PATTERN = new RegExp(`(?<![A-Za-z_-])(${ENGINE_IDS.join('|')})(?![A-Za-z_-])`, 'g');
/**
 * `some.dotted.key` — an i18n lookup that fell through to its own name.
 *
 * Written without a nested quantifier on purpose: the naive version
 * backtracked catastrophically on a long card and stalled the harness.
 * Domains are not keys — the settings and about screens genuinely say
 * `decisionfc.com` — so anything ending in a TLD is let through.
 */
const RAW_KEY = /\b[a-z]+\.[a-z][a-zA-Z_.]{2,30}\b/g;
const DOMAIN = /\.(com|dev|org|net|cn|io|app)\b/;
/** Words that are never a sentence in either language. */
const PLACEHOLDER = /\{[a-zA-Z]+\}|undefined|NaN|\[object|null\b/;

/**
 * Findings, deduplicated as they are made: three thousand careers repeating
 * one clipped label three thousand times is one fault, not three thousand.
 */
const findings = new Map();
const note = (kind, where, detail) => {
  const key = `${kind}|${detail}`;
  const hit = findings.get(key);
  if (hit) {
    hit.count += 1;
  } else {
    findings.set(key, { kind, where, detail, count: 1 });
  }
};

/* ------------------------------------------------------------------------- *
 * What football allows. The screen renders the state; these judge the state. *
 * ------------------------------------------------------------------------- */

const GK_SET = new Set(['GK']);
const DEF_SET = new Set(['CB', 'LB', 'RB']);
const MID_SET = new Set(['CDM', 'CM']);

function validateSeason(r, where) {
  const at = `${where} age ${r.age} (${r.clubId})`;
  const s = r.stats ?? {};
  if (s.appearances < 0 || s.appearances > 55) note('nonsense', at, `appearances ${s.appearances}`);
  if (r.suspended && s.appearances > 0) note('nonsense', at, `suspended season with ${s.appearances} appearances`);
  if (s.appearances > 0 && (s.rating < 4 || s.rating > 10)) note('nonsense', at, `rating ${s.rating}`);
  if (s.passAccuracy < 0 || s.passAccuracy > 100) note('nonsense', at, `pass accuracy ${s.passAccuracy}`);
  if (s.cleanSheets > s.appearances) note('nonsense', at, `${s.cleanSheets} clean sheets in ${s.appearances} apps`);
  if (r.injuryWeeks < 0 || r.injuryWeeks > 52) note('nonsense', at, `injury weeks ${r.injuryWeeks}`);
  if (r.earnings < 0) note('nonsense', at, `earnings ${r.earnings}`);
  if (GK_SET.has(r.position)) {
    if (s.goals > 1) note('nonsense', at, `goalkeeper scored ${s.goals}`);
    if (s.assists > 3) note('nonsense', at, `goalkeeper with ${s.assists} assists`);
  } else {
    if (s.saves > 0) note('nonsense', at, `outfielder (${r.position}) credited with ${s.saves} saves`);
    if (s.goalsConceded > 0) note('nonsense', at, `outfielder (${r.position}) conceding ${s.goalsConceded}`);
    if (DEF_SET.has(r.position) && s.goals > 15) note('nonsense', at, `defender scored ${s.goals}`);
    if (MID_SET.has(r.position) && s.goals > 25) note('nonsense', at, `midfielder (${r.position}) scored ${s.goals}`);
    if (s.goals > 60) note('nonsense', at, `${s.goals} goals in one season`);
    if (s.assists > 30) note('nonsense', at, `${s.assists} assists in one season`);
  }
  const nat = r.nationalStats;
  if (nat) {
    if (nat.appearances < 0 || nat.appearances > 20) {
      note('nonsense', at, `${nat.appearances} international caps in one season`);
    }
    if (GK_SET.has(r.position) && nat.goals > 0) {
      note('nonsense', at, `goalkeeper scored ${nat.goals} for his country`);
    }
  }
}

function validateFinal(fin, combo, where) {
  if (!fin) return;
  // The mode's promises: a daily is standard pace on the daily seed, a pace
  // mode is that pace; a GK profile career is a goalkeeper's.
  if (combo.mode === 'daily') {
    if (fin.pace !== 'standard') note('mode-broken', where, `daily played at pace ${fin.pace}`);
    if (!String(fin.seed).startsWith('daily-')) note('mode-broken', where, `daily on seed ${fin.seed}`);
  } else if (fin.pace !== combo.mode) {
    note('mode-broken', where, `${combo.mode} career ran at pace ${fin.pace}`);
  }
  if (combo.profile === 'gk' && fin.identity?.position !== 'GK') {
    note('mode-broken', where, `gk profile started at ${fin.identity?.position}`);
  }

  const seasons = fin.seasons ?? [];
  let prev = null;
  for (const r of seasons) {
    if (prev && r.age !== prev.age + 1) note('nonsense', where, `season ages jump ${prev.age} → ${r.age}`);
    const drop = r.overallStart - r.overallEnd;
    if (drop > 7) note('nonsense', where, `ability fell ${r.overallStart} → ${r.overallEnd} in one season (age ${r.age})`);
    if (drop < -15) note('nonsense', where, `ability rose ${r.overallStart} → ${r.overallEnd} in one season (age ${r.age})`);
    // Trophy plausibility — the class of fault caught by eye while
    // every stat-level check passed: a club promoted one season and
    // champion of the division above the next. Leicester needed two years and
    // a miracle; a sweep that sees it even once has found an odds bug.
    if (
      prev &&
      prev.promoted &&
      prev.clubId === r.clubId &&
      (r.trophies ?? []).includes('league')
    ) {
      note('nonsense', where, `${r.clubId} won the league the season straight after promotion (age ${r.age})`);
    }
    // Row-to-row, not just within a row: the 82→64 caught in play fell
    // *between* rows, where event-card ability costs used to land uncapped.
    // A position switch reprices honestly and prints the new position.
    if (prev && prev.overallEnd - r.overallEnd > 8 && r.position === prev.position) {
      note('nonsense', where, `ability fell ${prev.overallEnd} → ${r.overallEnd} between rows (age ${r.age})`);
    }
    validateSeason(r, where);
    prev = r;
  }
  // The forced ending only ever takes a spent 35-plus veteran (last row 34+):
  // a good player being told there are no offers anywhere is the fault that
  // was reported.
  const last = seasons[seasons.length - 1];
  if (fin.retirement?.reasonKey === 'retirement.no_offers' && last) {
    if (last.age < 34 || last.overallEnd >= 70) {
      note('nonsense', where, `forced retirement (no offers) after age-${last.age} season, overall ${last.overallEnd}`);
    }
  }
  const t = fin.totals;
  if (t) {
    // Career totals include international football, so the cross-check does too.
    const sum = seasons.reduce(
      (n, r) => n + (r.stats?.goals ?? 0) + (r.nationalStats?.goals ?? 0),
      0,
    );
    if (t.goals !== sum) note('nonsense', where, `career goals ${t.goals} ≠ sum of seasons ${sum}`);
    if (t.peakOverall > 99 || t.peakOverall < 40) note('nonsense', where, `peak overall ${t.peakOverall}`);
    if (t.grossEarnings < 0 || t.netEarnings > t.grossEarnings) {
      note('nonsense', where, `earnings gross ${t.grossEarnings} net ${t.netEarnings}`);
    }
  }
}

function validateSnapshot(s, where) {
  if (!s) return;
  if (!Number.isFinite(s.cash) || s.cash < 0) note('nonsense', where, `cash ${s.cash}`);
  if (s.age != null && (s.age < 14 || s.age > 46)) note('nonsense', where, `age ${s.age}`);
  if (s.ovr != null && (s.ovr < 30 || s.ovr > 99)) note('nonsense', where, `overall ${s.ovr}`);
  if (s.wage != null && (s.wage < 50 || s.wage > 3_000_000)) note('nonsense', where, `weekly wage ${s.wage}`);
  if (s.years != null && (s.years < 0 || s.years > 7)) note('nonsense', where, `contract years ${s.years}`);
  if (s.value != null && (s.value < 0 || s.value > 600_000_000)) note('nonsense', where, `market value ${s.value}`);
}

/* ------------------------------------------------------------------------- */

async function playOne(page, combo, index) {
  const { locale, mode, profile } = combo;
  const ui = UI[locale];
  const where = `${locale}/${mode}/${profile}`;
  const errors = [];
  const celebrations = [];
  page.removeAllListeners('console');
  page.removeAllListeners('pageerror');
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

  /*
   * Get back to the intro, which is harder than it looks.
   *
   * The app writes the save from an effect on career state, so a finished
   * career on the summary screen writes itself back on **every mount**. Clear
   * the key too early — `goto` resolves at `domcontentloaded`, before React
   * runs — and the app's own first write puts it straight back, the reload
   * resumes the dead career, and the harness sits on last game's summary until
   * it times out. So: let the app finish mounting, then clear, then reload,
   * then check — and if the intro still is not there, do it again.
   */
  const settled = () => page.waitForFunction(() => document.body.innerText.trim().length > 40, null, { timeout: 60000 });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await settled().catch(() => {});
    await page.evaluate((loc) => {
      localStorage.removeItem('fc:save:v2');
      localStorage.setItem('fc:locale', loc);
    }, locale);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settled().catch(() => {});
    const onIntro = await page.evaluate((text) => document.body.innerText.includes(text), ui.start);
    if (onIntro) break;
  }
  await page
    .getByText(ui.start, { exact: false })
    .first()
    .waitFor({ timeout: 60000 })
    .catch(async () => {
      const seen = await page
        .evaluate(() => ({
          text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 200),
          save: localStorage.getItem('fc:save:v2') === null ? 'none' : 'present',
          locale: localStorage.getItem('fc:locale'),
        }))
        .catch(() => null);
      throw new Error(`intro never appeared — ${JSON.stringify(seen)}`);
    });

  // Through the front door the mode asks for: pace picker for the three paces,
  // the daily sheet for the daily. The daily row's *hint* also says "Today's
  // career" before the first play, so the sheet's button is found by exact
  // accessible name, which the row (title + hint concatenated) never has.
  if (mode === 'daily') {
    await page.getByText(ui.daily, { exact: true }).first().click();
    await page.getByRole('button', { name: ui.dailyStart, exact: true }).click({ timeout: 10000 });
  } else {
    await page.getByText(ui.paces[mode], { exact: true }).first().click();
    await page.getByText(ui.start, { exact: false }).first().click();
  }

  // Identity: a different footballer every career, not the same one a hundred
  // times. Cycled off the career index rather than drawn, so a hundred careers
  // cover the positions, names and passports evenly and the sweep reproduces.
  await page.locator('input:not([type="number"])').first().fill(NAMES[index % NAMES.length]);
  const position = profile === 'gk' ? ui.gk : ui.positions[index % ui.positions.length];
  await page.getByText(position, { exact: true }).first().click({ timeout: 5000 }).catch(() => {});
  const country = ui.countries[index % ui.countries.length];
  if (index % ui.countries.length !== 0) {
    // England is the default; only open the picker when changing away from it.
    await page.locator('button', { hasText: '›' }).first().click({ timeout: 3000 }).catch(() => {});
    await page.locator('input[placeholder]').last().fill(country).catch(() => {});
    await page.getByText(country, { exact: true }).last().click({ timeout: 3000 }).catch(() => {});
  }
  const archetype = profile === 'gk' ? ARCHETYPE_CYCLE[index % 3] : profile;
  await page.getByText(ui.types[archetype], { exact: true }).first().click();
  await page.getByText(ui.confirm, { exact: false }).first().click();
  await page.locator('[data-decision]').first().waitFor({ timeout: 15000 });

  const cards = [];
  const snapshots = [];
  for (let n = 0; n < 400; n += 1) {
    // Silverware and relegation put a full-screen overlay over the decision.
    // Under reduced motion it has no timer by design, so it waits for a tap,
    // exactly as it does for a player. Dismiss it the way a player would, and
    // read it on the way past.
    for (let guard = 0; guard < 4; guard += 1) {
      const overlay = await page.evaluate(() => {
        const el = document.querySelector('[aria-label="dismiss"]');
        return el ? (el.textContent ?? '').replace(/\s+/g, ' ').trim() : null;
      });
      if (overlay === null) break;
      if (overlay) celebrations.push(overlay);
      await page.locator('[aria-label="dismiss"]').first().click({ timeout: 5000 }).catch(() => {});
    }

    const options = page.locator('[data-option-id]');
    if ((await options.count()) === 0) break;

    const card = await page.evaluate(() => {
      const root = document.querySelector('[data-decision]');
      if (!root) return null;
      const text = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
      // Text cut off by its own box, anywhere on the screen — the deliberate
      // `truncate` classes included, because an ellipsis the player can see is
      // a finding whether or not the stylesheet meant it.
      const clipped = [];
      for (const el of document.body.querySelectorAll('*')) {
        if (el.children.length === 0 && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2) {
          const t = text(el);
          // Name the element as well as the words: "Chelsea" clips in three
          // different places, and the fix for each is different.
          const at = [el.closest('[data-career-table]') && 'table', el.closest('[data-decision]') && 'card', el.closest('[data-sheet]') && 'sheet']
            .filter(Boolean)
            .join('/');
          if (t) clipped.push(`[${at || 'top'}] ${t.slice(0, 60)}`);
        }
      }
      return {
        seq: root.getAttribute('data-decision'),
        title: text(root.querySelector('h2')),
        body: text(root.querySelector('p')),
        options: [...root.querySelectorAll('[data-option-id]')].map((o) => ({
          id: o.getAttribute('data-option-id'),
          text: text(o),
        })),
        clipped,
      };
    });
    if (!card) break;

    const before = card.seq;
    // The slot walks with the career index as well as the card number, so two
    // careers on the same seed — every daily — still take different routes.
    const slot = (n + index) % card.options.length;
    await page
      .waitForFunction(
        () => [...document.querySelectorAll('[data-option-id]')].every((b) => !b.disabled),
        null,
        { timeout: 25000 },
      )
      .catch(() => {});
    await options.nth(slot).click({ timeout: 25000 });
    await page
      .waitForFunction(
        (prev) => {
          const c = document.querySelector('[data-decision]');
          return !c || c.getAttribute('data-decision') !== prev;
        },
        before,
        { timeout: 20000 },
      )
      .catch(() => note('stuck', where, `card ${n} never resolved: ${card.title}`));

    // What the game said happened, which is where the prose lives. Read with
    // `evaluate`, never with a locator: the first card of a career has no
    // result line yet, and a locator would auto-wait for one that never comes.
    const result = await page
      .evaluate(() =>
        (document.querySelector('[data-result]')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      )
      .catch(() => '');

    // The career behind the screen, from the app's opt-in test hook.
    const snap = await page
      .evaluate(() => {
        const s = window.__fcState;
        if (!s || !s.player) return null;
        return {
          phase: s.phase,
          age: s.player.age,
          ovr: s.player.overall,
          cash: s.cash,
          wage: s.contract?.wage ?? null,
          years: s.contract?.yearsRemaining ?? null,
          value: s.player.marketValue,
          seasons: s.seasons.length,
        };
      })
      .catch(() => null);
    if (snap) {
      validateSnapshot(snap, where);
      snapshots.push(snap);
    }

    cards.push({ ...card, chose: card.options[slot]?.id ?? null, result });

    const screen = `${card.title} ${card.body} ${card.options.map((o) => o.text).join(' ')} ${result}`;
    if (PLACEHOLDER.test(screen)) note('placeholder', where, screen.slice(0, 160));
    for (const m of screen.matchAll(RAW_KEY)) {
      if (!DOMAIN.test(m[0])) note('raw-key', where, m[0]);
    }
    if (locale === 'zh') {
      for (const m of screen.matchAll(ID_PATTERN)) note('untranslated', where, m[0]);
    }
    for (const c of card.clipped) note('clipped', where, c);

    const overflow = await page.evaluate(() => {
      const d = document.documentElement;
      return d.scrollWidth > d.clientWidth + 1 || d.scrollHeight > d.clientHeight + 1;
    });
    if (overflow) note('scrolls', where, `card ${n}: ${card.title}`);
  }

  if (cards.length < 8) note('short', where, `career #${index} ended after ${cards.length} cards`);
  for (const e of errors) note('console', where, e);

  // Crests and trophies are images; a 404 renders as a hole in the interface.
  const broken = await page
    .evaluate(() =>
      [...document.images]
        .filter((img) => img.complete && img.naturalWidth === 0 && img.src)
        .map((img) => img.src.split('/').slice(-2).join('/')),
    )
    .catch(() => []);
  for (const src of broken) note('broken-image', where, src);

  // The summary, read as a whole: this is where a career is judged and where
  // the prose is longest. Then the career behind it, held to what football
  // allows — and then the rest of the lifecycle: the share sheet, and (once
  // per combination) the replay door back to the identity screen.
  const summary = await page
    .evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 4000))
    .catch(() => '');
  if (PLACEHOLDER.test(summary)) note('placeholder', `${where} summary`, summary.slice(0, 160));
  for (const m of summary.matchAll(RAW_KEY)) {
    if (!DOMAIN.test(m[0])) note('raw-key', `${where} summary`, m[0]);
  }

  const fin = await page
    .evaluate(() => {
      const s = window.__fcState;
      if (!s) return null;
      return {
        pace: s.pace,
        seed: s.seed,
        phase: s.phase,
        identity: s.identity,
        seasons: s.seasons,
        totals: s.totals,
        retirement: s.retirement,
      };
    })
    .catch(() => null);
  if (fin?.phase === 'summary') validateFinal(fin, combo, `${where}#${index}`);

  let share = '';
  const shareButton = page.getByText(ui.viewSummary, { exact: true }).first();
  if (await shareButton.isVisible().catch(() => false)) {
    await shareButton.click({ timeout: 5000 }).catch(() => {});
    const sheet = page.locator('[data-sheet]');
    if (await sheet.waitFor({ timeout: 5000 }).then(() => true).catch(() => false)) {
      share = await sheet.evaluate((el) => el.innerText.replace(/\s+/g, ' ').trim().slice(0, 1500)).catch(() => '');
      if (PLACEHOLDER.test(share)) note('placeholder', `${where} share`, share.slice(0, 160));
      await page.keyboard.press('Escape').catch(() => {});
    } else {
      note('lifecycle', where, 'view-summary sheet never opened');
    }
  } else if (fin?.phase === 'summary') {
    note('lifecycle', where, 'summary screen has no view-summary button');
  }

  if (index === 0 && fin?.phase === 'summary') {
    // The first replay of the day is free by design, so index 0 exercises the
    // replay door itself: summary → identity, with the name carried over.
    await page.getByText(ui.replay, { exact: true }).first().click({ timeout: 5000 }).catch(() => {});
    const back = await page
      .getByText(ui.confirm, { exact: false })
      .first()
      .waitFor({ timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    if (!back) note('lifecycle', where, 'play-again did not reach the identity screen');
  }

  return { locale, mode, profile, index, cards, snapshots, celebrations, summary, share, final: fin };
}

/* ------------------------------------------------------------------------- */

const combos = ONLY
  ? COMBINATIONS.filter((c) => `${c.locale}/${c.mode}/${c.profile}` === ONLY)
  : COMBINATIONS;
if (combos.length === 0) {
  console.error(`unknown combo ${ONLY}`);
  process.exit(2);
}

mkdirSync(dirname(OUT), { recursive: true });
const transcript = `${OUT}.jsonl`;
const report = `${OUT}.findings.json`;
writeFileSync(transcript, '');

const browser = await chromium.launch(LAUNCH);
const context = await browser.newContext({
  // The smaller of the two phone sizes the layout is verified at: if it fits
  // at 375×667 it fits everywhere the app frame allows.
  viewport: { width: 375, height: 667 },
  reducedMotion: 'reduce',
});
await context.addInitScript(() => {
  // Reduced motion, the state hook for this harness, and a leaderboard that is
  // never called: this is a playtest, not a submission.
  localStorage.setItem('fc:settings:v1', JSON.stringify({ currency: 'EUR', showOdds: true, reducedMotion: true }));
  localStorage.setItem('fc:testhook', '1');
  localStorage.setItem('fc:news', '2026-07-30');
});
const page = await context.newPage();

/**
 * The leaderboard, stubbed — for the same two reasons `verify-ui.mjs` stubs it,
 * plus one this harness adds.
 *
 * A pull request that changes the engine is guaranteed a 422 from the live
 * function, because the client already scores the new way and the deployed
 * bundle still scores the old way until the merge redeploys it. And the
 * summary's real leaderboard path should run, not the offline fallback, so an
 * abort is the wrong tool.
 *
 * The one this harness adds: it plays thousands of careers. Unstubbed, a full
 * matrix run would post up to 3,200 synthetic careers into the live board,
 * move the denominator of every real player's percentile, and — since
 * submissions are now rate limited — spend most of the run collecting 429s.
 * None of the rows are there today, which is luck about timing rather than
 * design: nothing was stopping them.
 */
await page.route('**/functions/v1/career-submit', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
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

/** The funnel counters, likewise: a harness is not a player. */
await page.route('**/rest/v1/rpc/bg_event', (route) => route.fulfill({ status: 204, body: '' }));

let played = 0;
let failed = 0;
for (const combo of combos) {
  for (let i = 0; i < CAREERS; i += 1) {
    try {
      const run = await playOne(page, combo, i);
      // The full state is validated above and would triple the transcript;
      // keep the per-season records (they are what the reader cross-checks
      // against the copy) and drop the rest.
      if (run.final) run.final = { pace: run.final.pace, seed: run.final.seed, phase: run.final.phase };
      appendFileSync(transcript, JSON.stringify(run) + '\n');
    } catch (error) {
      failed += 1;
      note('crash', `${combo.locale}/${combo.mode}/${combo.profile}#${i}`, String(error).slice(0, 300));
    }
    played += 1;
    if (played % 20 === 0) process.stderr.write(`  ${played} careers\n`);
  }
}

writeFileSync(report, JSON.stringify([...findings.values()], null, 1));
console.log(`${played} careers (${failed} failed), ${findings.size} distinct findings -> ${report}`);
await browser.close();
