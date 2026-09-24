import { useEffect, type ReactNode } from 'react';

/**
 * Primitives.
 *
 * `Screen` is the important one: it is a fixed-height flex column that never
 * scrolls. Anything that will not fit belongs in a sheet, not further down the
 * page — the player should never have to scroll to find the question they are
 * being asked.
 */

export function Screen({
  top,
  middle,
  bottom,
  side,
}: {
  top?: ReactNode;
  middle?: ReactNode;
  bottom: ReactNode;
  /**
   * The second column, on a computer only.
   *
   * A phone has one column and always will: status, what happened, the
   * decision under the thumb. A computer has width, and a game that ignores it
   * reads as a phone screenshot — so on a wide window the career table moves
   * out of the middle slot and stands beside the decision, which is how anyone
   * actually reads a career: the question on the left, the record on the right.
   *
   * Passed as a slot rather than rendered twice: the phone puts the same node
   * in the middle column, so there is one career table in the document at any
   * size and no chance of the two drifting apart.
   */
  side?: ReactNode;
}) {
  const column = (
    <div className="flex h-full w-full max-w-[480px] flex-col overflow-hidden">
      {top ? (
        <div className="shrink-0 px-4" style={{ paddingTop: 'calc(var(--safe-top) + 10px)' }}>
          {top}
        </div>
      ) : null}

      {/* Takes the slack, and clips rather than scrolls.

          When there is no top slot, the middle one is the top of the screen
          and has to keep clear of the status bar itself. The intro is the
          screen with no top slot, and it did not: its title is centred in
          this box, so the day iOS 26 shortened the window by a status bar's
          height the centre moved up and the title slid under the clock. The
          safe area is now reserved whatever the height turns out to be. */}
      {middle !== undefined ? (
        <div
          className="min-h-0 flex-1 overflow-hidden px-4 pt-3"
          style={top ? undefined : { paddingTop: 'calc(var(--safe-top) + 12px)' }}
        >
          {middle}
        </div>
      ) : null}

      <div
        className="shrink-0 px-4 pt-3"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 12px)' }}
      >
        {bottom}
      </div>
    </div>
  );

  /**
   * Only a screen that *has* a second column widens the frame.
   *
   * The intro, the identity picker and the summary are composed for one
   * column; widening the frame for them leaves the content in a 420px band
   * with 340px of nothing beside it, which is the exact fault the framed
   * layout was built to fix. The flag lives on the document element so the
   * frame — which is two components up — can read it without either of them
   * having to know about the other.
   */
  useEffect(() => {
    if (!side) return;
    document.documentElement.dataset.twoCol = 'true';
    return () => {
      delete document.documentElement.dataset.twoCol;
    };
  }, [side]);

  if (!side) return <div className="mx-auto flex h-full w-full max-w-[480px] flex-col overflow-hidden">{column}</div>;

  return (
    <div className="mx-auto flex h-full w-full justify-center overflow-hidden wide:gap-0">
      {column}
      {/* The record. Its own scroll region, because a twenty-season career is
          longer than a window and clipping it here would hide the thing the
          column exists to show. */}
      <aside data-record-column className="hidden min-h-0 w-[460px] shrink-0 flex-col overflow-hidden border-l border-white/10 pr-4 pl-4 wide:flex"
        style={{ paddingTop: 'calc(var(--safe-top) + 10px)', paddingBottom: 'calc(var(--safe-bottom) + 12px)' }}
      >
        {side}
      </aside>
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'quiet';
  /**
   * `sm` is for two buttons sharing a row. It is a prop rather than a
   * `text-[…]` in `className` because both would be arbitrary-value utilities
   * and which one wins depends on stylesheet order, not on the order they are
   * written — which is how "View summary" ended up three pixels too wide.
   */
  size?: 'md' | 'sm';
  disabled?: boolean;
  className?: string;
}) {
  const base =
    size === 'sm'
      ? 'display w-full min-h-[50px] rounded-xl px-2 text-[14px] font-bold uppercase tracking-wide transition-all duration-150 active:scale-[0.985] disabled:opacity-40'
      : 'display w-full min-h-[52px] rounded-xl px-5 text-[19px] font-bold uppercase tracking-wide transition-all duration-150 active:scale-[0.985] disabled:opacity-40';
  // `hover:` is already `@media (hover: hover)` in Tailwind, so none of this
  // latches on a phone after a tap — which is the whole reason these were
  // missing rather than an oversight. With a mouse, a button that does not
  // answer the pointer reads as disabled.
  const styles = {
    primary:
      'bg-lime-500 text-turf-950 shadow-[0_8px_24px_-8px_rgb(155_238_22/0.6)] active:bg-lime-400 hover:bg-lime-400 hover:shadow-[0_10px_30px_-8px_rgb(155_238_22/0.75)]',
    ghost: 'bg-white/[0.07] text-chalk border border-white/12 hover:bg-white/[0.12] hover:border-white/25',
    quiet: 'text-white/50 hover:text-white/80',
  }[variant];
  return (
    <button className={`${base} ${styles} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'positive' | 'negative' | 'gold';
}) {
  const tones = {
    neutral: 'bg-white/[0.08] text-white/70',
    positive: 'bg-gain/15 text-gain',
    negative: 'bg-loss/15 text-loss',
    gold: 'bg-gold/15 text-gold',
  }[tone];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-[3px] text-[11px] font-semibold leading-none ${tones}`}>
      {children}
    </span>
  );
}

