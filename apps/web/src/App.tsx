import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from './lib/game';
import { I18nProvider } from './lib/i18n';
import { SettingsProvider } from './lib/settings';
import { planFor, recordReplay, replaysToday, type AdPlan } from './lib/ads';
import { track } from './lib/telemetry';
import { KEYS } from './lib/storage';
import { AdOverlay } from './components/AdOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import { IntroScreen } from './screens/Intro';
import { IdentityScreen, type CarriedIdentity } from './screens/Identity';
import { CareerScreen } from './screens/Career';
import { SummaryScreen } from './screens/Summary';

/**
 * Router by career phase. There is no URL routing on purpose: the game is a
 * single continuous session, and a back button that re-rolled a decision would
 * break both the fiction and the leaderboard.
 */
function Game() {
  const { state, rankable, start, chooseIdentity, decide, reset, club } = useGame();
  const [ad, setAd] = useState<AdPlan | null>(null);

  /**
   * The playtest harness's window into the game, opt-in via localStorage.
   *
   * `tools/playtest.mjs` plays thousands of careers through the real screens
   * and needs to judge whether what the screen *shows* is what the career *is*
   * — an age that skipped a year, a keeper credited with goals, a rating that
   * fell off a cliff. Parsing that back out of rendered, localised text is
   * exactly the kind of brittle guesswork the harness exists to catch, so the
   * state is published as an object instead — only when the flag is set, which
   * no ordinary browser has. Nothing secret is exposed: the whole engine
   * already runs on the client, and the leaderboard's anti-cheat replays
   * careers server-side regardless of anything a client mutates.
   */
  useEffect(() => {
    try {
      if (localStorage.getItem(KEYS.testHook) === '1') {
        (window as { __fcState?: unknown }).__fcState = state;
      }
    } catch {
      // Private browsing: no flag, no hook.
    }
  }, [state]);
  /**
   * The funnel, counted on the moment each step is actually taken.
   *
   * Three of the six steps are readable straight off the state machine, so
   * they are counted here rather than threaded through three screens. What
   * matters is that each one is a **transition**, not a condition: a saved
   * career resumes into whatever state it was left in, so "the phase is past
   * identity" or "there are five seasons" is true on every page load for the
   * rest of that career. Counted as conditions, a player who reloads four
   * times would post four season-five retentions, the ratios would drift up
   * with every reload, and the funnel would flatter the game in exactly the
   * place it is supposed to be honest.
   *
   * So the previous state is remembered and only the crossing counts. A step
   * taken in an earlier session is not re-counted in this one, and a step
   * taken across two sessions — saved in season four, returned, played on —
   * counts once, in the session where it happened.
   *
   * `lib/telemetry.ts` sends one event name and nothing else, only from a real
   * host, and never if the browser has asked not to be measured.
   */
  const funnel = useRef<{ phase: string; seasons: number } | null>(null);
  useEffect(() => {
    if (!state) {
      /*
       * Back at the front door. Recorded so that *starting* a career is a
       * crossing like the others: without it the very first career of a page
       * load has no "before" to cross from, because the first state this
       * effect ever sees is already the identity screen.
       */
      funnel.current = { phase: 'intro', seasons: 0 };
      return;
    }
    const before = funnel.current;
    funnel.current = { phase: state.phase, seasons: state.seasons.length };
    if (!before) return; // First state of this page load: nothing was crossed.

    if (before.phase !== 'identity' && state.phase === 'identity') track('career_started');
    if (before.phase === 'identity' && state.phase !== 'identity') track('identity_done');
    if (before.seasons < 5 && state.seasons.length >= 5) track('season_5');
    if (before.phase !== 'summary' && state.phase === 'summary') track('career_finished');
  }, [state]);

  /**
   * Who the last career was, carried into the next one.
   *
   * A replay used to land on the pace picker and then on a blank identity
   * screen, so somebody playing five careers in a row typed the same name and
   * hunted for the same flag five times. The one thing a player actually wants
   * to change between runs is what kind of footballer he is — so everything
   * else comes back filled in, and all of it is still editable.
   */
  const [carried, setCarried] = useState<CarriedIdentity | null>(null);

  /**
   * Replay is the one place the game asks for anything, and the first one each
   * day asks for nothing. Quitting mid-career is never gated — somebody walking
   * away from a career they are not enjoying is the last person to sell an ad
   * to, and `onQuit` goes straight to `reset`.
   */
  const again = useCallback(() => {
    const player = state?.player;
    if (player) {
      setCarried({
        lastName: player.lastName,
        shirtNumber: player.shirtNumber,
        foot: player.foot,
        countryId: player.countryId,
        position: player.position,
      });
    }
    // Straight to the identity screen at the pace just played, rather than
    // back to the front door.
    start(state?.pace ?? 'standard');
  }, [start, state]);

  const replay = useCallback(() => {
    track('replay');
    const plan = planFor(replaysToday());
    recordReplay();
    // A free replay has no plan and no overlay; it just starts.
    if (!plan) {
      again();
      return;
    }
    setAd(plan);
  }, [again]);

  const finishAd = useCallback(() => {
    setAd(null);
    again();
  }, [again]);

  if (ad) {
    return <AdOverlay plan={ad} onDone={finishAd} />;
  }
  if (!state) {
    return <IntroScreen onStart={start} />;
  }
  if (state.phase === 'identity') {
    return <IdentityScreen initial={carried} onConfirm={chooseIdentity} onBack={reset} />;
  }
  if (state.phase === 'summary') {
    return <SummaryScreen state={state} rankable={rankable} onReplay={replay} />;
  }
  return <CareerScreen state={state} club={club} onDecide={decide} onQuit={reset} />;
}


/** One per page load, before anything can go wrong further down. */
track('visit');

export default function App() {
  // Settings wraps i18n because money formatting depends on the chosen currency.
  // The boundary is outside both, so a throw in either still lands somewhere the
  // player can act on rather than on a blank page.
  //
  // The stage/frame pair is a no-op on a phone and is what makes the game an
  // object rather than a stretched column on a computer — including confining
  // every `fixed` overlay in the app to the frame. Both rules, and why the
  // transform on `.app-frame` must not be removed, are in `styles/app.css`.
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <I18nProvider>
          <div className="app-stage">
            <div className="app-frame">
              <Game />
            </div>
          </div>
        </I18nProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}
