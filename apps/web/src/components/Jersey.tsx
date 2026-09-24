import { useId } from 'react';
import { kitFor, type Kit } from '../lib/kits';

/**
 * The shirt on the identity screen, with the name and number the player is
 * choosing printed on the back.
 *
 * It wears the colours of the nationality he just picked. The first version was
 * one fixed lime green for everybody, which read as a referee's shirt rather
 * than a player's — and it meant the country choice showed up nowhere on
 * screen. Now picking Argentina gives you sky-blue stripes and picking Brazil
 * gives you yellow.
 *
 * The silhouette is a raglan-sleeved shirt hung flat, which is what a football
 * shirt actually looks like. The version before it was assembled from
 * hand-written curves and read as a vest — square across the shoulders, sleeves
 * stuck on at the side.
 *
 * ## The name has to fit
 *
 * Printed along a shallow arc, the way a real shirt printer lays it out, and
 * **sized to the arc** rather than squeezed into a fixed box. The old version
 * hard-condensed anything over seven characters into 52% of the shirt's width
 * with `textLength`, so "Fernández" came out as a smear — which is exactly the
 * "gets crowded as soon as the name is a bit long" complaint.
 *
 * Now the type shrinks until it fits and stops at a readable floor, so a long
 * Latin surname and a two-character Chinese one both land looking printed
 * rather than compressed. See `fitFontSize`.
 */
export function Jersey({
  name,
  number,
  countryId,
  width = 132,
}: {
  name: string;
  number: number;
  countryId: string;
  width?: number;
}) {
  const kit = kitFor(countryId);
  // Unique per instance: two shirts on one page must not share a pattern id.
  const uid = useId().replace(/:/g, '');
  const patternId = `kit-${uid}`;
  const nameCurveId = `name-${uid}`;

  const printed = name.trim().toUpperCase().slice(0, MAX_NAME_CHARS);
  const fontSize = fitFontSize(printed);

  return (
    <svg
      width={width}
      height={width}
      viewBox="0 0 1440 1440"
      className="shrink-0 drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)]"
      aria-hidden
    >
      <defs>
        <KitPattern id={patternId} kit={kit} />
        {/* The arc the surname is printed along, lifted slightly in the middle
            the way shirt printing follows the shoulders. */}
        <path id={nameCurveId} d="M 350 480 Q 720 380 1090 480" fill="transparent" />
      </defs>

      <path d={BODY} fill={kit.pattern === 'solid' ? kit.primary : `url(#${patternId})`} />

      {/* Folds and shadow — what stops it reading as a flat silhouette. */}
      <g fill="#000" opacity="0.15">
        <path d={SHADING} />
      </g>

      {/* Collar and cuffs in the trim colour, which is what makes it a kit. */}
      <path d={TRIM} fill={kit.secondary} />

      <text
        fill={kit.ink}
        fontFamily="BarlowCond, Arial Narrow, sans-serif"
        fontSize={fontSize}
        fontWeight="900"
        letterSpacing={fontSize * 0.05}
      >
        <textPath href={`#${nameCurveId}`} startOffset="50%" textAnchor="middle">
          {printed}
        </textPath>
      </text>

      <text
        x="720"
        y="840"
        fill={kit.ink}
        fontFamily="BarlowCond, Arial Narrow, sans-serif"
        fontSize="400"
        fontWeight="900"
        textAnchor="middle"
      >
        {number}
      </text>
    </svg>
  );
}

/**
 * Longer than any real surname, and only here so a pasted paragraph cannot
 * shrink the print to nothing.
 */
const MAX_NAME_CHARS = 22;

/**
 * Length of the printing arc, in viewBox units.
 *
 * The arc is `M 350 480 Q 720 380 1090 480`: a 740-unit chord bowed 50 units at
 * the middle, so a shade under 750 along the curve. Text on a `textPath` that
 * runs past the end of the path is **clipped, not shrunk** — which is how the
 * first attempt printed Schweinsteiger as "HWEINSTEIG".
 */
const NAME_ARC = 745;
/** Leave a little air at each end rather than printing to the last unit. */
const NAME_ARC_USABLE = NAME_ARC * 0.96;
const NAME_SIZE_MAX = 105;
/** Below this it stops being shirt printing and starts being fine print. */
const NAME_SIZE_MIN = 46;

/**
 * How wide one character is, as a multiple of the font size.
 *
 * **Measured, not guessed.** These come from `getComputedTextLength` on the
 * shipped face at weight 900: 0.65 for a long mixed surname, 0.69 for
 * FERNANDEZ, 0.83 for an all-M worst case, 1.0 for a Han glyph. The first
 * version of this estimated 0.47 from intuition, which is ~30% light, so the
 * fitter believed a fourteen-letter name fitted when it ran off both ends.
 *
 * 0.68 covers every real surname with the 4% margin above; the all-M case is
 * pathological and would merely touch the ends.
 */
function advanceOf(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  const wide =
    (code >= 0x3040 && code <= 0x30ff) || // kana
    (code >= 0x3400 && code <= 0x4dbf) || // CJK ext A
    (code >= 0x4e00 && code <= 0x9fff) || // CJK unified
    (code >= 0xac00 && code <= 0xd7af) || // hangul
    (code >= 0xf900 && code <= 0xfaff); // CJK compatibility
  if (wide) return 1;
  return char === ' ' ? 0.28 : 0.68;
}

/**
 * The largest size at which the name still fits the arc.
 *
 * Letter spacing is 5% of the size, so it scales with the type rather than
 * eating the whole budget at small sizes.
 */
