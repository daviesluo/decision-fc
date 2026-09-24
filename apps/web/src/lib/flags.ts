/**
 * Nationality, as a flag where the device can draw one and as a code where it
 * cannot.
 *
 * Flags are built from regional-indicator pairs, which is the only portable way
 * to write them — but **Windows ships no flag glyphs at all**. Chrome and Edge
 * on desktop render 🇧🇷 as two letter-boxes reading "BR", and the England,
 * Scotland and Wales tag sequences as a bare black flag. That shows up on the
 * country picker, in the career table, on the summary, and inside the 1080×1920
 * share image — the one artefact of this game that gets posted somewhere else.
 *
 * Mobile is fine, which is where the players are, so the answer is not to drop
 * flags: it is to notice. One measurement at startup decides, and everything
 * asks `flagLabel`.
 */

/** Regional-indicator flag from an ISO code, with the home nations by hand. */
export function flagOf(iso: string, id: string): string {
  const special: Record<string, string> = {
    eng: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    sco: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    wal: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
    nir: '🏴󠁧󠁢󠁮󠁩󠁲󠁿',
  };
  if (special[id]) return special[id];
  if (iso.length !== 2) return '🏳️';
  return String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

let supported: boolean | null = null;

/**
 * Can this device actually draw a flag?
 *
 * Measured, not sniffed. A real flag glyph is one picture and therefore
 * narrower than the two letter-boxes a system without flags falls back to, so
 * comparing the width of 🇧🇷 against the width of "BR" answers it on any
 * platform without a list of user agents to keep up to date.
 */
export function flagsSupported(): boolean {
  if (supported !== null) return supported;
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return (supported = false);
    ctx.font = '16px sans-serif';
    const flag = ctx.measureText('\u{1F1E7}\u{1F1F7}').width;
    const letters = ctx.measureText('\u{1F1E7}').width + ctx.measureText('\u{1F1F7}').width;
    // Rendered as one glyph the pair is materially narrower than the two halves
    // drawn separately; rendered as fallback boxes the two are the same.
    supported = flag < letters * 0.9;
  } catch {
    supported = false;
  }
  return supported;
}

/**
 * What to actually put on screen: the flag, or a three-letter country code.
 *
 * The code is the same one the engine uses (`eng`, `bra`, `jpn`), uppercased,
 * which is what a football graphic would print anyway.
 */
export function flagLabel(iso: string, id: string): string {
  return flagsSupported() ? flagOf(iso, id) : id.toUpperCase();
}
