/**
 * Club crests.
 *
 * Every club gets a distinctive, stable crest derived from its identity — a
 * shape, a field pattern, a device and a star count — which the renderer draws
 * as SVG. Clubs whose real badge is a well-known silhouette get a hand-set spec
 * below so the generated one at least rhymes with what people expect (Juventus
 * in black-and-white stripes, Barcelona quartered, Liverpool with a bird).
 *
 * This is the fallback. Real artwork wins wherever a club has it —
 * `Club.crestUrl`, then the club's file in the web app's `crests/` folder — so
 * adding or removing artwork is a content change and no code moves.
 */

import type { Club } from '../types.js';

export type CrestShape = 'shield' | 'round' | 'pointed' | 'banner';
export type CrestPattern =
  | 'solid'
  | 'stripes'
  | 'halves'
  | 'hoops'
  | 'sash'
  | 'quarters'
  | 'chevron';
export type CrestDevice = 'monogram' | 'ball' | 'star' | 'crown' | 'bird' | 'tower' | 'lion' | 'anchor';

export interface CrestSpec {
  shape: CrestShape;
  pattern: CrestPattern;
  device: CrestDevice;
  /** 0–3 stars above the device, scaling with reputation. */
  stars: number;
  /** Up to three characters drawn when `device` is `monogram`. */
  monogram: string;
}

const SHAPES: CrestShape[] = ['shield', 'round', 'pointed', 'banner'];
const PATTERNS: CrestPattern[] = ['solid', 'stripes', 'halves', 'hoops', 'sash', 'quarters', 'chevron'];
const DEVICES: CrestDevice[] = ['monogram', 'ball', 'star', 'crown', 'bird', 'tower', 'lion', 'anchor'];

/**
 * Hand-set specs for clubs whose visual identity is strongly fixed in people's
 * heads. The point is recognisability at a glance in a list of transfer offers,
 * not imitation of the real badge.
 */
const OVERRIDES: Record<string, Partial<CrestSpec>> = {
  juventus: { pattern: 'stripes', shape: 'shield', device: 'monogram' },
  'ac-milan': { pattern: 'stripes', shape: 'shield', device: 'monogram' },
  inter: { pattern: 'stripes', shape: 'round', device: 'monogram' },
  barcelona: { pattern: 'quarters', shape: 'pointed', device: 'monogram' },
  'real-madrid': { pattern: 'solid', shape: 'round', device: 'crown' },
  atletico: { pattern: 'stripes', shape: 'shield', device: 'bird' },
  liverpool: { pattern: 'solid', shape: 'shield', device: 'bird' },
  arsenal: { pattern: 'solid', shape: 'pointed', device: 'lion' },
  chelsea: { pattern: 'solid', shape: 'round', device: 'lion' },
  'man-city': { pattern: 'solid', shape: 'round', device: 'ball' },
  'man-utd': { pattern: 'solid', shape: 'shield', device: 'lion' },
  tottenham: { pattern: 'solid', shape: 'shield', device: 'bird' },
  newcastle: { pattern: 'stripes', shape: 'shield', device: 'monogram' },
  everton: { pattern: 'solid', shape: 'shield', device: 'tower' },
  bayern: { pattern: 'solid', shape: 'round', device: 'monogram' },
  dortmund: { pattern: 'solid', shape: 'round', device: 'monogram' },
  gladbach: { pattern: 'solid', shape: 'round', device: 'monogram' },
  psg: { pattern: 'sash', shape: 'round', device: 'tower' },
  marseille: { pattern: 'solid', shape: 'round', device: 'monogram' },
  ajax: { pattern: 'sash', shape: 'shield', device: 'monogram' },
  benfica: { pattern: 'solid', shape: 'round', device: 'bird' },
  porto: { pattern: 'halves', shape: 'shield', device: 'monogram' },
  sporting: { pattern: 'hoops', shape: 'shield', device: 'lion' },
  celtic: { pattern: 'hoops', shape: 'round', device: 'monogram' },
  rangers: { pattern: 'solid', shape: 'round', device: 'lion' },
  galatasaray: { pattern: 'halves', shape: 'round', device: 'lion' },
  fenerbahce: { pattern: 'stripes', shape: 'round', device: 'monogram' },
  'club-brugge': { pattern: 'stripes', shape: 'shield', device: 'monogram' },
  athletic: { pattern: 'stripes', shape: 'shield', device: 'lion' },
  sociedad: { pattern: 'stripes', shape: 'shield', device: 'monogram' },
  sevilla: { pattern: 'solid', shape: 'round', device: 'monogram' },
  betis: { pattern: 'stripes', shape: 'round', device: 'monogram' },
  napoli: { pattern: 'solid', shape: 'round', device: 'monogram' },
  roma: { pattern: 'solid', shape: 'shield', device: 'lion' },
  lazio: { pattern: 'solid', shape: 'round', device: 'bird' },
  'al-hilal': { pattern: 'solid', shape: 'round', device: 'crown' },
  'al-nassr': { pattern: 'solid', shape: 'round', device: 'star' },
  'al-ittihad': { pattern: 'stripes', shape: 'round', device: 'monogram' },
  'shanghai-p': { pattern: 'solid', shape: 'round', device: 'anchor' },
  'beijing-g': { pattern: 'solid', shape: 'round', device: 'tower' },
  'shanghai-s': { pattern: 'solid', shape: 'round', device: 'ball' },
  shandong: { pattern: 'solid', shape: 'shield', device: 'tower' },
  'inter-miami': { pattern: 'solid', shape: 'round', device: 'bird' },
  sunderland: { pattern: 'stripes', shape: 'shield', device: 'monogram' },
  wolves: { pattern: 'solid', shape: 'shield', device: 'lion' },
  brighton: { pattern: 'stripes', shape: 'shield', device: 'bird' },
  'crystal-p': { pattern: 'sash', shape: 'shield', device: 'bird' },
  'west-ham': { pattern: 'solid', shape: 'shield', device: 'tower' },
};

/** FNV-1a, so a club's crest never changes between sessions or builds. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Initials for the monogram. Skips the filler words that would otherwise make
 * half the database read "FC".
 */
function monogramOf(club: Club): string {
  const skip = new Set(['fc', 'ac', 'as', 'sc', 'cf', 'rc', 'sv', 'vfb', 'vfl', 'ss', 'us', 'de', 'of', 'and', '1.']);
  const words = club.name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !skip.has(w.toLowerCase()));
  const source = words.length > 0 ? words : [club.shortName];
  if (source.length === 1) return source[0]!.slice(0, 2).toUpperCase();
  return source
    .slice(0, 3)
    .map((w) => w[0]!)
    .join('')
    .toUpperCase();
}

/** Stars are a status signal: only the genuinely elite get three. */
function starsFor(reputation: number): number {
  if (reputation >= 92) return 3;
  if (reputation >= 82) return 2;
  if (reputation >= 68) return 1;
  return 0;
}

export function crestFor(club: Club): CrestSpec {
  const h = hash(club.id);
  const base: CrestSpec = {
    shape: SHAPES[h % SHAPES.length]!,
    pattern: PATTERNS[(h >>> 3) % PATTERNS.length]!,
    device: DEVICES[(h >>> 7) % DEVICES.length]!,
    stars: starsFor(club.reputation),
    monogram: monogramOf(club),
  };
  return { ...base, ...OVERRIDES[club.id] };
}
