import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { getAdProvider, type AdPlan } from '../lib/ads';
import { hasAdNetwork } from '../lib/ad-adsense';
import { Button } from './ui';

/**
 * The rewarded ad shown before a replay.
 *
 * One job, and one guarantee: it always ends in the replay. The countdown can
 * run out or the player can skip it, and both grant the career — see
 * `lib/ads.ts` for why skipping is allowed to.
 *
 * The creative is the game's own house promo. There is no ad network wired yet
 * and this deliberately does not pretend otherwise: the frame says "advertisement"
 * because that is what the slot is, and the moment a provider is registered
 * (`setAdProvider`) its creative renders here instead.
 *
 * ## How much of the screen it takes
 *
 * On a phone, all of it — that is what a rewarded interstitial is, and the
 * player has just asked for one by pressing replay.
 *
 * On a computer it must not, and now does not: `fixed inset-0` resolves against
 * `.app-frame` rather than the window on wide screens, so this fills the game
 * panel and nothing else. The rest of the browser stays exactly where it was. A
 * full-screen takeover on a 27-inch monitor is the single most hostile thing a
 * free web game does, and it is not something a rewarded slot needs — the ad is
 * as visible in a 460px panel the player is already looking at.
 *
 * The honest limit: this governs *our* creative. A signed rewarded-video
 * network — Google's H5 Games Ads, `lib/ad-adsense.ts` — renders its video in
 * its own overlay outside this component's tree, and how much of the viewport
 * that covers is the network's call, not ours. What this file controls is the
 * frame, the countdown, the skip and the reward, and those are the parts that
 * decide whether a player comes back.
 */
export function AdOverlay({ plan, onDone }: { plan: AdPlan; onDone: () => void }) {
  const { t } = useI18n();
  const [left, setLeft] = useState(plan.seconds);
  const done = useRef(false);

  // One timer, counting the whole ad. `done` guards the reward so a countdown
  // that lands in the same tick as a tap cannot grant two replays.
  //
  // With a real network the timer is a *deadline*, not the ad: the network's
  // video owns the screen and reports its own progress, so ours stays hidden
  // and only exists to make sure a slot that never calls back still ends in a
  // replay.
  const network = hasAdNetwork();
  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => {
      const elapsed = (Date.now() - started) / 1000;
      const remaining = Math.max(0, Math.ceil(plan.seconds - elapsed));
      setLeft(remaining);
      if (remaining === 0) finish();
    }, 200);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.seconds]);

  // A real provider gets to render instead. If it throws or never resolves in
  // time, the countdown above still ends the ad and grants the replay.
  useEffect(() => {
    const provider = getAdProvider();
    if (!provider) return;
    provider.show(plan).then(finish, finish);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish() {
    if (done.current) return;
    done.current = true;
    onDone();
  }

  const watched = plan.seconds - left;
  const canSkip = watched >= plan.skipAt && left > 0;
  const progress = Math.min(100, (watched / plan.seconds) * 100);

  return (
    <div data-ad className="fixed inset-0 z-50 flex flex-col bg-[#070a09]">
      {/* The network draws its own countdown, controls and skip. Ours would be
          a second clock disagreeing with the first. */}
      {/* Label first. A player is owed knowing this is an ad before it plays. */}
      <div className="flex items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <span className="display text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">
          {t('ads.label')}
        </span>
        <span className="num text-[12px] font-bold text-white/45">
          {!network && left > 0 ? t('ads.countdown', { seconds: left }) : ''}
        </span>
      </div>

      <div
        className={`relative mx-4 mt-3 h-[3px] overflow-hidden rounded-full bg-white/10 ${network ? 'invisible' : ''}`}
      >
        <div
          className="h-full rounded-full bg-lime-500 transition-[width] duration-200 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* The creative. House promo until a network is signed. */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="display text-[34px] font-bold uppercase leading-[0.95] text-lime-400">
          {t('app.title')}
        </div>
        {/* Balanced rather than the page's `pretty`: both are short, centred
            and set to a narrow measure, where Chrome's `pretty` stops trying
            after a few lines and left "interrupted." alone on the last one. */}
        <p className="mt-3 max-w-[28ch] text-[14px] leading-relaxed text-balance text-white/55">
          {t('app.tagline')}
        </p>
        <p className="mt-8 max-w-[30ch] text-[11.5px] leading-relaxed text-balance text-white/30">
          {t('ads.why')}
        </p>
      </div>

      <div className={`px-4 pb-[max(16px,env(safe-area-inset-bottom))] ${network ? 'invisible' : ''}`}>
        {canSkip ? (
          <Button variant="ghost" onClick={finish}>
            {t('ads.skip')}
          </Button>
        ) : (
          // Same footprint whether or not the skip is available, so the button
          // does not appear under a thumb that was already on its way down.
          <div className="flex h-[46px] items-center justify-center text-[11.5px] text-white/25">
            {left > 0 && plan.skipAt < plan.seconds
              ? t('ads.skipIn', { seconds: Math.max(0, plan.skipAt - watched) })
              : t('ads.holdOn')}
          </div>
        )}
      </div>
    </div>
  );
}
