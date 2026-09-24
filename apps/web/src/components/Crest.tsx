import { useState } from 'react';
import { crestFor, type Club, type CrestSpec } from '@bg/engine';
import { asset } from '../lib/assets';

/**
 * Club crest.
 *
 * Resolution order:
 *
 *   1. `club.crestUrl`, if the content pack sets one.
 *   2. `crests/<club id>.png` under the build's base URL, if that file exists.
 *   3. A crest generated from the club's colours and identity.
 *
 * Step 2 is the drop-in path: put artwork in `apps/web/public/crests/` named by
 * club id and it appears, with no code change and no manifest to maintain. If
 * the file is missing the image errors and the generated badge takes over, so a
 * half-populated folder degrades cleanly instead of showing broken images.
 * See `docs/crests.md`.
 *
 * **Not because of a 404**, which is worth knowing before anybody writes a
 * check that looks for one. The site is served with Cloudflare's
 * single-page-application fallback, so a missing file comes back as **200
 * `text/html`** — the index page — and that reaches this `<img>` as a body it
 * cannot decode. `onError` fires either way, which is why the fallback works
 * and why a `fetch`-based existence check here would never see a failure.
 */
export function Crest({ club, size = 40 }: { club: Club; size?: number }) {
  // Failure is remembered per club id: React reuses this component across
  // clubs (season strip, option rows), and a plain boolean would keep showing
  // the generated badge for every club after one missing file.
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const source = club.crestUrl ?? asset(`crests/${club.id}.png`);

  if (failedFor !== club.id) {
    return (
      <img
        key={club.id}
        src={source}
        alt=""
        width={size}
        height={size}
        className="shrink-0 object-contain"
        loading="lazy"
        decoding="async"
        onError={() => setFailedFor(club.id)}
        style={{ width: size, height: size }}
      />
    );
  }
  return <GeneratedCrest club={club} size={size} spec={crestFor(club)} />;
}

function GeneratedCrest({ club, size, spec }: { club: Club; size: number; spec: CrestSpec }) {
  const [primary, secondary] = club.colors;
  const id = `crest-${club.id}`;
  const outline = isLight(primary) ? '#0b1a12' : '#ffffff';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="shrink-0"
      aria-hidden
      style={{ filter: 'drop-shadow(0 2px 4px rgb(0 0 0 / 0.45))' }}
    >
      <defs>
        <clipPath id={`${id}-clip`}>
          <ShapePath shape={spec.shape} />
        </clipPath>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.18" />
        </linearGradient>
      </defs>

      <g clipPath={`url(#${id}-clip)`}>
        <rect x="0" y="0" width="100" height="100" fill={primary} />
        <Field pattern={spec.pattern} secondary={secondary} />
        <rect x="0" y="0" width="100" height="100" fill={`url(#${id}-sheen)`} />
      </g>

      <ShapePath shape={spec.shape} fill="none" stroke={outline} strokeWidth={4} strokeOpacity={0.85} />

      <Device spec={spec} color={outline} />
      <Stars count={spec.stars} color={outline} />
    </svg>
  );
}

function ShapePath({
  shape,
  ...rest
}: { shape: CrestSpec['shape'] } & React.SVGProps<SVGPathElement & SVGCircleElement>) {
  switch (shape) {
    case 'round':
      return <circle cx="50" cy="50" r="46" {...(rest as React.SVGProps<SVGCircleElement>)} />;
    case 'pointed':
      // Classic pointed-base shield.
      return <path d="M50 4 L92 18 V52 Q92 82 50 96 Q8 82 8 52 V18 Z" {...(rest as React.SVGProps<SVGPathElement>)} />;
    case 'banner':
      // Flat-top, curved-base banner — the "scroll" silhouette.
      return <path d="M12 6 H88 V62 Q88 88 50 96 Q12 88 12 62 Z" {...(rest as React.SVGProps<SVGPathElement>)} />;
    case 'shield':
    default:
      return <path d="M50 3 L93 16 V50 Q93 80 50 97 Q7 80 7 50 V16 Z" {...(rest as React.SVGProps<SVGPathElement>)} />;
  }
}

