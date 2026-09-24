#!/usr/bin/env node
/**
 * Is the site findable?
 *
 * Every check here exists because it was once false. The game is a single-page
 * app on a worker that serves index.html for any unknown path, which produced a
 * specific and quiet kind of broken: `/robots.txt` answered 200 with HTML, so
 * did `/sitemap.xml`, and `<div id="root">` was empty — so a crawler that did
 * not run JavaScript saw a page with a title and no content at all. On a
 * brand-new domain with no inbound links, that is the difference between being
 * indexed and being invisible.
 *
 * Two of these matter most and both are easy to break by accident: the page has
 * to be readable with JavaScript off, and React has to replace that content
 * when JavaScript runs. A splash that survives into the running app is a bug; a
 * splash that is not there at all is a worse one.
 *
 * Run against a built preview:
 *   pnpm build
 *   pnpm preview &
 *   pnpm seo
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Prerendered pages live at a trailing slash, and every URL the site publishes
 * about itself has to say so.
 *
 * Not cosmetic. Cloudflare resolves `/zh` to `/zh/index.html`
 * (`html_handling: auto-trailing-slash`, declared in wrangler.jsonc) by
 * answering a **307 to `/zh/`**, while `vite preview` answers the SPA fallback
 * — so locally `/zh` returns the *English* shell. Checking the unslashed form
 * here would test the preview server rather than the site, and would have kept
 * passing while production was broken.
 *
 * The site shipped once with the unslashed form in its canonical, its
 * `hreflang` pairs, its sitemap and its own internal links: every crawler was
 * being sent to a redirect, a canonical that redirects is the one kind Google
 * may disregard, and Baidu's submission docs say outright to submit the
 * post-redirect URL. `sameUrl` below is what stops that coming back.
 */
const dir = (path) => (path.endsWith('/') ? path : `${path}/`);

/** The absolute URL a page at `path` should be claiming as its own. */
const SITE = 'https://decisionfc.com';
const sameUrl = (path) => SITE + dir(path);

const BASE = process.argv.find((a) => a.startsWith('--base='))?.split('=')[1] ?? 'http://127.0.0.1:4173';
// The dev container's Chromium sits at a fixed path Playwright will not find on
// its own; CI installs its own and has nothing there. Use the path if it exists.
const BROWSER = process.env.CHROMIUM || '/opt/pw-browsers/chromium';

const browser = await chromium.launch(existsSync(BROWSER) ? { executablePath: BROWSER } : {});
let failed = false;
const ok = (condition, label, detail = '') => {
  console.log(`  ${condition ? '✓' : '✗'} ${label}${condition ? '' : ` — ${detail}`}`);
  if (!condition) failed = true;
};

/**
 * A page has to name itself, and name the URL that actually answers 200.
 *
 * `og:url` is checked alongside the canonical because they disagreeing is how
 * a social preview ends up crediting the wrong page.
 */
async function selfReferential(page, path) {
  const head = await page.evaluate(() => ({
    canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href') ?? '',
    ogUrl: document.querySelector('meta[property="og:url"]')?.getAttribute('content') ?? '',
    alternates: [...document.querySelectorAll('link[rel=alternate][hreflang]')].map((l) => l.getAttribute('href')),
  }));
  ok(head.canonical === sameUrl(path), `${path}: canonical points at itself, slash and all`, head.canonical);
  ok(head.ogUrl === sameUrl(path), `${path}: og:url agrees with the canonical`, head.ogUrl);
  ok(
    head.alternates.every((href) => href === `${SITE}/` || href?.endsWith('/')),
    `${path}: no hreflang points at a redirect`,
    head.alternates.join(','),
  );
}

console.log('\n  FILES A CRAWLER ASKS FOR BEFORE IT ASKS FOR A PAGE');
for (const [path, type] of [
  ['/robots.txt', 'text/plain'],
  ['/sitemap.xml', 'xml'],
  ['/og-card.png', 'image/png'],
  ['/llms.txt', 'text/plain'],
]) {
  const page = await browser.newPage();
  const response = await page.goto(BASE + path, { waitUntil: 'domcontentloaded' }).catch(() => null);
  const contentType = response?.headers()['content-type'] ?? '';
  ok(
    response?.status() === 200 && contentType.includes(type),
    `${path} is served as ${type}`,
    `${response?.status()} ${contentType}`,
  );
  await page.close();
}

