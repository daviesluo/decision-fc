import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CLUBS, COUNTRIES, LEAGUES, MARQUEE_PLAYERS, OUTLETS } from '@bg/content';

/**
 * The site is allowed to boast, but only about things that are true.
 *
 * Every file below advertises how big the world is, in prose, to a reader who
 * cannot check: the boot screen a crawler reads before any JavaScript runs, the
 * Chinese twin of it, `llms.txt`, the comparison pages, and the two in-game
 * "about" strings. None of them is generated — they are hand-written copy, and
 * the number in them was written once, when the world had a different number of
 * clubs in it.
 *
 * It went stale exactly that way. The 26/27 rebuild took the world from 166
 * clubs to 191 and left ten files saying 165 — which is the sort of thing
 * nobody notices, because it is prose in eight places rather than a constant in
 * one, and it is precisely the text search engines and assistants quote back.
 *
 * So the claim is checked against the data instead of maintained by hand. Each
 * file has to make the claim at least once (a rewrite that quietly drops the
 * sentence fails here rather than passing silently) and every claim it makes
 * has to be the real number.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

/** Where the world's size is written down in prose, and in which language. */
const COPY: Array<[path: string, lang: 'en' | 'zh' | 'both']> = [
  ['docs/map.md', 'en'],
  ['apps/web/index.html', 'en'],
  ['apps/web/public/llms.txt', 'en'],
  ['apps/web/scripts/prerender.mjs', 'both'],
  ['apps/web/scripts/pages/alternatives.en.json', 'en'],
  ['apps/web/scripts/pages/alternatives.zh.json', 'zh'],
  ['packages/content/src/i18n/en.ts', 'en'],
  ['packages/content/src/i18n/zh.ts', 'zh'],
];

/** `191 real clubs` / `191 家真实俱乐部` — the phrase every claim has to use. */
const CLUBS_EN = /(\d+) (?:real )?clubs/g;
const CLUBS_ZH = /(\d+) 家真实俱乐部/g;

/** `twelve countries` / `十二个国家`, spelled out the way copy spells it. */
const COUNTRIES_EN = /([A-Za-z]+) countries/g;
const COUNTRIES_ZH = /([一二三四五六七八九十]+)个国家/g;
const WORDS_EN: Record<string, number> = {
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
};

/** 八 → 8, 十 → 10, 十二 → 12. Enough for a number of countries. */
function zhNumber(word: string): number | undefined {
  const digits = '一二三四五六七八九';
  const ones = (c: string) => digits.indexOf(c) + 1;
  const ten = word.indexOf('十');
  if (ten === -1) return digits.includes(word) ? ones(word) : undefined;
  const tens = ten === 0 ? 1 : ones(word[0] as string);
  const rest = word.slice(ten + 1);
  return tens * 10 + (rest === '' ? 0 : ones(rest));
}

const counts = (text: string, pattern: RegExp) => [...text.matchAll(pattern)].map((m) => m[1] as string);

describe('what the site says about itself', () => {
  const clubs = CLUBS.length;
  const countries = new Set(LEAGUES.map((l) => l.countryId)).size;

  it.each(COPY)('%s advertises the real number of clubs', (path, lang) => {
    const text = read(path);
    const claims = [
      ...(lang !== 'zh' ? counts(text, CLUBS_EN) : []),
      ...(lang !== 'en' ? counts(text, CLUBS_ZH) : []),
    ];
    expect(claims.length, `${path} no longer says how many clubs there are`).toBeGreaterThan(0);
    for (const claim of claims) expect(Number(claim), `${path} claims ${claim} clubs`).toBe(clubs);
  });

  it.each(COPY)('%s advertises the real number of countries', (path, lang) => {
    const text = read(path);
    // Only the counts standing next to a club count — "191 real clubs in twelve
    // countries", either order. Careers have countries too: the Globetrotter
    // achievement is about five of them, and that is a different number about a
    // different thing.
    const near = [
      ...(lang !== 'zh' ? [...text.matchAll(CLUBS_EN)] : []),
      ...(lang !== 'en' ? [...text.matchAll(CLUBS_ZH)] : []),
    ].map((m) => text.slice(Math.max(0, (m.index ?? 0) - 40), (m.index ?? 0) + 80));

    const claims = near
      .flatMap((window) => [
        ...counts(window, COUNTRIES_EN).map((w) => WORDS_EN[w.toLowerCase()]),
        ...counts(window, COUNTRIES_ZH).map(zhNumber),
      ])
      .filter((n): n is number => n !== undefined);
    for (const claim of claims) expect(claim, `${path} claims ${claim} countries`).toBe(countries);
  });

  // The rest of the inventory line in the repository map (docs/map.md), which
  // drifts for the same reason: "138 nationalities, 17 leagues, 191 clubs, 27
  // media outlets, 68 real 2026/27 squad players". One sentence, five numbers,
  // none of them generated.
  it('the inventory line in docs/map.md counts the world it ships', () => {
    const text = read('docs/map.md');
    const claim = (pattern: RegExp) => Number(text.match(pattern)?.[1]);
    expect(claim(/(\d+) nationalities/)).toBe(COUNTRIES.length);
    expect(claim(/(\d+) leagues/)).toBe(LEAGUES.length);
    expect(claim(/(\d+) media/)).toBe(OUTLETS.length);
    expect(claim(/(\d+) real 2026\/27 squad players/)).toBe(MARQUEE_PLAYERS.length);
  });
});
