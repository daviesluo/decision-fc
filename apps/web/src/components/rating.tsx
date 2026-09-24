/**
 * Rating colours and stat icons — the small visual grammar the career table,
 * the summary and the share card all share.
 *
 * The colour bands carry the rating: it is read at a glance by its colour long
 * before the number registers, and the jump from silver to gold to that pale
 * ice-blue at 90 is a large part of why watching the table fill in feels like
 * progress.
 */

export interface RatingSkin {
  /** CSS gradient for the chip. */
  background: string;
  /** Text colour that survives on it. */
  ink: string;
  /** Border, for the large badge. */
  border: string;
}

export function ratingSkin(overall: number): RatingSkin {
  if (overall >= 99) {
    return {
      background: 'linear-gradient(145deg,#7c3aed 0%,#18181b 52%,#c026d3 100%)',
      ink: '#ffffff',
      border: 'rgba(232,121,249,0.55)',
    };
  }
  if (overall >= 95) {
    return {
      background: 'linear-gradient(145deg,#a855f7 0%,#c026d3 48%,#4338ca 100%)',
      ink: '#faf5ff',
      border: 'rgba(240,171,252,0.5)',
    };
  }
  if (overall >= 90) {
    return {
      background: 'linear-gradient(145deg,#cffafe 0%,#bae6fd 48%,#60a5fa 100%)',
      ink: '#082f49',
      border: 'rgba(3,105,161,0.4)',
    };
  }
  if (overall >= 80) {
    return {
      background: 'linear-gradient(145deg,#fcd34d 0%,#facc15 48%,#d97706 100%)',
      ink: '#451a03',
      border: 'rgba(146,64,14,0.42)',
    };
  }
  if (overall >= 70) {
    return {
      background: 'linear-gradient(145deg,#e2e8f0 0%,#cbd5e1 48%,#94a3b8 100%)',
      ink: '#0f172a',
      border: 'rgba(51,65,85,0.38)',
    };
  }
  return {
    background: 'linear-gradient(145deg,#d97706 0%,#b45309 48%,#78350f 100%)',
    ink: '#fef3c7',
    border: 'rgba(253,230,138,0.42)',
  };
}

/** The rating, in its band's colours. */
export function RatingChip({
  overall,
  size = 'sm',
  label,
}: {
  overall: number;
  size?: 'sm' | 'lg';
  label?: string;
}) {
  const skin = ratingSkin(overall);
  if (size === 'lg') {
    return (
      <div
        className="flex h-[58px] w-[58px] flex-col items-center justify-center rounded-2xl border"
        style={{ background: skin.background, color: skin.ink, borderColor: skin.border }}
      >
        {label ? (
          <span className="display text-[8px] font-bold uppercase tracking-[0.14em] opacity-60">{label}</span>
        ) : null}
        <span className="num text-[26px] font-bold leading-none">{overall}</span>
      </div>
    );
  }
  return (
    <span
      className="num inline-flex h-[18px] w-full items-center justify-center rounded-md text-[11px] font-bold leading-none"
      style={{ background: skin.background, color: skin.ink }}
    >
      {overall}
    </span>
  );
}

/**
 * A season's average match rating, on the usual ten-point scale and read the
 * usual way: 7.00 is a good season, 6.60 is a quiet one, anything under 6.30
 * was a struggle. Two decimals because the third place is where the difference
 * between a 6.7 season and a 6.8 season actually lives.
 */
export function matchRatingColor(rating: number): string {
  if (rating >= 7.4) return '#a3e635';
  if (rating >= 7.0) return '#bef264';
  if (rating >= 6.7) return '#e2e8f0';
  if (rating >= 6.4) return '#cbd5e1';
  return '#fca5a5';
}

export function MatchRating({ rating, className = '' }: { rating: number; className?: string }) {
  return (
    <span className={`num ${className}`} style={{ color: matchRatingColor(rating) }}>
      {rating.toFixed(2)}
    </span>
  );
}

/**
 * Stat icons: a small mark in front of every number, so a row reads without
 * its header. Drawn as SVG so they inherit `currentColor` and stay sharp at
 * 10px.
 */
export function AppsIcon({ size = 10 }: { size?: number }) {
  // A pitch seen from above — the mark for appearances.
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0" aria-hidden>
      <rect x="1" y="2.5" width="14" height="11" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 2.5V13.5" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="8" cy="8" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

export function GoalsIcon({ size = 10 }: { size?: number }) {
  // A ball: the classic pentagon-in-a-circle, legible even this small.
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0" aria-hidden>
      <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 4.2l2.6 1.9-1 3.1H6.4l-1-3.1z" fill="currentColor" />
    </svg>
  );
}

export function AssistsIcon({ size = 10 }: { size?: number }) {
  // A boot striking through — an assist is the pass, so the mark is the foot.
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0" aria-hidden>
      <path
        d="M2 4.2c0-.6.5-1 1.1-.9l2.2.3c.5.1.9.5 1 1l.4 2.1 4.6 1.6c1.4.5 2.3 1.5 2.5 2.8l.1.9c.1.6-.4 1.1-1 1.1H3.1c-.6 0-1.1-.5-1.1-1.1z"
        fill="currentColor"
      />
    </svg>
  );
}

export function CleanSheetIcon({ size = 10 }: { size?: number }) {
  // A goal frame with the net behind it.
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0" aria-hidden>
      <path d="M2 13V4h12v9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M5 13V4M8 13V4M11 13V4M2 7h12M2 10h12" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
    </svg>
  );
}

export function ConcededIcon({ size = 10 }: { size?: number }) {
  // A glove: the keeper's own column.
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0" aria-hidden>
      <path
        d="M3.4 6.2V3.6a1 1 0 0 1 2 0v2.2h.6V2.7a1 1 0 0 1 2 0v3.1h.6V3.3a1 1 0 0 1 2 0v2.5h.6V5a1 1 0 0 1 2 0v4.4c0 2.4-1.8 4.2-4.3 4.2H7.2C4.9 13.6 3 11.8 3 9.4z"
        fill="currentColor"
      />
    </svg>
  );
}
