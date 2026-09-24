import { useEffect, useRef, useState } from 'react';

/**
 * Count a number up to its new value instead of snapping to it.
 *
 * Every stat does this the moment a season resolves, and it is most of why
 * watching a season land feels like something happening rather than a table
 * being repainted. Cubic ease-out over 700ms.
 *
 * Honours reduced motion by jumping straight to the value — and so does the
 * first render, so a career loaded from a save does not count twenty seasons
 * up from zero.
 */
export function useCountUp(
  value: number,
  enabled = true,
  duration = 700,
  from?: number,
  /** Decimal places to hold on to — an average rating counts up as 6.68. */
  decimals = 0,
): number {
  const [display, setDisplay] = useState(from ?? value);
  const previous = useRef(from ?? value);
  const first = useRef(true);
  const origin = useRef(from);

  useEffect(() => {
    // `from` opts a value into animating on mount too — the summary's headline
    // totals count up from zero the first time they are seen.
    if (first.current && origin.current === undefined) {
      first.current = false;
      previous.current = value;
      setDisplay(value);
      return;
    }
    first.current = false;
    const began = previous.current;
    previous.current = value;
    if (!enabled || began === value) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const quantum = 10 ** decimals;
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round((began + (value - began) * eased) * quantum) / quantum);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, enabled, duration, decimals]);

  return display;
}
