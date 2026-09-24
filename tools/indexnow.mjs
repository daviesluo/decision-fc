#!/usr/bin/env node
/**
 * Push the site's URLs to IndexNow — Bing, Yandex, Seznam and Naver at once.
 *
 * Written for the exact state Bing Webmaster Tools reported on 2026-08-05:
 * «Discovered but not crawled — URL cannot appear on Bing». That message is not
 * a fault in the page. It means Bing knows the URL exists and has not yet spent
 * a crawl on it, which is what a week-old domain with no inbound links gets.
 * The sitemap is a list Bing reads when it feels like it; IndexNow is a request
 * that says "this URL changed, come and look", and it is the one channel Bing
 * itself points at for this.
 *
 *   node tools/indexnow.mjs
 *   node tools/indexnow.mjs --dry-run
 *   node tools/indexnow.mjs https://decisionfc.com/zh/     # just these
 *
 * ## The key is public, unlike the Baidu token
 *
 * Worth being clear about, because the two tools sit next to each other and one
 * of them holds a credential. IndexNow's key proves control of the host by
 * being *served from* it: `https://decisionfc.com/<key>.txt` has to answer with
 * the key itself. It is published on purpose, so it belongs in the repository —
 * `apps/web/public/<key>.txt` — and there is nothing to leak. `tools/seo.mjs`
 * checks the file is still served, because deleting it silently turns every
 * later submission into a 403.
 *
 * Rotating it, if it ever needs to be: generate 32 hex characters, rename the
 * file, change KEY below, deploy, and only then push again — the endpoint reads
 * the file at submission time.
 *
 * ## Which URLs
 *
 * The sitemap's, read from the sitemap so there is one list rather than two
 * that drift, and every one of them the slashed form Cloudflare answers 200 for.
 * Passing URLs as arguments overrides that, for the case where one page changed
 * and the rest did not.
 *
 * ## How often
 *
 * On content change, which is what the deploy workflow does. IndexNow's own
 * guidance is that resubmitting an unchanged URL is pointless rather than
 * punished — but a schedule that pushes the same four URLs hourly is how a host
 * teaches an engine to ignore it, so there is no schedule here.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'https://decisionfc.com';
const HOST = 'decisionfc.com';
const KEY = '16d433424c2512042df54c4e2843135e';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const explicit = args.filter((a) => a.startsWith('https://'));

/** The canonical URL set, taken from the sitemap so there is only one list. */
function fromSitemap() {
  const xml = readFileSync(join(here, '..', 'apps', 'web', 'public', 'sitemap.xml'), 'utf8');
  return [...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()))];
}

const urls = explicit.length > 0 ? explicit : fromSitemap();

if (urls.length === 0) {
  console.error('No <loc> entries in the sitemap. Nothing to push.');
  process.exit(1);
}

const foreign = urls.filter((url) => !url.startsWith(`${SITE}/`) && url !== `${SITE}/`);
if (foreign.length > 0) {
  // IndexNow rejects the whole batch if one URL is off-host, and a rejected
  // batch is indistinguishable from a wrong key.
  console.error(`These are not on ${HOST}:`);
  for (const url of foreign) console.error(`  · ${url}`);
  process.exit(1);
}

const redirecting = urls.filter((url) => url !== `${SITE}/` && !url.endsWith('/'));
if (redirecting.length > 0) {
  // Cloudflare answers the unslashed form with a 307, and submitting a redirect
  // asks the crawler to index a URL that is not the one being published.
  console.error('These would be submitted as redirects. Fix the sitemap first:');
  for (const url of redirecting) console.error(`  · ${url}`);
  process.exit(1);
}

console.log(`\n  ${dryRun ? 'would push' : 'pushing'} ${urls.length} URLs to IndexNow:`);
for (const url of urls) console.log(`    ${url}`);

if (dryRun) {
  console.log('\n  --dry-run: nothing was sent.\n');
  process.exit(0);
}

const body = { host: HOST, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls };

const response = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
}).catch((error) => {
  console.error(`\n  ✗ could not reach IndexNow: ${error.message}\n`);
  process.exit(1);
});

const text = await response.text().catch(() => '');

// 200 accepted, 202 accepted but the key is still being verified. Both mean the
// submission landed; everything else is worth reading out loud.
if (response.status === 200 || response.status === 202) {
  console.log(`\n  ✓ ${response.status} — submitted${response.status === 202 ? ' (key verification pending)' : ''}\n`);
  process.exit(0);
}

const why =
  {
    400: 'bad request — the JSON body was rejected',
    403: `the key was not accepted; check ${SITE}/${KEY}.txt is deployed and contains exactly the key`,
    422: 'the URLs do not belong to the host, or the key does not match',
    429: 'too many requests — this is the "stop pushing unchanged URLs" answer',
  }[response.status] ?? 'unexpected response';

console.error(`\n  ✗ ${response.status} — ${why}`);
if (text.trim()) console.error(`    ${text.trim().slice(0, 400)}`);
console.error('');
process.exit(1);
