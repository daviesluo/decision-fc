/**
 * The funnel, counted, and deliberately nothing else.
 *
 * `docs/tech-plan.md` §7 has listed this funnel as a launch requirement
 * since the first week of the project — entry, identity completion, season-5
 * retention, career completion, replay — and until now nothing recorded any of
 * it. The only feedback the game had was playing it by hand and a table of
 * *finished* careers, which by definition excludes everybody who left. The
 * most valuable number in the project was the one nobody had: how many people
 * start a career and never finish one.
 *
 * ## What is sent
 *
 * One event name. That is the whole payload.
 *
 * There is no visitor id, no session id, no cookie, no stored identifier, no
 * address, no user agent, no screen size, no referrer, no path, no career
 * detail — nothing that could be joined to anything, including to another
 * event from the same person. The server keeps one integer per name per day
 * (`packages/backend/sql/`), so a row can say "forty-one careers finished on
 * the 14th" and can never say whose. Every ratio the funnel needs is a division
 * of two of those integers.
 *
 * That is not squeamishness, it is the cheap version. Anything with a visitor
 * id needs a consent banner in the UK and the EEA, needs a retention policy,
 * needs a subject-access answer, and becomes a breach if it leaks. Daily
 * counters need none of that and answer the question anyway.
 *
 * ## What is never sent
 *
 * Anything at all, if the player's browser has asked not to be measured
 * (Global Privacy Control, or the older Do Not Track), or if the page is not
 * running on a real host — see `onRealHost`. Both are checked before the first
 * request, not after.
 *
 * ## How it fails
 *
 * Silently, always. A counter that can break a game is worth less than no
 * counter: every call is fire-and-forget, nothing is awaited, nothing throws,
 * and a network that refuses the request changes nothing the player sees.
 */
import { SUPABASE_ANON_KEY, SUPABASE_URL, onRealHost } from './supabase';

/**
 * The seven funnel steps and an error count. This list is also enforced
 * server-side — `bg_event` ignores a name it does not recognise — so adding one
 * here without adding it there records nothing.
 *
 * **`visit` is per page load; everything else is per career.** A player who
 * opens the game once and plays three careers is one `visit` and three
 * `career_started`, so that ratio is careers-per-session and can exceed 1 — it
 * did on day one, 11 against 10. The ratios that mean what they look like all
 * have a per-career denominator: `identity_done ÷ career_started`,
 * `career_finished ÷ identity_done`, `season_5 ÷ identity_done`,
 * `replay ÷ career_finished`. `docs/tech-plan.md` §7 has the table.
 *
 * `career_started` exists for exactly that reason. The tech plan has asked for
 * an "entry → identity-creation completion rate" since week one and it could
 * not be computed: the only denominator available was a page load. This is the
 * intro→identity transition, so the top of the funnel finally has a per-career
 * denominator — and it needed one new name rather than a session id.
 */
export type FunnelEvent =
  | 'visit'
  | 'career_started'
  | 'identity_done'
  | 'season_5'
  | 'career_finished'
  | 'replay'
  | 'share'
  | 'error';

const ENDPOINT = `${SUPABASE_URL}/rest/v1/rpc/bg_event`;

/** Has the browser asked not to be measured? */
function optedOut(): boolean {
  if (typeof navigator === 'undefined') return true;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1';
}

let enabled: boolean | null = null;
function allowed(): boolean {
  enabled ??= onRealHost() && !optedOut();
  return enabled;
}

/**
 * Count one funnel step.
 *
 * Every call counts, and it is the **caller's** job to call once per thing
 * that happened. There is deliberately no de-duplication here, because the
 * only honest key would be per career per device, and that is a stored
 * identifier — the one thing this module exists to do without. `App.tsx`
 * solves it instead by counting state *transitions*: a step taken in an
 * earlier session is not re-counted when the save resumes.
 */
export function track(name: FunnelEvent): void {
  if (!allowed()) return;
  try {
    // `keepalive` so a count sent as the player leaves still goes out. Not
    // `sendBeacon`, which cannot carry the two headers this endpoint needs.
    void fetch(ENDPOINT, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ p_name: name }),
    }).catch(() => {});
  } catch {
    // An exception from fetch itself — a blocked request, a dead iframe. The
    // game does not care.
  }
}