console.log('\n  THE CONTENT PAGES');
for (const [path, lang, must] of [
  ['/football-career-games', 'en', 'Football Manager'],
  ['/zh/football-career-games', 'zh-Hans', '足球经理'],
]) {
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  // Deliberately with JavaScript off: these are documents, and they must not
  // need a 400 kB bundle to be readable or indexable.
  await page.route('**/*.js', (route) => route.abort());
  const response = await page.goto(BASE + dir(path), { waitUntil: 'domcontentloaded' }).catch(() => null);
  const text = (await page.textContent('body').catch(() => '')) ?? '';
  ok(response?.status() === 200, `${path} exists`, String(response?.status()));
  ok(text.length > 1200, `${path}: has real content`, `${text.length} chars`);
  ok(text.includes(must), `${path}: names the games people are searching for`);
  ok((await page.locator('h1').count()) === 1, `${path}: exactly one h1`);
  ok((await page.getAttribute('html', 'lang')) === lang, `${path}: lang is ${lang}`);
  const faq = await page.evaluate(() => {
    const el = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => { try { return JSON.parse(s.textContent ?? ''); } catch { return null; } })
      .find((d) => d?.['@type'] === 'FAQPage');
    return el?.mainEntity?.length ?? 0;
  });
  ok(faq >= 4, `${path}: FAQ structured data`, `${faq} questions`);
  ok((await page.locator('a[href="/"], a[href="/zh/"]').count()) > 0, `${path}: links back to the game`);
  await selfReferential(page, path);
  await page.close();
}

console.log('\n  THE PAGES THEMSELVES');
for (const [path, lang, expect] of [
  ['/', 'en', 'Start career'],
  ['/zh', 'zh-Hans', '开启生涯'],
]) {
  // What a crawler that does not execute JavaScript sees.
  const bare = await browser.newPage({ viewport: { width: 375, height: 667 } });
  await bare.route('**/*.js', (route) => route.abort());
  await bare.goto(BASE + dir(path), { waitUntil: 'domcontentloaded' });
  const text = (await bare.textContent('body')) ?? '';
  ok(text.trim().length > 300, `${path}: readable with JavaScript off`, `${text.trim().length} chars`);
  ok((await bare.locator('h1').count()) === 1, `${path}: exactly one h1`);
  // The one that matters and the one that was missing. The app switches
  // language from the URL at runtime, so a crawler could be served the English
  // HTML at /zh and every JavaScript-aware check would still pass.
  ok(
    (await bare.getAttribute('html', 'lang')) === lang,
    `${path}: the HTML itself is ${lang}, before any JavaScript`,
    String(await bare.getAttribute('html', 'lang')),
  );
  await bare.close();

  // And with JavaScript: the splash has to give way to the real game.
  const live = await browser.newPage({ viewport: { width: 375, height: 667 } });
  const errors = [];
  live.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  live.on('pageerror', (e) => errors.push(String(e)));
  await live.goto(BASE + dir(path), { waitUntil: 'networkidle' });
  await live.waitForTimeout(700);
  const body = (await live.textContent('body')) ?? '';
  ok(!body.includes('A football career, one decision at a time'), `${path}: splash gives way to the app`);
  ok(body.includes(expect), `${path}: app opens in ${lang}`, body.slice(0, 80));
  ok(
    (await live.getAttribute('html', 'lang')) === lang,
    `${path}: html lang agrees with hreflang`,
    String(await live.getAttribute('html', 'lang')),
  );
  ok(errors.length === 0, `${path}: no console errors`, errors.join(' | '));
  await selfReferential(live, path);
  await live.close();
}

