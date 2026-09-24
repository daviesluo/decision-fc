# Icon artwork

## `icon-source.jpeg` — the app icon

The picture the PWA icon set is built from: a football sitting where the
pitch markings fork. This folder is outside `public/`, so the source itself is
never shipped; only the icons built from it are.

Drop a square image here as `icon-source.png` or `icon-source.jpeg`, 1024px or
larger, then:

```bash
node tools/icons.mjs
```

That writes every size and both variants into `apps/web/public/icons/`. Do not
hand-edit those files — they are generated, and the next run overwrites them.

The tool measures any black frame the artwork arrives with rather than assuming
one, so art exported *as an app icon* (rounded corners over black) and art
exported as a plain square both work. It then produces two different crops,
because the platforms want different pictures:

- **`any`** — trimmed to full bleed. iOS and the desktop apply their own
  rounding, and a baked-in corner radius showing out from under the platform's
  mask looks worse than no rounding at all.
- **`maskable`** — cropped in further. Android crops to whatever shape the
  launcher wants and guarantees only the centre 80%, so the ball has to sit
  inside that circle.

Check the result at real sizes before committing — 512px is not the test, 48px
is.