export function Meter({
  value,
  max = 100,
  tone = 'lime',
  height = 4,
}: {
  value: number;
  max?: number;
  tone?: 'lime' | 'gold' | 'loss' | 'dim';
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const colors = { lime: 'bg-lime-500', gold: 'bg-gold', loss: 'bg-loss', dim: 'bg-white/40' }[tone];
  return (
    <div className="w-full overflow-hidden rounded-full bg-white/[0.09]" style={{ height }}>
      <div className={`h-full rounded-full ${colors} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Scoreboard-style figure: condensed number over a small caps label. */
export function StatCell({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  tone?: 'default' | 'accent' | 'gold';
}) {
  const color = { default: 'text-chalk', accent: 'text-lime-400', gold: 'text-gold' }[tone];
  return (
    <div className="min-w-0 text-center">
      <div className={`num text-[22px] font-bold leading-none ${color}`}>{value}</div>
      <div className="mt-1 truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-white/40">
        {label}
      </div>
    </div>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="display shrink-0 text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">
        {children}
      </span>
      <span className="rule flex-1" />
      {right}
    </div>
  );
}

export function Delta({ value }: { value: number }) {
  if (value === 0) return <span className="num text-white/30">—</span>;
  const up = value > 0;
  return (
    <span className={`num text-[13px] font-bold ${up ? 'text-gain' : 'text-loss'}`}>
      {up ? '▲' : '▼'}
      {Math.abs(value)}
    </span>
  );
}

/**
 * Bottom sheet for anything that does not fit the one-screen rule.
 *
 * `fixed` here means "the frame" on a desktop and "the window" on a phone,
 * without this component knowing either: `.app-frame` is a containing block for
 * fixed positioning on wide screens. So the sheet slides up from the bottom of
 * the game on both, rather than docking to the bottom of a 1080px browser
 * window a long way from the thing it belongs to. See `styles/app.css`.
 *
 * `data-sheet` is not decoration — the keyboard handler on the career screen
 * looks for it, so a number key pressed with a sheet open does not pick an
 * option hidden behind it.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  // Escape closes it. Costs nothing on a phone, and is the first thing anybody
  // on a keyboard tries.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div data-sheet className="fixed inset-0 z-50 flex flex-col justify-end">
      <button className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={onClose} aria-label="close" />
      <div
        className="animate-rise relative mx-auto w-full max-w-[480px] overflow-y-auto rounded-t-2xl border-t border-white/12 bg-turf-900 px-4 pt-4"
        style={{
          paddingBottom: 'calc(var(--safe-bottom) + 16px)',
          // Never taller than the space below the status bar, whatever height
          // the device reports for the window.
          maxHeight: 'min(86%, calc(100% - var(--safe-top) - 12px))',
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="display text-[17px] font-bold uppercase tracking-wide">{title}</span>
          <button
            onClick={onClose}
            className="rounded-lg bg-white/10 px-3 py-1 text-[13px] font-semibold transition-colors hover:bg-white/20"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
