/**
 * Builds the PWA icon set from one source image.
 *
 *   node tools/icons.mjs                 # uses apps/web/icon-source/icon-source.*
 *   node tools/icons.mjs path/to/art.png
 *
 * The source is a picture of a football sitting where the pitch markings fork.
 * A career is a road, every season hands you a fork, and the ball is what you
 * are choosing about.
 *
 * An earlier version of this file *drew* that scene in SVG — turf, sixteen
 * thousand procedural blades, a panelled ball, defocus, film grain. It got close
 * enough to prove the composition and nowhere near the realism the icon
 * wanted. Drawing a picture that detailed by hand in vectors is the wrong tool
 * for the brief, so the drawing code was retired.
 *
 * Two variants are required and they are not the same crop:
 *
 *   - **any**: iOS and the desktop apply their own rounding to whatever they
 *     are given, so this one is trimmed to full bleed. Artwork with its own
 *     rounded corners baked in would otherwise show black arcs poking out from
 *     under the platform's mask, which looks worse than no rounding at all.
 *   - **maskable**: Android crops to whatever shape the launcher wants —
 *     circle, squircle, teardrop — and only the centre 80% is guaranteed to
 *     survive. This one is cropped in further so the ball stays inside that safe
 *     circle and the crop takes its bite out of grass.
 *
 * Resizing runs through Chromium's canvas rather than a native image library,
 * for the same reason `shrink-images.mjs` does: Playwright is already a dev
 * dependency and adding sharp for an occasional asset pass is not worth the
 * install.
 */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'apps/web/public/icons');

/**
 * The icon artwork. Either extension is accepted because a picture arrives as
 * often a JPEG as a PNG, and renaming it by hand is the kind of step that gets
 * skipped and then debugged.
 */
const CANDIDATES = [
  'apps/web/icon-source/icon-source.png',
  'apps/web/icon-source/icon-source.jpeg',
  'apps/web/icon-source/icon-source.jpg',
];
const SOURCE =
  process.argv[2] ?? CANDIDATES.map((c) => path.join(ROOT, c)).find((c) => existsSync(c)) ?? path.join(ROOT, CANDIDATES[0]);

/**
 * How far in to crop, as a fraction of the side — and only ever to clear a
 * frame the artwork brought with it.
 *
 * Two mistakes are easy here and both were made:
 *
 * 1. Cropping a fixed amount regardless of the source. Artwork exported *as an
 *    app icon* arrives with rounded corners over black and needs the corner
 *    arcs cut away; artwork exported as a plain square is already full
 *    bleed and any crop just eats the composition. So the inset applies only
 *    when a frame was actually detected.
 *
 * 2. Cropping *in* for the maskable variant. Android guarantees only the centre
 *    80%, and the instinct is to "make it safe" by zooming — which does the
 *    exact opposite, because zooming makes the subject larger relative to the
 *    frame and pushes it further towards the crop. Safety comes from the
 *    subject being small in the frame, so maskable shows *at least* as much as
 *    the plain variant, never less.
 */
function insetFor(variant, framed) {
  if (!framed) return 0;
  return variant === 'any' ? 0.06 : 0.06;
}

const SIZES = [
  { file: 'icon-192.jpg', size: 192, variant: 'any' },
  { file: 'icon-512.jpg', size: 512, variant: 'any' },
  { file: 'icon-maskable-192.jpg', size: 192, variant: 'maskable' },
  { file: 'icon-maskable-512.jpg', size: 512, variant: 'maskable' },
  // iOS ignores the manifest and reads this one; beyond its own squircle it
  // applies no mask, so it takes the `any` crop.
  { file: 'apple-touch-icon.jpg', size: 180, variant: 'any' },
];

if (!existsSync(SOURCE)) {
  console.error(`\n  No source image at ${path.relative(ROOT, SOURCE)}\n`);
  console.error('  Drop the artwork there — a square PNG or JPEG, 768px or larger — and run');
  console.error('  this again, or pass a path:\n');
  console.error('      node tools/icons.mjs path/to/art.png\n');
  process.exit(1);
}

const mime = /\.jpe?g$/i.test(SOURCE) ? 'image/jpeg' : 'image/png';
const source = `data:${mime};base64,${(await readFile(SOURCE)).toString('base64')}`;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
});
const page = await browser.newPage();
await page.setContent('<body style="margin:0"></body>');

/**
 * Where the picture actually starts.
 *
 * Artwork exported as an app icon usually arrives with its own rounded corners
 * over a black surround. Cropping a fixed fraction would either leave that black
 * showing or eat into the picture, depending on the source — so the frame is
 * measured instead: walk in along the centre row and column until the pixels
 * stop being near-black, and treat that as the edge of the picture.
 */
const frame = await page.evaluate(async (src) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  const dark = (x, y) => {
    const i = (y * c.width + x) * 4;
    return data[i] + data[i + 1] + data[i + 2] < 60;
  };
  const midY = Math.floor(c.height / 2);
  const midX = Math.floor(c.width / 2);
  let left = 0;
  let right = c.width - 1;
  let top = 0;
  let bottom = c.height - 1;
  while (left < midX && dark(left, midY)) left += 1;
  while (right > midX && dark(right, midY)) right -= 1;
  while (top < midY && dark(midX, top)) top += 1;
  while (bottom > midY && dark(midX, bottom)) bottom -= 1;
  return { w: c.width, h: c.height, left, right, top, bottom };
}, source);

const framed = frame.left > 2 || frame.top > 2 || frame.w - 1 - frame.right > 2 || frame.h - 1 - frame.bottom > 2;
console.log(
  `\n  source ${path.relative(ROOT, SOURCE)} · ${frame.w}×${frame.h} · ` +
    (framed
      ? `black frame ${frame.left}/${frame.top}/${frame.w - 1 - frame.right}/${frame.h - 1 - frame.bottom}, cropping past it`
      : 'no frame, using it whole') +
    '\n',
);

for (const { file, size, variant } of SIZES) {
  const png = await page.evaluate(
    async ({ src, size, inset, frame }) => {
      const img = new Image();
      img.src = src;
      await img.decode();

      // Largest centred square inside the measured picture, then inset further
      // for the variant. Centred on the picture rather than on the file, so an
      // off-centre frame cannot drag the ball off centre.
      const cx = (frame.left + frame.right) / 2;
      const cy = (frame.top + frame.bottom) / 2;
      const side = Math.min(frame.right - frame.left, frame.bottom - frame.top);
      const crop = side * (1 - inset * 2);

      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, cx - crop / 2, cy - crop / 2, crop, crop, 0, 0, size, size);
      const url = c.toDataURL('image/jpeg', 0.9);
      return url.slice(url.indexOf(',') + 1);
    },
    { src: source, size, inset: insetFor(variant, framed), frame },
  );

  const bytes = Buffer.from(png, 'base64');
  await writeFile(path.join(OUT, file), bytes);
  console.log(
    `  ${file.padEnd(26)} ${size}×${size}  ${String(Math.round(bytes.length / 1024)).padStart(4)} KB  (${variant})`,
  );
}

await browser.close();
console.log(`\n  Wrote ${SIZES.length} files to apps/web/public/icons\n`);
