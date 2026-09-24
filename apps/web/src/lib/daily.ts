/**
 * The daily challenge.
 *
 * Everybody who plays today gets the same *world*: the same academy offers, the
 * same event deck in the same order, the same clubs calling in the same
 * windows, every roll identical. What they bring to it is their own — the
 * position, the player type, and every decision after that.
 *
 * This costs the engine nothing. A career already replays exactly from
 * `seed + identity + decision list` — it has to, because that is what the
 * leaderboard's anti-cheat re-runs — so a fixed seed is most of the feature.
 *
 * **The pace is fixed too, and that part is not cosmetic.** Pace changes how
 * many cards a season deals and how far each effect is scaled, so a daily
 * played on Speed and one played on Deep are not the same challenge in any
 * sense that a comparison would survive. It used to inherit whatever the intro
 * screen happened to have selected, which quietly made every daily result
 * incomparable with every other. Position and player type stay the player's,
 * because those are the expression the game is *about*; the pace is a
 * preference about session length and has no business deciding a contest.
 *
 * It is the answer to a real problem: three leaderboards ranked against
 * everybody who has ever played are a wall, not a competition. A board that
 * resets every day and hands everyone the same world is a thing a player can
 * actually win, and it gives them a reason to come back tomorrow rather than a
 * reason to close the tab.
 */
import type { Pace } from '@bg/engine';
import { KEYS } from './storage';

/**
 * The pace every daily challenge is played at.
 *
 * Standard, because it is the default the game recommends and the one the
 * balance table is calibrated against.
 */
export const DAILY_PACE: Pace = 'standard';

/** The challenge day, in UTC — everyone has to be playing the same one. */
export function challengeDay(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
}

/**
 * The seed for a given day.
 *
 * Deliberately derived from the date alone and not from anything device-local,
 * so two people on opposite sides of the world get the same career on the same
 * calendar day. UTC rather than local time for the same reason: a challenge
 * that rolls over at midnight *somewhere* is not one challenge.
 */
export function dailySeed(day = challengeDay()): string {
  return `daily-${day}`;
}

/**
 * Whether a finished career was a daily challenge.
 *
 * Matched on the shape of the seed rather than against *today's* seed, and
 * that is deliberate: a player who finishes at 00:01 UTC, or reopens a summary
 * the next morning, played the challenge just as much as one who finished at
 * noon. Comparing against today would quietly deny them the board they earned.
 *
 * The pace has to match too — `DAILY_PACE` is what makes two daily runs
 * comparable at all, and a seed of this shape reached any other way is not the
 * challenge.
 */
export function isDailyRun(seed: string, pace: Pace): boolean {
  return pace === DAILY_PACE && /^daily-\d{4}-\d{2}-\d{2}$/.test(seed);
}

const STORE = KEYS.daily;

/** Whether today's challenge has already been played on this device. */
export function playedToday(now = new Date()): boolean {
  try {
    return localStorage.getItem(STORE) === challengeDay(now);
  } catch {
    return false;
  }
}

export function markPlayedToday(now = new Date()): void {
  try {
    localStorage.setItem(STORE, challengeDay(now));
  } catch {
    // Private browsing. Worst case the card offers the challenge twice, which
    // is a far smaller problem than a crash.
  }
}
