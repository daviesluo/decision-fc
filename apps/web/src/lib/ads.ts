/**
 * Rewarded ads on "play again" — the monetisation model, and its guard rails.
 *
 * The game is free and ad-funded (IAA), and the natural slot is the one moment
 * a player has already decided to spend more time: the button at the end of a
 * career. Nothing else is gated. There is no ad between seasons, none on a
 * decision card, and none on the first career of the day — interrupting a
 * career in progress would be selling the thing the game is for.
 *
 * ## The ladder
 *
 * The first replay each day is free. After that they cost 5s, 10s, 15s, 20s,
 * then 30s from there on.
 *
 * The free one matters more than it looks. A player who has just finished their
 * very first career is at the single most fragile moment in the funnel — they
 * have decided they might want another, and have not yet decided they like the
 * game. Meeting that with a toll is how a curious player becomes a closed tab.
 *
 * The ladder **resets daily**. Escalation exists to price the tenth replay of
 * an afternoon, not to punish somebody for coming back tomorrow — a counter
 * that only ever climbs turns a returning player into a churned one.
 *
 * ## The skip
 *
 * Every ad longer than the floor can be skipped at its halfway point, and
 * skipping still grants the replay. That is deliberate and it is not
 * generosity: a rewarded ad that traps the player produces one angry session
 * and no second one, while a skippable ad that most people sit through
 * produces both an impression and a returning player. The escalation lands on
 * the skip threshold too, so the cost of impatience rises with the cost of
 * patience.
 *
 * ## The reward is never withheld
 *
 * If the ad fails to load, errors, or the provider is missing entirely, the
 * replay is granted anyway. An ad network having a bad afternoon must never
 * be able to stop somebody playing the game.
 */
import { KEYS } from './storage';

/** Seconds of ad, from the second replay of the day onwards. */
export const AD_LADDER = [5, 10, 15, 20, 30] as const;

/** How many replays a player gets for nothing each day. */
export const FREE_REPLAYS_PER_DAY = 1;

/** The shortest ad we will ever show, and the floor for the skip threshold. */
const FLOOR = 5;

/** Storage key. The date is part of the value, not the key, so it self-cleans. */
const STORE = KEYS.ads;

export interface AdPlan {
  /** How long this ad runs, in seconds. */
  seconds: number;
  /**
   * When the skip button appears, in seconds. Equal to `seconds` when the ad
   * is already at the floor — there is nothing to skip out of.
   */
  skipAt: number;
  /** Which replay of the day this is, counting from zero. */
  replayIndex: number;
}

/**
 * Ad length for the nth replay of the day, counting from zero. Returns 0 for
 * the free ones.
 */
export function adSeconds(replayIndex: number): number {
  const paid = replayIndex - FREE_REPLAYS_PER_DAY;
  if (paid < 0) return 0;
  return AD_LADDER[Math.min(paid, AD_LADDER.length - 1)]!;
}

/** The ad for a given replay, or null when that replay is free. */
export function planFor(replayIndex: number): AdPlan | null {
  const seconds = adSeconds(replayIndex);
  if (seconds === 0) return null;
  // Halfway, floored at five seconds, and never past the end of the ad itself.
  const skipAt = Math.min(seconds, Math.max(FLOOR, Math.ceil(seconds / 2)));
  return { seconds, skipAt, replayIndex };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

interface Stored {
  /** Local calendar day, `YYYY-MM-DD`. */
  day: string;
  /**
   * Replays started today, free ones included.
   *
   * Counting replays rather than ads *watched* is what makes the free one
   * honest: a counter that only moves when an ad plays would hand out the free
   * replay again on every single replay, because it would never leave zero.
   */
  replays: number;
}

/**
 * Today, in the player's own timezone.
 *
 * Deliberately local rather than UTC: "a day" has to mean the player's day, or
 * somebody in Shanghai gets their ladder reset in the middle of an evening
 * session.
 */
function today(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function read(now: Date): Stored {
  const day = today(now);
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return { day, replays: 0 };
    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (parsed.day !== day || typeof parsed.replays !== 'number') return { day, replays: 0 };
    return { day, replays: Math.max(0, Math.floor(parsed.replays)) };
  } catch {
    // A corrupt or unavailable store must not cost anybody a replay.
    return { day, replays: 0 };
  }
}

/** How many replays this player has started today. */
export function replaysToday(now = new Date()): number {
  return read(now).replays;
}

/**
 * Record a replay. Called whether the ad was watched, skipped, failed to load
 * or was free — the counter is about replays, and every one of those was one.
 */
export function recordReplay(now = new Date()): void {
  const state = read(now);
  try {
    localStorage.setItem(STORE, JSON.stringify({ day: state.day, replays: state.replays + 1 }));
  } catch {
    // Private browsing, quota, a disabled store. Not worth a broken replay.
  }
}

// ---------------------------------------------------------------------------
// The provider seam
// ---------------------------------------------------------------------------

/**
 * What a real ad network has to supply.
 *
 * Nothing here is wired to one yet. The countdown, the skip, the ladder and the
 * reward are all real and complete; the *creative* is the game's own house
 * promo until a network is signed. Keeping the seam explicit means adding
 * AdSense/AdMob for the web build, and a Chinese network for the WeChat build,
 * is one implementation of this interface rather than a rewrite of the flow.
 *
 * `show` resolves when the creative has finished or been skipped, and rejects
 * if it could not be shown at all — which the caller treats as "grant anyway".
 */
export interface AdProvider {
  readonly id: string;
  show(plan: AdPlan): Promise<void>;
}

let provider: AdProvider | null = null;

export function setAdProvider(next: AdProvider | null): void {
  provider = next;
}

export function getAdProvider(): AdProvider | null {
  return provider;
}
