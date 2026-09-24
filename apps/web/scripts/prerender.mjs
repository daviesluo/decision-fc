/**
 * Write the Chinese twin of the built index.html to /zh.
 *
 * Why a second file rather than one URL that switches language in JavaScript:
 * a crawler indexes URLs, not preferences. With one URL there is exactly one
 * page for Google to rank, it is in English, and no amount of `hreflang` will
 * make it show up for 足球生涯 or 足球经理游戏 — the Chinese words are not on it.
 * Two URLs, each with its own title, description and visible copy, is the
 * cheapest honest way to be findable in both languages.
 *
 * It is a *twin*, not a translation layer: the same bundle, the same app, the
 * same everything after React mounts. The only differences are the ones a
 * search engine reads before that happens, and they are listed in SWAPS below.
 *
 * Runs after `vite build` (see the web package's build script).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const source = readFileSync(join(dist, 'index.html'), 'utf8');

/**
 * Every language-specific string, and what it becomes.
 *
 * Written as exact-match pairs rather than as a regex over the file, so a
 * change to `index.html` that forgets this file fails loudly at build time
 * instead of silently shipping an English page at a Chinese URL.
 */
const SWAPS = [
  ['<html lang="en"', '<html lang="zh-Hans"'],

  [
    '<title>Decision FC — a football career game you play in five minutes</title>',
    '<title>足球生涯 Decision FC — 五分钟踢完一整段职业生涯的足球游戏</title>',
  ],
  [
    'Free football career simulator. Start at 16, take the loan, chase the move that makes you — twenty seasons of decisions in about five minutes, in the browser.',
    '免费足球生涯模拟游戏。16 岁进青训，租借出去打上球，再挑一次改变整段生涯的转会——二十个赛季，五分钟做完。打开网页就能玩，不用下载。中英文双语。',
  ],

  // Slashed, because that is the URL Cloudflare serves this file at: `/zh`
  // answers 307 → `/zh/`, and a canonical pointing at a redirect is a canonical
  // a search engine is entitled to ignore.
  ['<link rel="canonical" href="https://decisionfc.com/" />', '<link rel="canonical" href="https://decisionfc.com/zh/" />'],
  ['<meta property="og:url" content="https://decisionfc.com/" />', '<meta property="og:url" content="https://decisionfc.com/zh/" />'],
  ['<meta property="og:locale" content="en_GB" />', '<meta property="og:locale" content="zh_CN" />'],
  ['<meta property="og:locale:alternate" content="zh_CN" />', '<meta property="og:locale:alternate" content="en_GB" />'],

  [
    '<meta property="og:title" content="Decision FC — a football career game you play in five minutes" />',
    '<meta property="og:title" content="足球生涯 Decision FC — 五分钟踢完一整段职业生涯" />',
  ],
  [
    '<meta name="twitter:title" content="Decision FC — a football career game you play in five minutes" />',
    '<meta name="twitter:title" content="足球生涯 Decision FC — 五分钟踢完一整段职业生涯" />',
  ],
  [
    "Start at 16 and live twenty seasons of a footballer's career, one decision at a time. Free, in the browser, nothing to download.",
    '16 岁起步，一次一个选择，走完二十个赛季的球员生涯。免费，打开网页就能玩。',
  ],
  [
    "Start at 16 and live twenty seasons of a footballer's career, one decision at a time. Free, in the browser.",
    '16 岁起步，一次一个选择，走完二十个赛季的球员生涯。免费，打开网页就能玩。',
  ],

  // The visible boot screen — the whole of what a non-rendering crawler reads.
  [
    '<h1 class="boot-title">A football career, one decision at a time</h1>',
    '<h1 class="boot-title">足球生涯，一次一个选择</h1>',
  ],
  [
    `          Start at sixteen. Pick the academy, take the loan, choose the move that makes you or the
          one that pays you. Twenty seasons in about five minutes — free, in your browser, with
          nothing to download.`,
    `          16 岁开始。选哪家青训、要不要租借出去、下一次转会是为了踢球还是为了钱——二十个赛季，
          五分钟走完。免费，打开网页就能玩，不用下载。`,
  ],
  ['<li>Sign for an academy and fight your way into the side</li>', '<li>进青训，然后一场一场把自己踢进一线队</li>'],
  ['<li>Go out on loan, prove it, and come back wanted</li>', '<li>租借出去证明自己，再让母队抢着把你要回来</li>'],
  [
    '<li>191 real clubs across England, Spain, Italy, Germany, France and beyond</li>',
    '<li>英西意德法及更多联赛，191 家真实俱乐部</li>',
  ],
  [
    '<li>Three world rankings — achievements, career earnings, highest transfer value</li>',
    '<li>三个世界排行榜——成就、生涯总收入、最高身价</li>',
  ],
  [
    '<li>A new daily challenge every day, the same football world for everyone</li>',
    '<li>每日挑战，全世界当天面对的是同一片足球世界</li>',
  ],
  [
    '          English · 简体中文 — 一款用选择来玩的足球生涯模拟游戏 ·\n          <a class="boot-link" href="/football-career-games/">How it compares to FIFA, EA FC and Football Manager</a>',
    '          简体中文 · English — a football career simulator played through decisions ·\n          <a class="boot-link" href="/zh/football-career-games/">和 FIFA、EA FC、足球经理比起来是什么样</a>',
  ],
  // The rest of the boot footer. About, Contact and Privacy are each one
  // bilingual page, so only their labels change for the Chinese twin.
  [
    '<a class="boot-link" href="/free-football-games-browser/">Free browser football games</a>',
    '<a class="boot-link" href="/zh/free-football-games-browser/">网页上的免费足球游戏</a>',
  ],
  ['>About</a>', '>关于</a>'],
  ['>Contact</a>', '>联系</a>'],
  ['>Privacy</a>', '>隐私政策</a>'],
];

let out = source;
const missing = [];
for (const [from, to] of SWAPS) {
  if (!out.includes(from)) {
    missing.push(from.slice(0, 72));
    continue;
  }
  out = out.replace(from, to);
}

if (missing.length > 0) {
  console.error('prerender: index.html no longer contains these strings, so /zh would ship English:');
  for (const m of missing) console.error(`  · ${m}…`);
  console.error('Update apps/web/scripts/prerender.mjs to match index.html.');
  process.exit(1);
}

// Directory rather than `zh.html`: the worker serves /zh/index.html for /zh,
// which keeps the URL clean and the canonical honest.
mkdirSync(join(dist, 'zh'), { recursive: true });
writeFileSync(join(dist, 'zh', 'index.html'), out);
console.log('prerendered dist/zh/index.html');
