/**
 * The drawn icons — the intro screen's entry cards, and the settings button.
 *
 * Drawn rather than typed. A system emoji is a different picture on every
 * platform — 🗓️ is a torn-off desk pad on iOS, a flat grid on Android, and a
 * blue-and-white box on Windows — so the one thing a launch screen has to get
 * right, looking deliberate, is the one thing an emoji cannot promise. These
 * also take the interface's own lime accent, which no emoji will ever do.
 *
 * Both are sized in `em` so they scale with whatever text sits beside them, and
 * both use `currentColor` for their strokes so a card can tint them by state.
 */

/** Daily challenge: a calendar with today ringed. */
export function DailyIcon({ size = 18, active = true }: { size?: number; active?: boolean }) {
  const accent = active ? '#a3e635' : 'rgba(255,255,255,0.35)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      {/* The pad, and the two rings it hangs from. */}
      <rect x="3" y="5" width="18" height="16" rx="3" fill="rgba(255,255,255,0.06)" />
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="3"
        fill="none"
        stroke={accent}
        strokeWidth="1.6"
      />
      <path d="M3 10h18" stroke={accent} strokeWidth="1.6" />
      <path d="M8 3v4M16 3v4" stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
      {/* Today. */}
      <circle cx="12" cy="15.5" r="3" fill={accent} />
    </svg>
  );
}

/**
 * The three world rankings: three columns of a podium.
 *
 * Reads as a ranking at 18px, which a trophy does not — a trophy says "you won
 * something", and these boards are about *where you place*, which is a
 * different promise.
 */
export function RankingsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      {/* Second, first, third — the real order of a podium. */}
      <rect x="2.5" y="12" width="6" height="9" rx="1.2" fill="rgba(255,255,255,0.55)" />
      <rect x="9" y="7" width="6" height="14" rx="1.2" fill="#a3e635" />
      <rect x="15.5" y="15" width="6" height="6" rx="1.2" fill="rgba(255,255,255,0.38)" />
      {/* A marker on the top step, so it reads as a placing and not a bar chart. */}
      <circle cx="12" cy="3.6" r="2.1" fill="none" stroke="#a3e635" strokeWidth="1.6" />
    </svg>
  );
}

/**
 * Settings.
 *
 * The last system glyph in the interface, and it sat two rows under the two
 * icons above — a bare `⚙`, which is a different weight and a different shape
 * on every platform and a font-dependent one everywhere. Drawn to the same
 * rules as its neighbours: `currentColor`, so the button decides the tint, and
 * a stroke weight that matches them at 18px.
 */
/**
 * How to play: a question mark on a card, drawn on the same grid as the other
 * two rows so the three read as one list rather than three moods.
 */
export function HowToIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="text-lime-400">
      <rect x="4" y="3.5" width="16" height="17" rx="3" />
      <path d="M9.4 9.2a2.6 2.6 0 1 1 3.4 2.5c-.7.3-1 .9-1 1.6v.4" />
      <path d="M11.8 17.1h.01" />
    </svg>
  );
}

export function SettingsIcon({ size = 16 }: { size?: number }) {
  // Eight teeth, which is the fewest that still reads as a cog rather than a
  // flower once it is 16 pixels across.
  const teeth = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      {teeth.map((angle) => (
        <rect
          key={angle}
          x="10.9"
          y="1.6"
          width="2.2"
          height="4.4"
          rx="1"
          fill="currentColor"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="6.6" fill="none" stroke="currentColor" strokeWidth="2.1" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  );
}
