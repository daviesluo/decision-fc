#!/usr/bin/env node
/**
 * Build the standalone content pages.
 *
 * Why these exist, stated plainly so nobody later mistakes them for a trick:
 *
 * The aim is for the site to turn up when somebody searches FIFA, EA FC,
 * Football Manager or PES. **Those head terms are not winnable** — EA, Sega,
 * Wikipedia and Steam own them with two decades of authority, and any amount of
 * meta-tag work changes that by nothing. Pretending otherwise would be a lie
 * dressed as an optimisation.
 *
 * What *is* winnable, and is where the person who would actually enjoy this
 * game is searching, is comparison intent: "football manager alternative free",
 * "games like FIFA career mode but shorter", "类似FM的手机游戏", "免费足球生涯
 * 游戏". Those queries have real volume, weak competition, and — this is the
 * part that matters — an honest answer that helps the reader.
 *
 * So each page is a real comparison written to be useful to somebody deciding,
 * including the parts where the answer is "go and play the other one". That is
 * both the ethical version and, not coincidentally, the version search engines
 * reward: a page built only to catch traffic is a doorway page, and Google
 * demotes those on purpose.
 *
 * The same text is the strongest lever available for being *recommended by an
 * assistant*, which answers "what is a game like X" from exactly this kind of
 * prose.
 *
 * Content lives in `pages/*.json` so the copy can be edited without touching
 * the markup. Runs after `vite build`, alongside `prerender.mjs`.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');
const SITE = 'https://decisionfc.com';

/** Escape anything that reaches HTML from the content files. */
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The shared shell. Deliberately its own small stylesheet rather than the app's:
 * these pages are documents, not the game, and loading a 400 kB bundle to read
 * four hundred words would be both slow and pointless. Nothing here needs
 * JavaScript at all.
 */
function render(page, altHref) {
  // Slashed. Cloudflare serves `<slug>/index.html` at `/<slug>/` and answers the
  // unslashed form with a 307, so publishing the unslashed one made every
  // canonical, every hreflang and every internal link point at a redirect.
  const canonical = `${SITE}/${page.slug}/`;
  const isZh = page.lang.startsWith('zh');
  const playHref = isZh ? '/zh/' : '/';

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return `<!doctype html>
<!--
  Decision FC · decisionfc.com
  Copyright © 2026 Davies Luo. All rights reserved. Proprietary; see the LICENSE
  file in the repository, or write to daviesluo@gmail.com.
-->
<html lang="${page.lang}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#070a09" />
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}" />
<link rel="canonical" href="${canonical}" />
<link rel="alternate" hreflang="en" href="${SITE}/football-career-games/" />
<link rel="alternate" hreflang="zh-Hans" href="${SITE}/zh/football-career-games/" />
<link rel="alternate" hreflang="x-default" href="${SITE}/football-career-games/" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${esc(page.title)}" />
<meta property="og:description" content="${esc(page.description)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${SITE}/og-card.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="${SITE}/og-card.png" />
<meta name="google-adsense-account" content="ca-pub-8335081072942378" />
<link rel="icon" type="image/jpeg" sizes="192x192" href="/icons/icon-192.jpg" />
<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#070a09;color:#f4f7f2;line-height:1.6;
    font-family:system-ui,-apple-system,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;
    -webkit-font-smoothing:antialiased}
  .wrap{max-width:720px;margin:0 auto;padding:44px 22px 76px}
  a{color:#a3e635}
  .eyebrow{font-size:11px;font-weight:700;letter-spacing:.26em;text-transform:uppercase;color:#a3e635}
  h1{margin:14px 0 18px;font-size:clamp(28px,6vw,42px);line-height:1.1;font-weight:800;letter-spacing:-.02em}
  h2{margin:44px 0 14px;font-size:21px;font-weight:700;letter-spacing:-.01em}
  h3{margin:0 0 4px;font-size:16px;font-weight:700}
  p{margin:0 0 14px;color:rgba(244,247,242,.72)}
  .note{font-size:13.5px;color:rgba(244,247,242,.45)}
  .card{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);
    border-radius:14px;padding:16px 18px;margin-bottom:12px}
  .card p{margin:0 0 6px;font-size:14.5px}
  .card p:last-child{margin:0}
  .label{color:rgba(244,247,242,.4);font-size:12px;text-transform:uppercase;letter-spacing:.08em}
  .cta{display:block;margin-top:16px;padding:16px;border-radius:14px;background:#9beE16;color:#0b1a05;
    text-align:center;font-weight:800;font-size:17px;text-decoration:none}
  footer{margin-top:52px;padding-top:20px;border-top:1px solid rgba(255,255,255,.1);
    font-size:13px;color:rgba(244,247,242,.4)}
</style>
</head>
<body>
<div class="wrap">
  <p class="eyebrow">Decision FC</p>
  <h1>${esc(page.h1)}</h1>
  ${page.intro.map((p) => `<p>${esc(p)}</p>`).join('\n  ')}

  <a class="cta" href="${playHref}">${esc(page.ctaLabel)}</a>

  <h2>${esc(page.comparisonTitle)}</h2>
  <p class="note">${esc(page.comparisonNote)}</p>
  ${page.comparison
    .map(
      (c) => `<div class="card">
    <h3>${esc(c.name)}</h3>
    <p><span class="label">${isZh ? '它' : 'It'}</span> ${esc(c.them)}</p>
    <p><span class="label">${isZh ? '这个' : 'This'}</span> ${esc(c.us)}</p>
    <p>${esc(c.who)}</p>
  </div>`,
    )
    .join('\n  ')}

  <h2>${esc(page.sectionsTitle)}</h2>
  ${page.sections.map((s) => `<h3>${esc(s.h)}</h3>\n  <p>${esc(s.p)}</p>`).join('\n  ')}

  <h2>${esc(page.faqTitle)}</h2>
  ${page.faq.map((f) => `<h3>${esc(f.q)}</h3>\n  <p>${esc(f.a)}</p>`).join('\n  ')}

  <h2>${esc(page.ctaTitle)}</h2>
  <p>${esc(page.ctaBody)}</p>
  <a class="cta" href="${playHref}">${esc(page.ctaLabel)}</a>

  <footer>
    <a href="${playHref}">decisionfc.com</a> · <a href="${altHref}">${isZh ? 'English' : '简体中文'}</a>
  </footer>
</div>
</body>
</html>
`;
}

const dir = join(here, 'pages');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const built = [];

for (const file of files) {
  const page = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const isZh = page.lang.startsWith('zh');
  const alt = isZh ? '/football-career-games/' : '/zh/football-career-games/';
  const out = join(dist, page.slug);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'index.html'), render(page, alt));
  built.push(page.slug);
}

console.log(`built ${built.length} content page(s): ${built.join(', ')}`);
