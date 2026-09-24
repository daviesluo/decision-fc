import { Component, type ErrorInfo, type ReactNode } from 'react';
import { CRASH } from '@bg/content';
import { detectLocale } from '../lib/i18n';
import { discardSave } from '../lib/game';
import { track } from '../lib/telemetry';
import { Button } from './ui';

/**
 * The last line of defence, and specifically an escape hatch.
 *
 * A throw anywhere in a screen unmounts React to a blank page. That alone is
 * survivable — but the whole game is one save key, and the app rebuilds the
 * same state from it on reload, so a crash that depends on the saved career
 * recurs immediately. Without a way out, one bad state is a permanently broken
 * game with no visible cause and nothing the player can do about it.
 *
 * So the two buttons are the point. Reload covers the transient case; discard
 * throws the career away and is the only thing that fixes the other one.
 *
 * Deliberately outside every provider — the crash may well be *in* one — which
 * is why it reads the dictionary directly instead of through `useI18n`, and why
 * it is a class: `componentDidCatch` still has no hook equivalent.
 */
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // The console is still the only place the *detail* lives — a player who
    // reports a crash is asked for that. What leaves the device is a single
    // increment of one counter with no message, no stack and no career in it:
    // enough to know that crashes happen and roughly how often, which is the
    // difference between a rare edge case and something everybody is hitting.
    track('error');
    console.error('Career screen crashed', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;

    const copy = CRASH[detectLocale()];
    const reload = () => window.location.reload();
    const discard = () => {
      discardSave();
      window.location.reload();
    };

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-turf-950 px-7 text-center text-chalk">
        <div>
          <h1 className="display text-[22px] font-bold uppercase tracking-wide">{copy.title}</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-white/55">{copy.body}</p>
        </div>
        {/* The message is the only clue anyone gets, so it is shown rather than
            swallowed — small, muted, and not the first thing read. */}
        <p className="num max-w-full truncate text-[10px] text-white/25">{this.state.error.message}</p>
        <div className="grid w-full max-w-[300px] gap-2">
          <Button onClick={reload}>{copy.reload}</Button>
          <Button variant="ghost" size="sm" onClick={discard}>
            {copy.discard}
          </Button>
        </div>
      </div>
    );
  }
}
