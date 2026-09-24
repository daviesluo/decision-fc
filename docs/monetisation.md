# Monetisation: how this actually earns

The model is rewarded video on **play again**, and nothing else is gated. The
policy — the free first replay, the 5/10/15/20/30 ladder, the daily reset, the
skip at halfway, the reward that is never withheld — lives in
`apps/web/src/lib/ads.ts` and is the same on every platform.

What changes per platform is only **who supplies the video**. That is the
`AdProvider` interface, and adding a platform is one implementation of it, not a
change to the game.

```ts
export interface AdProvider {
  readonly id: string;
  show(plan: AdPlan): Promise<void>;
}
```

---

## 1. Mobile web — live path, do this first

This covers **both** the ordinary browser page and the installed PWA. They are
the same build and the same page; installing it changes nothing about ads.

**Product: Google AdSense → H5 Games Ads (the Ad Placement API).**

This is the only product that serves *rewarded video* to a plain web page with
no native wrapper. Ordinary AdSense display units cannot do it. AdMob is
native-only. So for the web build, this is the one.

Implemented in `apps/web/src/lib/ad-adsense.ts`. To switch it on:

1. **Get an AdSense account** and add `decisionfc.com` as a site.
2. **Get approved.** Approval needs the site live with real content and some
   traffic — a domain with a placeholder on it is rejected. The game being live
   and playable is what satisfies this, so ship first, apply second.
3. **Apply for H5 Games Ads** (AdSense → Ads → Overview → H5 Games). This is a
   *separate opt-in* from ordinary AdSense and it is the part that unlocks
   `adBreak`. Without it the tag loads and no rewarded slot ever fills.

**There used to be a fourth step, and deleting it is the point.** The publisher
id came from `VITE_ADSENSE_CLIENT`, set "in the build environment". No workflow
ever set it. So `hasAdNetwork()` was false in every build that has ever shipped,
`window.adBreak` was never defined, the house creative played every single time,
and the game earned nothing for the first six weeks it was live — while this
document said the setup was complete but for an approval. The fallback is silent
by design, which is why nobody noticed.

The id is now a constant in `ad-adsense.ts`. It is not a secret: it is in
`index.html`, in `/ads.txt`, and in the tag every visitor downloads. What
decides whether the ad script loads is the **hostname** — only
`decisionfc.com`, never localhost, never a branch preview, never the itch.io
iframe — so off-domain the house creative plays and nothing is fetched from a
host outside the account. The environment variable is still read first, for the
day a second publisher id needs one.

### Verifying the site, which is a different thing from approval

AdSense asks for two separate things and they are easy to confuse. **Ownership**
is proved one of three ways — the code snippet, the `ads.txt` line, or a meta
tag. **The policy review** is what comes after, and it is what was declined
once before.

This site satisfies two of the three ownership methods as static, crawlable
text, on every page:

- `/ads.txt` carries `google.com, pub-8335081072942378, DIRECT, f08c47fec0942fa0`,
  which is Google's template filled in. Extra lines for other networks are
  expected and harmless.
- `<meta name="google-adsense-account" content="ca-pub-8335081072942378">` is in
  the `<head>` of the game, both language copies, the three static pages and
  every generated content page. Note the prefix: the meta tag wants `ca-pub-`,
  `ads.txt` wants `pub-`. Google introduced this method precisely for sites that
  do not want ads on the homepage, which is this one — auto ads are off and the
  only ad is the rewarded replay.

The **code snippet** method is the one this site does not satisfy in the way
Google's wording implies, and the reason is the hostname check: the tag is
appended by JavaScript, so it is not in the served HTML source. Google's
documentation says "paste the code into the HTML" and "view the page source",
and it says **nothing at all** about whether a script injected at runtime
counts. Do not rely on it.

If a review is ever returned as *not ready — ad code not found*, the escalation
is a build-time gate instead of a runtime one: emit the real `<script>` tag into
`<head>` for the production build only, and strip it from the preview and itch
builds the way `build-itch.mjs` already strips the loader. That trades a runtime
guarantee for a build-time one, which is a decision to take deliberately, not
as a reflex — which is why it is written here rather than done.

