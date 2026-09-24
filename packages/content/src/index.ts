/**
 * @bg/content — the world and every string in it.
 *
 * Kept separate from the engine on purpose. Balance and copy change constantly;
 * simulation logic does not. This split is also the escape hatch for the club
 * naming decision: swapping the roster is a change to one file here and nothing
 * anywhere else.
 */

import type { World } from '@bg/engine';
import { COUNTRIES } from './data/countries.js';
import { LEAGUES } from './data/leagues.js';
import { CLUBS } from './data/clubs.js';
import { OUTLETS } from './data/media.js';
import { MARQUEE_PLAYERS } from './data/squads.js';
import { NAME_POOLS, FALLBACK_POOL } from './data/names.js';
import type { Dictionary } from './i18n/en.js';

export const WORLD: World = {
  countries: COUNTRIES,
  leagues: LEAGUES,
  clubs: CLUBS,
  outlets: OUTLETS,
  marquee: MARQUEE_PLAYERS,
  namePools: { ...NAME_POOLS, default: FALLBACK_POOL },
};

export { COUNTRIES, LEAGUES, CLUBS, OUTLETS, MARQUEE_PLAYERS, NAME_POOLS };
export type { Dictionary };

export const LOCALES = ['en', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];

/** Everything the UI needs to render in one language. */
export interface LocalePack {
  dictionary: Dictionary;
  /**
   * Club names in this locale. Empty for English, where a club is called what
   * it calls itself and the roster already holds the name.
   */
  clubNames: Record<string, { name: string; short: string }>;
}

/**
 * Fetch one language.
 *
 * Both dictionaries used to be static imports, so every player downloaded both
 * — 15.5 kB gzipped of strings nobody would ever read. They are `import()`ed
 * instead, one per player, and the app waits for the first one before its first
 * paint. That wait is a single request issued as soon as the main bundle
 * evaluates; the crash screen is the only copy that cannot afford it, and it
 * lives in `i18n/crash.ts` for exactly that reason.
 *
 * Adding a locale means adding a case here, not touching a table: a
 * `Record<Locale, () => import(...)>` would defeat the point, because a
 * bundler cannot tree-shake what a lookup might reach.
 */
export async function loadLocale(locale: Locale): Promise<LocalePack> {
  if (locale === 'zh') {
    const [dictionary, clubs] = await Promise.all([
      import('./i18n/zh.js'),
      import('./i18n/clubs-zh.js'),
    ]);
    return { dictionary: dictionary.zh as Dictionary, clubNames: clubs.CLUB_NAMES_ZH };
  }
  return { dictionary: (await import('./i18n/en.js')).en, clubNames: {} };
}

/** Country display names, kept out of the main dictionary for size. */
export { COUNTRY_NAMES } from './i18n/countries.js';
/** The crash screen's copy, in every language at once — see the file. */
export { CRASH } from './i18n/crash.js';

/**
 * Resolve a dotted key against a dictionary and interpolate `{placeholders}`.
 * Returns the key itself when missing, which makes gaps obvious in the UI
 * instead of rendering an empty box.
 */
export function translate(
  dictionary: Dictionary,
  key: string,
  params?: Record<string, string | number>,
): string {
  const parts = key.split('.');
  let node: unknown = dictionary;
  for (const part of parts) {
    if (typeof node !== 'object' || node === null || !(part in node)) return key;
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node !== 'string') return key;
  if (!params) return node;
  return node.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
