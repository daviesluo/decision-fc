import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { KEYS } from './storage';

/**
 * Player settings, persisted locally.
 *
 * Kept separate from the game state on purpose: settings survive across careers
 * and must never end up inside a save file, because a save is replayed through
 * the engine to verify leaderboard scores and display preferences have nothing
 * to do with what happened on the pitch.
 */

const STORAGE_KEY = KEYS.settings;

export const CURRENCIES = ['EUR', 'GBP', 'USD', 'CNY'] as const;
export type Currency = (typeof CURRENCIES)[number];

/**
 * Display-only conversion from the engine's euros.
 *
 * Deliberately fixed rather than fetched. Live rates would make two runs of the
 * same career show different wages, and the leaderboards compare euro figures —
 * a moving rate would turn a display preference into a scoring difference.
 */
export const CURRENCY_RATES: Record<Currency, number> = {
  EUR: 1,
  GBP: 0.85,
  USD: 1.08,
  CNY: 8.2,
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: '€',
  GBP: '£',
  USD: '$',
  CNY: '¥',
};

export interface Settings {
  currency: Currency;
  /** Show the raw odds on every option. On by default; this is the game. */
  showOdds: boolean;
  /**
   * Cut animation for players who find it distracting or slow. Defaults to the
   * device's own `prefers-reduced-motion` setting — see `prefersReducedMotion`.
   */
  reducedMotion: boolean;
}

const DEFAULTS: Settings = {
  currency: 'GBP',
  showOdds: true,
  reducedMotion: false,
};

interface SettingsValue extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

/**
 * Pounds for everyone until the player says otherwise — decided on
 * 2026-09-23, replacing euros.
 *
 * One default for everybody rather than a guess from the browser locale: it
 * used to offer yuan to a Chinese phone and dollars to an American one, which
 * made the game read as though it were denominated in whatever you happened to
 * be holding. Display only — the engine and the leaderboards stay in euros, so
 * this can never change a score. Anyone who wants euros or yuan has the setting.
 */
/**
 * Whether the device has already asked for less movement.
 *
 * `prefers-reduced-motion` is how a player says this once, at the OS level, for
 * every app they own — and this setting ignored it completely, so somebody who
 * had set it system-wide still got the full 2.3-second roulette on every
 * gamble. Reading it as the *default* rather than as an override keeps the
 * in-game toggle meaningful: the OS decides where the switch starts, the player
 * decides where it ends up.
 */
function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function load(): Settings {
  const defaults: Settings = { ...DEFAULTS, reducedMotion: prefersReducedMotion() };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const stored = JSON.parse(raw) as Record<string, unknown>;
    /*
     * Only the keys this version knows. A setting that has been removed —
     * `revealSpeed` was, deliberately — would otherwise ride along in
     * every save for ever, invisible and meaningless.
     */
    const known = Object.fromEntries(
      Object.entries(stored).filter(([key]) => Object.hasOwn(DEFAULTS, key)),
    ) as Partial<Settings>;
    return { ...defaults, ...known };
  } catch {
    return defaults;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);

  const set = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((current) => {
      const next = { ...current, [key]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* not worth surfacing */
      }
      return next;
    });
  }, []);

  const value = useMemo<SettingsValue>(() => ({ ...settings, set }), [settings, set]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside SettingsProvider');
  return value;
}
