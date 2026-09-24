import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { setAdProvider } from './lib/ads';
import { adSenseProvider, hasAdNetwork, installAdSense } from './lib/ad-adsense';
import './styles/app.css';

// The ad tag loads once, at boot, so the first rewarded slot of a session does
// not pay for the script download. Off the live domain — localhost, a branch
// preview, the itch.io iframe — `hasAdNetwork()` is false, both calls are
// skipped, and the house creative plays instead: nobody is blocked from
// replaying and no ad script is fetched from a host outside the account.
if (hasAdNetwork()) {
  installAdSense();
  setAdProvider(adSenseProvider);
}

/**
 * The offline shell.
 *
 * Registered after the app has started rather than before, because it is not
 * on the critical path: the first visit is served from the network whatever
 * happens, and the worker exists for the *second* one. Production only, so a
 * dev server's hot reload is never sitting behind a cache, and never inside the
 * itch.io iframe, where the scope belongs to somebody else's host and an
 * install prompt is not a thing anyway.
 *
 * Failure is silent on purpose. A browser that refuses to register a worker —
 * private mode, an enterprise policy, an older engine — is a browser that plays
 * the game exactly as it did before this existed.
 */
if (import.meta.env.PROD && !__ITCH__ && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
