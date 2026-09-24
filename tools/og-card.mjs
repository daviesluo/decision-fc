#!/usr/bin/env node
/**
 * The 1200×630 card that shows when the site is shared or linked.
 *
 * `og:image` used to point at the 512×512 app icon, which is the wrong shape
 * for every surface that reads it: Twitter, Facebook, WeChat, iMessage and
 * Google's own result cards all want a landscape image and will letterbox or
 * centre-crop a square one. A share is the cheapest link a new domain can get,
 * and it is worth the image not looking like an accident.
 *
 * Drawn rather than photographed, for the same reason the intro icons are: it
 * has to survive being resized to a thumbnail, and it has to be rebuildable
 * when the copy changes.
 *
 *   node tools/og-card.mjs
 */
import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web', 'public', 'og-card.png');
const BROWSER = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium';

const html = `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; background: #070a09; color: #f4f7f2; position: relative;
    overflow: hidden;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  /* The floodlight and the mown stripes from the intro screen, so a shared
     link and the page it opens look like the same product. */
  .glow {
    position: absolute; left: -20%; right: -20%; top: -40%; height: 90%;
    border-radius: 50%;
    background: radial-gradient(ellipse at 50% 0%,
      rgb(184 255 60 / 0.30) 0%, rgb(155 238 22 / 0.07) 42%, transparent 72%);
  }
  .stripes {
    position: absolute; inset: 0;
    background: repeating-linear-gradient(97deg, transparent 0 74px, rgb(255 255 255 / 0.02) 74px 148px);
  }
  .wrap { position: relative; padding: 76px 84px; height: 100%; display: flex; flex-direction: column; justify-content: center; }
  .eyebrow { display: flex; align-items: center; gap: 16px; margin-bottom: 26px; }
  .rule { width: 54px; height: 5px; border-radius: 99px; background: #9beE16; }
  .brand { font-size: 25px; font-weight: 800; letter-spacing: 0.26em; text-transform: uppercase; color: #a3e635; }
  h1 { font-size: 84px; line-height: 0.99; font-weight: 800; letter-spacing: -0.025em; max-width: 15ch; }
  .lede { margin-top: 30px; font-size: 31px; line-height: 1.34; color: rgb(244 247 242 / 0.6); max-width: 26ch; }
  .foot {
    position: absolute; left: 84px; right: 84px; bottom: 58px;
    display: flex; align-items: center; justify-content: space-between;
    font-size: 23px; color: rgb(244 247 242 / 0.42);
  }
  .domain { font-weight: 700; color: rgb(244 247 242 / 0.72); }
</style></head>
<body>
  <div class="glow"></div>
  <div class="stripes"></div>
  <div class="wrap">
    <div class="eyebrow"><span class="rule"></span><span class="brand">Decision FC</span></div>
    <h1>Twenty years. One career.</h1>
    <p class="lede">A football career you play one decision at a time — in about five minutes.</p>
  </div>
  <div class="foot">
    <span class="domain">decisionfc.com</span>
    <span>Free · in your browser · English &amp; 简体中文</span>
  </div>
</body></html>`;

const browser = await chromium.launch({ executablePath: BROWSER });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.screenshot({ path: out, type: 'png' });
await browser.close();
console.log(`wrote ${out}`);
