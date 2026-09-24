/**
 * "What changed since you were last here."
 *
 * A returning player has no way of knowing the game moved. So the notice
 * carries a version number and is shown once per version, which is the whole
 * feature: a player who has been away for a month finds out that loans work
 * differently now, and a player who read it yesterday is not told twice.
 *
 * **Bump `NEWS_VERSION` whenever `intro.news_*` copy changes**, or returning
 * players will never see the new text — the version is the only thing that
 * decides whether the dot comes back.
 */
import { KEYS } from './storage';
export const NEWS_VERSION = '2026-09-23';

const STORE = KEYS.news;

/** Has this player already read the current notice? */
export function newsSeen(): boolean {
  try {
    return localStorage.getItem(STORE) === NEWS_VERSION;
  } catch {
    // Private mode, or storage disabled. Showing the notice again is a far
    // smaller cost than a crash on the first screen.
    return false;
  }
}

export function markNewsSeen(): void {
  try {
    localStorage.setItem(STORE, NEWS_VERSION);
  } catch {
    /* nothing to do — see above */
  }
}