### What it pays

Rewarded video is the highest-CPM web format there is, but the honest range is
wide: roughly **$3–15 eCPM** in US/UK/EU traffic, **under $1** in most of Asia
and Latin America. At one rewarded impression per replay, revenue is
`replays × fill rate × eCPM ÷ 1000`. The lever that matters most is not the ad
setup, it is how many careers a returning player runs.

### Mainland China

**Google is blocked, so this earns nothing there.** No configuration changes
that, and roughly half the intended audience is on the wrong side of it. The
answer for that audience is §4, not a different web ad network — the domestic
web ad networks want an ICP licence and a domestic host, which is a much larger
commitment than a mini-program.

---

## 2. iOS App Store and Google Play

The same web app in a native shell, which is a **Capacitor** wrapper — the
engine and UI do not change.

**Product: Google AdMob rewarded video**, via `@capacitor-community/admob`.

1. Wrap: `npm i @capacitor/core @capacitor/cli`, `npx cap init`,
   `npx cap add ios android`. The Vite build output is the web asset directory.
2. AdMob account → create an app for each store → create a **Rewarded** ad unit
   per platform.
3. Implement `AdProvider` against the plugin: `AdMob.prepareRewardVideoAd` then
   `AdMob.showRewardVideoAd`, resolving on the reward callback and rejecting on
   failure. Register it in `main.tsx` behind a platform check.

**Store rules worth knowing before building this.** Apple rejects apps that are
just a website in a shell (Guideline 4.2, "minimum functionality"). A career
simulator with offline play, home-screen state and native share is generally
fine, but the app must work without a network connection — which this one
already does, since the engine is local and only the leaderboard needs a server.
Both stores also require an age rating and a privacy declaration covering the ad
SDK's identifiers, and iOS needs an App Tracking Transparency prompt if the ads
are personalised.

AdMob eCPMs run higher than web, typically **$5–25** rewarded in tier-one
markets.

---

## 3. WeChat Mini Game — the answer for mainland China

**Product: WeChat's own rewarded video**, `wx.createRewardedVideoAd`.

The API is a close match for the interface we already have: create the ad,
`load()`, `show()`, and a `close` callback that reports `isEnded`. One more
`AdProvider`.

The work is not the ads, it is the build target: a mini *game* uses a canvas
runtime rather than the DOM, so the React UI has to be rebuilt or run through an
adapter (Taro, or the mini-game DOM shims). **`packages/engine` is untouched by
this** — that is what its purity was for.

Requirements: a registered WeChat account of the right type (a mini *game*
account, not a mini *program* account — they are different registrations), and
for a game category, a Chinese publishing licence (版号) is required for anything
with in-game purchases. Ad-only monetisation has historically been more
permissive here, but confirm the current rules before committing: this is the
single largest unknown in the plan.

---

## 4. Order of work, and what each is worth

| Step | Effort | When it earns |
|---|---|---|
| Ship on `decisionfc.com`, apply for AdSense + H5 Games | days | Immediately after approval |
| Capacitor wrapper + AdMob for Play | ~1 week | Higher CPM, slower approval |
| The same for the App Store | ~1 week | Highest CPM, strictest review |
| WeChat mini game | weeks | The only route to the Chinese half of the audience |

Start with the web. It is live, it is the cheapest to change, and it is the only
one where a bad decision costs a redeploy instead of a review cycle.

---

## 5. Rules the policy will not break

These are in `ads.ts`, and changing any of them is a product decision rather
than a tuning pass, because
each one is somebody's decision to stop playing:

- **Nothing interrupts a career in progress.** No ad between seasons, none on a
  decision card.
- **Quitting is never gated.** Somebody walking away from a career they are not
  enjoying is the last person to sell an ad to.
- **The first replay each day is free.**
- **The reward is never withheld.** Network down, no fill, ad blocker, provider
  throws — the replay is granted anyway.
- **Every ad past the five-second floor is skippable at halfway**, and skipping
  still grants the replay.