/** The field pattern behind the device: stripes, halves, sash and so on. */
function Field({ pattern, secondary }: { pattern: CrestSpec['pattern']; secondary: string }) {
  switch (pattern) {
    case 'stripes':
      return (
        <>
          {[10, 34, 58, 82].map((x) => (
            <rect key={x} x={x} y="0" width="12" height="100" fill={secondary} />
          ))}
        </>
      );
    case 'halves':
      return <rect x="50" y="0" width="50" height="100" fill={secondary} />;
    case 'hoops':
      return (
        <>
          {[8, 34, 60, 86].map((y) => (
            <rect key={y} x="0" y={y} width="100" height="13" fill={secondary} />
          ))}
        </>
      );
    case 'sash':
      return <path d="M-10 78 L78 -10 L100 12 L12 100 Z" fill={secondary} />;
    case 'quarters':
      return (
        <>
          <rect x="50" y="0" width="50" height="50" fill={secondary} />
          <rect x="0" y="50" width="50" height="50" fill={secondary} />
        </>
      );
    case 'chevron':
      return <path d="M50 26 L100 66 V100 H0 V66 Z" fill={secondary} opacity={0.9} />;
    case 'solid':
    default:
      return null;
  }
}

/** The mark in the middle of the badge. */
function Device({ spec, color }: { spec: CrestSpec; color: string }) {
  const common = { fill: color, opacity: 0.92 };
  const cy = spec.stars > 0 ? 58 : 52;

  switch (spec.device) {
    case 'ball':
      return (
        <g {...common}>
          <circle cx="50" cy={cy} r="17" fill="none" stroke={color} strokeWidth={5} />
          <path d={`M50 ${cy - 10} l9 7 -3.5 11h-11L41 ${cy - 3} Z`} />
        </g>
      );
    case 'star':
      return <path d={starPath(50, cy, 18, 8)} {...common} />;
    case 'crown':
      return (
        <path
          d={`M28 ${cy + 10} L28 ${cy - 12} L39 ${cy - 2} L50 ${cy - 16} L61 ${cy - 2} L72 ${cy - 12} L72 ${cy + 10} Z`}
          {...common}
        />
      );
    case 'bird':
      return (
        <path
          d={`M50 ${cy - 16} q14 4 20 16 -10 -4 -16 -1 8 6 6 16 -6 -8 -12 -9 -6 1 -12 9 -2 -10 6 -16 -6 -3 -16 1 6 -12 20 -16 z`}
          {...common}
        />
      );
    case 'tower':
      return (
        <g {...common}>
          <path d={`M36 ${cy + 14} V${cy - 8} h6 v-6 h6 v6 h4 v-6 h6 v6 h6 V${cy + 14} Z`} />
        </g>
      );
    case 'lion':
      // Abstract rampant form — a silhouette, not a heraldic reproduction.
      return (
        <path
          d={`M36 ${cy + 15} q-2 -14 6 -20 -6 -6 0 -12 4 6 10 4 6 -6 14 -4 -4 6 0 10 8 5 6 22 -6 -6 -12 -4 -8 -2 -12 4 -5 -4 -12 0 z`}
          {...common}
        />
      );
    case 'anchor':
      return (
        <g stroke={color} strokeWidth={5} fill="none" opacity={0.92} strokeLinecap="round">
          <circle cx="50" cy={cy - 14} r="5" />
          <path d={`M50 ${cy - 9} V${cy + 15}`} />
          <path d={`M38 ${cy - 3} H62`} />
          <path d={`M33 ${cy + 4} q17 20 34 0`} />
        </g>
      );
    case 'monogram':
    default:
      return (
        <text
          x="50"
          y={cy + 9}
          textAnchor="middle"
          fill={color}
          fontFamily="BarlowCond, Arial Narrow, sans-serif"
          fontWeight={700}
          fontSize={spec.monogram.length > 2 ? 30 : 38}
          opacity={0.95}
        >
          {spec.monogram}
        </text>
      );
  }
}

/** Stars above the device — the honours marker on a real badge. */
function Stars({ count, color }: { count: number; color: string }) {
  if (count <= 0) return null;
  const spacing = 15;
  const startX = 50 - ((count - 1) * spacing) / 2;
  return (
    <g fill={color} opacity={0.9}>
      {Array.from({ length: count }, (_, i) => (
        <path key={i} d={starPath(startX + i * spacing, 25, 6.5, 3)} />
      ))}
    </g>
  );
}

function starPath(cx: number, cy: number, outer: number, inner: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${points.join(' L')} Z`;
}

/** Pick an outline that stays legible on the club's primary colour. */
function isLight(hex: string): boolean {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}
