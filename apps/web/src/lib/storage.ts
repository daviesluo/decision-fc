/**
 * Every key this game writes to the browser, in one place, plus the rename
 * that got them there.
 *
 * There were seven keys in three prefixes and two separators — `bg:save:v2`,
 * `bg:settings:v1`, `bg:locale`, `fc:ads`, `fc:daily`, `dfc.news`,
 * `fc:testhook` — one prefix per era of the project. Nothing was broken by it;
 * it was a trap for the next person adding a key, and it made "clear
 * everything this game stored" impossible to write correctly, which is a
 * question a privacy page should be able to answer.
 *
 * One namespace now: `fc:`, colon-separated, because four of the seven already
 * were. The `v` suffix stays on the two keys whose *shape* is versioned — a
 * save and a settings blob are parsed, and a v1 reader must be able to tell it
 * is looking at v2 — and is absent from the ones that hold a single string.
 *
 * ## The rename, and why it runs when this module evaluates
 *
 * `migrateStorage()` moves the four old keys to their new names and deletes the
 * old ones. It is one-directional and one-shot: a player who has the new key
 * keeps it, a player who has only the old one is moved, and a player with both
 * — which cannot happen, but browsers are browsers — keeps the new one.
 *
 * **It is called at the bottom of this file, not from `main.tsx`, and that is
 * load-bearing.** It was called from `main.tsx` first, and the language
 * preference still arrived un-migrated: `i18n.tsx` resolves the locale *while
 * its module evaluates*, deliberately, so the dictionary starts downloading
 * before React mounts. Module evaluation happens during import, which is before
 * any statement in `main.tsx` runs. So the reader ran first and read nothing.
 *
 * Every reader imports this module for its key, which means the import graph
 * puts this file's body before all of them. The ordering is then a property of
 * the code rather than of somebody remembering to call it in the right place.
 * `verify-ui.mjs` proves it end to end by writing the *old* locale key and
 * asking for a Chinese run — the failure mode is a run in the wrong language,
 * which every assertion in it then trips over. That is how this bug was found.
 *
 * Losing a career to a rename would be unforgivable for a game with no
 * account, so the save is the first thing it moves and the whole function is
 * wrapped: private browsing throws on the accessor itself rather than
 * returning null.
 */

/** The keys the app reads and writes. Nothing outside this file names one. */
export const KEYS = {
  save: 'fc:save:v2',
  settings: 'fc:settings:v1',
  locale: 'fc:locale',
  news: 'fc:news',
  ads: 'fc:ads',
  daily: 'fc:daily',
  /** The playtest harness's opt-in state hook — see `App.tsx`. */
  testHook: 'fc:testhook',
} as const;

/** Old name → new name. Removed from this list once nobody can still have it. */
const RENAMED: ReadonlyArray<readonly [string, string]> = [
  ['bg:save:v2', KEYS.save],
  ['bg:settings:v1', KEYS.settings],
  ['bg:locale', KEYS.locale],
  ['dfc.news', KEYS.news],
];

/**
 * Keys for features that no longer exist, deleted rather than left behind.
 *
 * `fc:history:v1` held the last twenty finished careers for an archive on the
 * title screen, which was removed on 2026-09-23. A player who used it
 * still has up to twenty summaries on their device that nothing will ever read
 * again — and a privacy page that says what this game stores should not have
 * an exception it does not mention. Removed from this list once nobody can
 * still have it, like the renames above.
 */
const RETIRED: readonly string[] = ['fc:history:v1'];

function migrateStorage(): void {
  try {
    for (const [from, to] of RENAMED) {
      const value = localStorage.getItem(from);
      if (value === null) continue;
      // A player who already has the new key has already been migrated; the old
      // one is then a leftover and goes either way.
      if (localStorage.getItem(to) === null) localStorage.setItem(to, value);
      localStorage.removeItem(from);
    }
    for (const key of RETIRED) localStorage.removeItem(key);
  } catch {
    // Storage disabled entirely. Nothing to migrate, and nothing to lose:
    // every reader already treats a missing value as a first visit.
  }
}

// Runs on import, before any key in `KEYS` is read by anybody. See above.
migrateStorage();