console.log('\n  THE SITEMAP AGREES WITH ALL OF IT');
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/sitemap.xml`, { waitUntil: 'domcontentloaded' });
  const xml = (await page.content()) ?? '';
  await page.close();
  const urls = [...xml.matchAll(/https:\/\/decisionfc\.com[^"<\s]*/g)].map((m) => m[0]);
  ok(urls.length >= 12, 'sitemap lists the four pages and their hreflang pairs', `${urls.length} URLs`);
  const redirecting = urls.filter((url) => !url.endsWith('/'));
  // Every one of these would be a 307 in production. Baidu's own submission
  // guidance is to submit the destination, not the redirect.
  ok(redirecting.length === 0, 'no sitemap URL points at a redirect', redirecting.join(' '));
}

console.log('\n  INDEXNOW CAN STILL PROVE THIS IS OUR HOST');
{
  // IndexNow verifies a submission by fetching the key back off the host, so
  // this file is the whole of the proof. Delete it and `tools/indexnow.mjs`
  // starts answering 403 — quietly, and probably months later, because nothing
  // else on the site changes when it goes.
  const key = readFileSync(join(here, '..', 'tools', 'indexnow.mjs'), 'utf8').match(/const KEY = '([a-f0-9]+)'/)?.[1];
  ok(typeof key === 'string' && key.length >= 8, 'tools/indexnow.mjs declares a key', String(key));
  const served = await fetch(`${BASE}/${key}.txt`).catch(() => null);
  const body = served ? (await served.text().catch(() => '')).trim() : '';
  ok(served?.status === 200, `/${key}.txt is served`, String(served?.status));
  ok(body === key, 'and it contains exactly the key', body.slice(0, 60));
}

console.log('\n  WHAT A RESULT WILL LOOK LIKE');
const page = await browser.newPage();
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
const head = await page.evaluate(() => ({
  title: document.title,
  description: document.querySelector('meta[name=description]')?.getAttribute('content') ?? '',
  canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href'),
  ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
  ogUrl: document.querySelector('meta[property="og:url"]')?.getAttribute('content'),
  twitter: document.querySelector('meta[name="twitter:card"]')?.getAttribute('content'),
  hreflang: [...document.querySelectorAll('link[rel=alternate][hreflang]')].map((l) => l.getAttribute('hreflang')),
  ld: document.querySelector('script[type="application/ld+json"]')?.textContent ?? '',
  baidu: document.querySelector('meta[name="baidu-site-verification"]')?.getAttribute('content'),
}));
await page.close();

ok(head.title.length >= 25 && head.title.length <= 70, 'title is a usable length', `${head.title.length} chars`);
ok(
  head.description.length >= 80 && head.description.length <= 330,
  'description is a usable length',
  `${head.description.length} chars`,
);
ok(head.canonical === 'https://decisionfc.com/', 'canonical is absolute and correct', String(head.canonical));
ok(String(head.ogUrl).startsWith('https://'), 'og:url is absolute', String(head.ogUrl));
ok(String(head.ogImage).startsWith('https://'), 'og:image is absolute', String(head.ogImage));
ok(head.twitter === 'summary_large_image', 'twitter card is the large one', String(head.twitter));
ok(
  ['en', 'zh-Hans', 'x-default'].every((h) => head.hreflang.includes(h)),
  'hreflang covers en, zh-Hans and x-default',
  head.hreflang.join(','),
);
let structured = null;
try {
  structured = JSON.parse(head.ld);
} catch {
  /* reported by the assertion below */
}
ok(structured?.['@type'] === 'VideoGame', 'structured data parses, and is a VideoGame', head.ld.slice(0, 60));
ok(structured?.offers?.price === '0', 'structured data says the game is free');
// Baidu re-checks this tag and un-verifies the site if it goes missing, which
// is the sort of thing that is noticed months later.
ok(head.baidu === 'codeva-T9GPpE8fxa', 'the Baidu ownership tag is still there', String(head.baidu));

await browser.close();
console.log(failed ? '\n  ✗ the site is less findable than it should be\n' : '\n  ✓ findable\n');
process.exit(failed ? 1 : 0);
