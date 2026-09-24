#!/usr/bin/env node
/**
 * Push the site's URLs to Baidu's 普通收录 API.
 *
 * Baidu is the one engine here that will not find a new site on its own in any
 * useful timeframe. It indexes hosts outside mainland China slowly and
 * reluctantly, it is slower still without an ICP filing (备案), which Cloudflare
 * hosting cannot have, and the sitemap alone is a hint rather than a request.
 * The active-push endpoint is the one channel that says "this URL exists, come
 * and look" directly, so it is worth the twenty lines.
 *
 * What it does *not* do, in Baidu's own words: "不保证收录和展现效果". Pushing is
 * how a crawler learns the URL exists. Whether it indexes it, and where it
 * ranks, is a separate question that links and time answer — see docs/seo.md.
 *
 *   BAIDU_PUSH_TOKEN=… node tools/baidu-push.mjs
 *   BAIDU_PUSH_TOKEN=… node tools/baidu-push.mjs --dry-run
 *
 * ## The token
 *
 * The push token is a credential: anybody holding it can submit URLs as this
 * site. It lives in the environment and **never** in the repository — the
 * token itself is in 百度搜索资源平台 → 普通收录 → 推送接口, where it can also be
 * rotated if it ever leaks.
 *
 * ## Which URLs
 *
 * The four the sitemap lists, read from the sitemap so there is one list rather
 * than two that drift. Every one ends in a slash, which matters here more than
 * anywhere: Baidu's documentation says outright 「若链接存在跳转关系，请直接提交
 * 跳转后链接」, and Cloudflare answers the unslashed form with a 307.
 *
 * ## The daily quota
 *
 * API and 手动提交 share one allowance and it does not roll over. Four URLs a
 * day is nothing against it, but there is no point running this on a schedule
 * either — pushing an unchanged URL repeatedly does not make Baidu index it
 * faster. Run it when something is genuinely new.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'https://decisionfc.com';
const here = dirname(fileURLToPath(import.meta.url));
const token = process.env.BAIDU_PUSH_TOKEN;
const dryRun = process.argv.includes('--dry-run');

if (!token && !dryRun) {
  console.error('BAIDU_PUSH_TOKEN is not set.');
  console.error('Find it at https://ziyuan.baidu.com/ → 普通收录 → 推送接口 → 准入密钥.');
  process.exit(1);
}

/** The canonical URL set, taken from the sitemap so there is only one list. */
const sitemap = readFileSync(join(here, '..', 'apps', 'web', 'public', 'sitemap.xml'), 'utf8');
const urls = [...new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()))];

if (urls.length === 0) {
  console.error('No <loc> entries in the sitemap. Nothing to push.');
  process.exit(1);
}

const redirecting = urls.filter((url) => url !== `${SITE}/` && !url.endsWith('/'));
if (redirecting.length > 0) {
  // Submitting a redirect wastes a slot of a quota that does not accumulate,
  // and Baidu's own guidance is to submit the destination.
  console.error('These would be submitted as redirects. Fix the sitemap first:');
  for (const url of redirecting) console.error(`  · ${url}`);
  process.exit(1);
}

console.log(`\n  ${dryRun ? 'would push' : 'pushing'} ${urls.length} URLs to Baidu:`);
for (const url of urls) console.log(`    ${url}`);

if (dryRun) {
  console.log('\n  --dry-run: nothing was sent.\n');
  process.exit(0);
}

// http, not https: the endpoint Baidu documents and the only one it answers on.
const endpoint = `http://data.zz.baidu.com/urls?site=${encodeURIComponent(SITE)}&token=${encodeURIComponent(token)}`;
const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: urls.join('\n'),
});

const body = await response.text();
let result = null;
try {
  result = JSON.parse(body);
} catch {
  /* reported below — a non-JSON body is itself the error message */
}

if (!response.ok || result === null || typeof result.success !== 'number') {
  console.error(`\n  ✗ Baidu rejected the push (HTTP ${response.status})`);
  console.error(`    ${body.slice(0, 400)}`);
  // The two that actually happen: a token that has been rotated, and a `site`
  // that does not match the property exactly as it is verified in the console.
  process.exit(1);
}

console.log(`\n  ✓ accepted ${result.success} of ${urls.length}`);
console.log(`    ${result.remain} pushes left in today's quota`);
for (const [label, list] of [
  ['not this site', result.not_same_site],
  ['not a valid URL', result.not_valid],
]) {
  if (Array.isArray(list) && list.length > 0) console.log(`    ${label}: ${list.join(' ')}`);
}
console.log('');
