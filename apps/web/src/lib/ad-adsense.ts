/**
 * The real ad network: Google's H5 Games Ads, via the Ad Placement API.
 *
 * This is the only product that serves *rewarded video* to a plain web page
 * with no native wrapper, which is what a PWA is. AdSense display units cannot
 * do it, and AdMob is native-only — so if the game is to earn from the web
 * build, it earns here.
 *
 * ## Turning it on
 *
 * 1. An AdSense account, with `decisionfc.com` added and **approved**. Approval
 *    needs the site live with real content; a domain with nothing on it is
 *    rejected.
 * 2. In AdSense, apply for **H5 Games Ads** (Ads → Overview → H5 Games).
 *    It is a separate opt-in from ordinary AdSense and it is the part that
 *    unlocks `adBreak`.
 *
 * That is the whole list, and the second point is the only one left. There is
 * deliberately **no build-time step**, because there used to be one and it is
 * why this file earned nothing for the first six weeks of the deployment: the
 * publisher id came from `VITE_ADSENSE_CLIENT`, no workflow ever set it, so
 * `hasAdNetwork()` was false in every build that has ever shipped, `adBreak`
 * was never defined, and the house creative played every single time. Nobody
 * noticed, because the fallback is silent by design.
 *
 * So the id is a constant here. It is not a secret — it is already in
 * `index.html`, in `/ads.txt`, and in the ad tag every visitor downloads — and
 * a public constant cannot be forgotten. The environment variable is still
 * read first, for the day a second account or a staging publisher needs one.
 *
 * What replaces the variable as the off switch is the **hostname**: the ad
 * script may only load on the live domain (serving it from anywhere else is a
 * policy violation), so off-domain — localhost, a branch preview, the itch.io
 * iframe — `hasAdNetwork()` is false and the house creative in `AdOverlay`
 * plays instead. Nothing breaks, nobody is blocked, and the ladder still runs.
 *
 * ## Mainland China
 *
 * Google is blocked, so this earns nothing there, and no amount of
 * configuration changes that. Roughly half the intended audience is on the
 * wrong side of that wall. The realistic answer is the WeChat mini-game build
 * on the roadmap, where `wx.createRewardedVideoAd` is the equivalent API and
 * 穿山甲 / 优量汇 are the networks — a second `AdProvider`, not a rewrite. The
 * seam in `ads.ts` exists for exactly this.
 */
import type { AdPlan, AdProvider } from './ads';

/**
 * The publisher id. Public by construction — see the header for why it is a
 * constant rather than a build-time variable.
 */
const DEFAULT_CLIENT = 'ca-pub-8335081072942378';
const CLIENT: string =
  (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined) ?? DEFAULT_CLIENT;

/**
 * The only hosts allowed to load the ad script.
 *
 * This is the same check `index.html` makes before it appends the tag, and it
 * has to be made twice: there, so the script is never fetched off-domain; here,
 * so the rest of the app knows whether a real video can arrive. Keep them
 * equal. Serving AdSense from a host outside the account is a policy
 * violation, and this check is what makes publishing the itch.io build safe.
 *
 * **`www` is on the list although it does not exist**, and that is the point.
 * There is no `www.decisionfc.com` record today — it does not resolve — but it
 * is one line in a Cloudflare dashboard away, and the day somebody adds it the
 * exact-match version of this check would have turned the ads off on that host
 * and said nothing. The list is deliberately two names and not a suffix test: a
 * future `staging.decisionfc.com` or a preview subdomain must *not* serve ads,
 * and `*.decisionfc.com` would hand them one.
 */
const AD_HOSTS = ['decisionfc.com', 'www.decisionfc.com'];

function onAdHost(): boolean {
  return typeof location !== 'undefined' && AD_HOSTS.includes(location.hostname);
}

/**
 * The Ad Placement API, as injected by the AdSense tag.
 *
 * `adBreak` takes a placement and calls back through it. `beforeReward` hands
 * back a `showAdFn` you must call to actually start the video — the two-step
 * exists so a game can put up its own "watch an ad?" prompt first. We have
 * already asked, so we call it immediately.
 */
interface AdBreakPlacement {
  type: 'reward';
  name: string;
  beforeReward: (showAdFn: () => void) => void;
  adDismissed?: () => void;
  adViewed?: () => void;
  adBreakDone?: (placementInfo: { breakStatus?: string }) => void;
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
    adBreak?: (placement: AdBreakPlacement) => void;
    adConfig?: (config: Record<string, unknown>) => void;
  }
}

let installed = false;

/** The tag `index.html` appends, if it is already there. */
function existingTag(): HTMLScriptElement | null {
  return document.querySelector<HTMLScriptElement>(
    'script[src*="adsbygoogle.js"][data-ad-client]',
  );
}

/**
 * Make sure the AdSense tag is on the page, exactly once.
 *
 * `index.html` appends it in `<head>` at parse time, which is earlier than any
 * bundle can manage and is why it lives there — the first rewarded slot of a
 * session should not pay for the script download. So the normal path through
 * this function finds that tag and does nothing but claim the queue.
 *
 * It still appends one if there is none, because the two call sites can drift:
 * a page that embeds the app without that head markup would otherwise have a
 * provider selected and no script to serve it. Two identical tags is the one
 * outcome to avoid — the Ad Placement API reads its configuration off the tag,
 * and a second one is at best a wasted request.
 *
 * Off-host it does nothing at all, and `hasAdNetwork()` has already told the
 * caller so.
 */
export function installAdSense(): void {
  if (installed || typeof document === 'undefined' || !onAdHost()) return;
  installed = true;

  if (!existingTag()) {
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(CLIENT)}`;
    // Required by the Ad Placement API, and it must be on the tag itself.
    script.dataset.adClient = CLIENT;
    script.dataset.adFrequencyHint = '30s';
    document.head.appendChild(script);
  }

  window.adsbygoogle = window.adsbygoogle ?? [];
}

/**
 * Whether a real network can serve here.
 *
 * Both halves matter: a publisher id (always, now) and the live hostname (only
 * in production). Used by the overlay to decide whether to keep its own
 * countdown visible — with a network, the video owns the screen and our timer
 * would be a second clock disagreeing with the first — and by `main.tsx` to
 * decide whether to select this provider at all.
 */
export function hasAdNetwork(): boolean {
  return Boolean(CLIENT) && onAdHost();
}

export const adSenseProvider: AdProvider = {
  id: 'adsense-h5',

  show(plan: AdPlan): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!hasAdNetwork() || typeof window.adBreak !== 'function') {
        reject(new Error('no ad network'));
        return;
      }

      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        // Resolving and rejecting both end in the replay — see `ads.ts`. The
        // distinction is only so a caller could log the difference.
        if (ok) resolve();
        else reject(new Error('ad not shown'));
      };

      try {
        window.adBreak({
          type: 'reward',
          // Named so the AdSense reports break down by which replay it was;
          // the fifth replay of a session is a different inventory question
          // from the first.
          name: `replay-${plan.replayIndex}`,
          beforeReward: (showAdFn) => showAdFn(),
          adViewed: () => done(true),
          adDismissed: () => done(true),
          adBreakDone: (info) => {
            // Anything other than a viewed/dismissed ad — no fill, a frequency
            // cap, an error, a blocker — lands here and must not cost a replay.
            if (!settled) done(info.breakStatus === 'viewed' || info.breakStatus === 'dismissed');
          },
        });
      } catch {
        done(false);
      }
    });
  },
};
