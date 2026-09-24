import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { COUNTRY_NAMES, OUTLETS, loadLocale, translate, type Locale, type LocalePack } from '@bg/content';
import type { AttributeKey, Club, Position } from '@bg/engine';
import { CURRENCY_RATES, CURRENCY_SYMBOLS, useSettings, type Currency } from './settings';
import { KEYS } from './storage';

const STORAGE_KEY = KEYS.locale;

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  country: (id: string) => string;
  /** Full club name in the active locale. */
  clubName: (club: Club) => string;
  /** Abbreviated club name, for tight rows. */
  clubShort: (club: Club) => string;
  /** Outlet name in the active locale. */
  outlet: (id: string) => string;
  /** Goalkeepers use the same six attribute slots under different names. */
  attributeLabel: (key: AttributeKey, position: Position) => string;
  money: (value: number) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

/** Exported for the error boundary, which renders outside every provider. */
export function detectLocale(): Locale {
  // The URL wins, and it wins over a stored preference on purpose: /zh is a
  // real indexed page that search results and shared links point at, and a
  // visitor who lands on it should get the language it promised rather than
  // whatever this device chose last time.
  try {
    // …except on itch.io, where the path is itch's own and says nothing about
    // language. There the stored preference decides, and then the default.
    if (!__ITCH__ && window.location.pathname.replace(/\/+$/, '') === '/zh') return 'zh';
  } catch {
    /* no location — server render or a test environment */
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'zh') return stored;
  } catch {
    /* private mode — fall through to the default */
  }
  // English until the player picks otherwise — decided on 2026-09-23.
  // It used to follow the browser, so a Chinese phone opened in Chinese; now
  // the choice is the player's, one tap away in the language switch, and /zh
  // (above) still opens in Chinese for anybody who arrived through it.
  return 'en';
}

/**
 * The first language starts downloading the moment this module evaluates —
 * before React has mounted anything — so the wait below is not the wait for a
 * request that has yet to be made. Both dictionaries used to be in the main
 * bundle; fetching only the one being read is 15.5 kB gzipped off every load.
 */
const INITIAL_LOCALE = detectLocale();
const INITIAL_PACK = loadLocale(INITIAL_LOCALE);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(INITIAL_LOCALE);
  const [pack, setPack] = useState<LocalePack | null>(null);
  const { currency } = useSettings();

  // One effect for both cases: the first pack is already in flight, a later one
  // is started here. `stale` is what stops a slow first load from overwriting a
  // language the player has since switched to.
  useEffect(() => {
    let stale = false;
    const pending = locale === INITIAL_LOCALE ? INITIAL_PACK : loadLocale(locale);
    void pending.then((next) => {
      if (!stale) setPack(next);
    });
    return () => {
      stale = true;
    };
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* not worth surfacing */
    }
    // Keep the address bar honest. /zh and / are separate indexed pages, so a
    // player who switches to Chinese and shares the link should be sharing the
    // Chinese one — and `detectLocale` reads the path first, so this is also
    // what makes the choice survive a reload.
    try {
      // Slashed: that is the URL Cloudflare serves the Chinese page at, and the
      // one its canonical claims. Writing `/zh` handed anybody who copied the
      // address bar a link that 307s.
      //
      // Not on itch.io, where the address bar is itch's: writing `/zh/` there
      // claims a path on their host that does not exist, and a reload lands on
      // a 404 instead of the game.
      const path = next === 'zh' ? '/zh/' : '/';
      if (!__ITCH__ && window.location.pathname !== path) {
        window.history.replaceState(null, '', path + window.location.search);
      }
      document.documentElement.lang = next === 'zh' ? 'zh-Hans' : 'en';
    } catch {
      /* history unavailable — the language still changed, which is the point */
    }
  }, []);

  // Covers the initial mount too — the static document ships lang="en", which
  // is wrong for a browser that detected Chinese.
  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-Hans' : 'en';
  }, [locale]);

  const value = useMemo<I18nValue | null>(() => {
    if (!pack) return null;
    const { dictionary, clubNames } = pack;
    const t = (key: string, params?: Record<string, string | number>) =>
      translate(dictionary, key, params);

    return {
      locale,
      setLocale,
      t,
      country: (id) => COUNTRY_NAMES[id]?.[locale] ?? id,
      // Falling back to the English name is deliberate: a club added to the
      // roster before its Chinese name is written still renders, it just
      // renders in English rather than as a missing-key placeholder.
      clubName: (club) => (locale === 'zh' ? (clubNames[club.id]?.name ?? club.name) : club.name),
      clubShort: (club) =>
        locale === 'zh' ? (clubNames[club.id]?.short ?? club.shortName) : club.shortName,
      outlet: (id) => OUTLETS.find((o) => o.id === id)?.name[locale] ?? id,
      attributeLabel: (key, position) =>
        t(`${position === 'GK' ? 'attributesGk' : 'attributes'}.${key}`),
      money: (value) => formatMoney(value, locale, currency),
    };
  }, [pack, locale, setLocale, currency]);

  // Nothing rather than a half-translated frame. The document already paints
  // the app's background colour, so what a player sees is the splash they were
  // going to see anyway, for one request longer at most.
  if (!value) return null;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}

/**
 * Money is shown constantly and has to stay narrow on a phone.
 *
 * Chinese groups by 万/亿 because €120,000,000 reads as noise to a Chinese
 * speaker while "1.2亿" reads instantly — and that grouping follows the
 * language, not the currency, so a Chinese player choosing pounds still gets
 * "£1.02亿".
 *
 * The engine only ever deals in euros; this converts for display.
 */
export function formatMoney(value: number, locale: Locale, currency: Currency = 'EUR'): string {
  if (!Number.isFinite(value)) return '—';
  const symbol = CURRENCY_SYMBOLS[currency];
  const v = Math.round(value * CURRENCY_RATES[currency]);

  if (locale === 'zh') {
    if (v >= 100_000_000) return `${symbol}${trim(v / 100_000_000)}亿`;
    if (v >= 10_000) return `${symbol}${trim(v / 10_000)}万`;
    return `${symbol}${v}`;
  }
  if (v >= 1_000_000_000) return `${symbol}${trim(v / 1_000_000_000)}B`;
  if (v >= 1_000_000) return `${symbol}${trim(v / 1_000_000)}M`;
  if (v >= 1_000) return `${symbol}${trim(v / 1_000)}K`;
  return `${symbol}${v}`;
}

function trim(value: number): string {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1).replace(/\.0$/, '');
  return value.toFixed(2).replace(/\.?0+$/, '');
}
