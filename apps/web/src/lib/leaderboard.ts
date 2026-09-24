/**
 * Leaderboard client.
 *
 * On career completion the finished run — seed, pace, identity and the full
 * decision list — is POSTed to the `career-submit` edge function, which replays
 * it through the same engine and only accepts the score the replay reproduces.
 * The response carries real global ranks for all three boards.
 *
 * Everything here is fail-soft: no network, a slow function, or a rejected
 * submission all fall back to the local percentile approximation in game.ts,
 * so the summary screen never blocks on the backend.
 */

import { useEffect, useRef, useState } from 'react';
import type { CareerState } from '@bg/engine';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase';

const ENDPOINT = `${SUPABASE_URL}/functions/v1/career-submit`;

export interface BoardStanding {
  rank: number;
  total: number;
  percent: number;
}

export interface LeaderboardResult {
  legacy: BoardStanding;
  wealth: BoardStanding;
  value: BoardStanding;
  /**
   * Everybody who played *this* world — the same seed at the same pace.
   *
   * This is the daily challenge's board, and it is the reason the daily exists:
   * `lib/daily.ts` says in its own header that three all-time boards are "a
   * wall, not a competition", and until now there was nothing behind that
   * sentence. The server does not decide which seed is today's, so this comes
   * back for every run; on a one-off seed it is a field of one and the summary
   * does not show it. Optional because an older deployed function does not
   * send it.
   */
  sameWorld?: BoardStanding;
}

async function submit(state: CareerState): Promise<LeaderboardResult | null> {
  if (!state.player || !state.retirement) return null;

  // Old saves predate the recorded identity; skip them rather than submit a
  // career the server would rightly reject.
  if (!state.identity) return null;

  const body = {
    seed: state.seed,
    pace: state.pace,
    identity: state.identity,
    decisions: state.history.map((entry) => entry.optionId),
    claimed: {
      legacy: state.retirement.legacyScore,
      gross: state.totals.grossEarnings,
      fees: state.totals.transferFees,
      // The third board ranks on the career's highest market value. Fees are
      // still submitted and stored — they are what the run produced — but they
      // are no longer what the board sorts on.
      peakValue: state.totals.peakMarketValue,
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { verified?: boolean; boards?: LeaderboardResult };
    if (!data.verified || !data.boards) return null;
    return data.boards;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Submit once when a career reaches its summary, and surface real global
 * standings when the server answers. `null` means "use the local estimate".
 */
export function useLeaderboard(state: CareerState | null): LeaderboardResult | null {
  const [result, setResult] = useState<LeaderboardResult | null>(null);
  const inFlight = useRef<string | null>(null);

  useEffect(() => {
    if (!state || state.phase !== 'summary' || !state.retirement) return;
    if (inFlight.current === state.seed) return;
    inFlight.current = state.seed;
    setResult(null);

    // Resubmitting after a refresh is deliberate: the server dedupes on
    // run_hash and answers with current standings either way, so the summary
    // gets real ranks instead of falling back to the local estimate.
    let cancelled = false;
    void submit(state).then((boards) => {
      if (!cancelled && boards) setResult(boards);
    });
    return () => {
      cancelled = true;
    };
    // One submission per finished career. Depending on `state` would resubmit
    // on every render of the summary screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.seed, state?.phase]);

  return result;
}