export function fitFontSize(printed: string): number {
  if (printed.length === 0) return NAME_SIZE_MAX;
  let advances = 0;
  for (const char of printed) advances += advanceOf(char) + 0.05;
  const ideal = NAME_ARC_USABLE / advances;
  return Math.max(NAME_SIZE_MIN, Math.min(NAME_SIZE_MAX, ideal));
}

/**
 * The shirt itself: raglan sleeves sweeping out of the collar, a body that
 * narrows to the waist and flares again at the hem.
 */
const BODY =
  'M1200 390c-20-65-45-115-130-150s-190.86-80-310-80h-80c-119.14 0-225 45-310 80s-110 85-130 150-120 260-120 260 ' +
  '91.73 151.42 230 130c0 0 20-80 40-120 0 0 17.57 90.67 15 240-2.91 169.51-20 236.73-20 375 0 0 65 45 335 45s335-45 335-45' +
  'c0-138.27-17.08-205.49-20-375-2.57-149.33 15-240 15-240 20 40 40 120 40 120 138.27 21.42 230-130 230-130s-100-195-120-260';

/** Hem shadow, collar shadow, and the creases down each sleeve. */
const SHADING =
  'M720 1265c-170 0-280-40-280-40 60 50 160 70 280 70s220-20 280-70c0 0-110 40-280 40' +
  'M720 200c-68.75 0-144.14 10.21-200 40 0 0 105.17-15 200-15s200 15 200 15c-55.86-29.79-131.25-40-200-40' +
  'M1170 700c-5.79-36.48 6.16-101.7 20-150-27.77 22.52-54.25 76.29-70 110-16.91-65.57-14.47-183.63-20-240' +
  '-22.11 72.06-40.28 150.85-50 240 20 40 40 120 40 120 71.26 11.04 130.16-23.83 170.51-60.22-67.27-1.1-88.41-6.54-90.51-19.78' +
  'M860 1200c59.65-10.27 142.73-38.17 188.12-76.4-5.1-62.69-11.44-126.29-13.12-223.6-.77-44.6.26-83.96 2.08-117.24' +
  '-14.92 48.88-36.92 113.16-57.08 142.24-34.02 49.05-69.02 93.62-150 135 132.17-5.14 169.28-92.43 180-50 10.45 41.37-36.52 109.44-150 190' +
  'M391.88 1123.6c45.39 38.23 128.47 66.13 188.12 76.4-113.48-80.56-160.45-148.63-150-190 10.72-42.43 47.83 44.86 180 50' +
  '-80.98-41.38-115.98-85.95-150-135-20.16-29.08-42.16-93.36-57.08-142.24 1.82 33.28 2.85 72.64 2.08 117.24-1.67 97.31-8.02 160.91-13.12 223.6' +
  'M320 660c-15.75-33.71-42.23-87.48-70-110 13.84 48.3 25.79 113.52 20 150-2.1 13.24-23.24 18.68-90.51 19.78' +
  'C219.84 756.17 278.74 791.04 350 780c0 0 20-80 40-120-9.72-89.15-27.89-167.94-50-240-5.53 56.37-3.09 174.43-20 240';

/** The collar band and the two cuff bands. */
const TRIM =
  'M680 160h80c44.14 0 86.45 6.18 126.55 15.73-8.01-15.06-16.99-30.72-26.55-35.73-21.64-11.34-61.25-20-140-20' +
  's-118.36 8.66-140 20c-9.57 5.01-18.54 20.68-26.55 35.73C593.55 166.18 635.87 160 680 160' +
  'M139.43 611.54C127.78 634.83 120 650 120 650s91.73 151.42 230 130c0 0 4.42-17.69 11.19-40.59-82.3-6.5-148.23-39.82-221.75-127.87Z' +
  'M1300.57 611.54c-73.52 88.05-139.46 121.37-221.75 127.87 6.77 22.9 11.19 40.59 11.19 40.59 138.27 21.42 230-130 230-130s-7.78-15.17-19.43-38.46Z';

/** The famous kits are patterned, not plain; solid covers everyone else. */
function KitPattern({ id, kit }: { id: string; kit: Kit }) {
  const base = <rect width="1440" height="1440" fill={kit.primary} />;
  switch (kit.pattern) {
    case 'stripes':
      return (
        <pattern id={id} patternUnits="userSpaceOnUse" width="1440" height="1440">
          {base}
          {[110, 380, 650, 920, 1190].map((x) => (
            <rect key={x} x={x} y="0" width="140" height="1440" fill={kit.secondary} />
          ))}
        </pattern>
      );
    case 'hoops':
      return (
        <pattern id={id} patternUnits="userSpaceOnUse" width="1440" height="1440">
          {base}
          {[190, 520, 850, 1180].map((y) => (
            <rect key={y} x="0" y={y} width="1440" height="165" fill={kit.secondary} />
          ))}
        </pattern>
      );
    case 'sash':
      return (
        <pattern id={id} patternUnits="userSpaceOnUse" width="1440" height="1440">
          {base}
          <path fill={kit.secondary} d="M150 -240L310 -360L1290 1320L1130 1440Z" />
        </pattern>
      );
    case 'halves':
      return (
        <pattern id={id} patternUnits="userSpaceOnUse" width="1440" height="1440">
          {base}
          <rect x="720" y="0" width="720" height="1440" fill={kit.secondary} />
        </pattern>
      );
    case 'solid':
    default:
      return (
        <pattern id={id} patternUnits="userSpaceOnUse" width="1440" height="1440">
          {base}
        </pattern>
      );
  }
}
