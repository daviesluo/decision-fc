/**
 * International kit colours, for the shirt on the identity screen.
 *
 * Display-only, and deliberately not part of the engine's `Country`: a colour
 * can never change a computed result, and putting it in the content pack would
 * put it inside the save/replay contract for no gameplay reason. Same rule as
 * currency and locale.
 *
 * The shirt used to be one fixed lime green, which read as a referee's shirt
 * rather than a player's. Taking the colours from the nationality the player
 * just chose fixes that and makes the country picker mean something on screen.
 */
export type KitPattern = 'solid' | 'stripes' | 'hoops' | 'sash' | 'halves';

export interface Kit {
  /** Shirt body. */
  primary: string;
  /** Stripes, hoops, sash, collar and cuffs. */
  secondary: string;
  /** Name and number, chosen to stay legible on `primary`. */
  ink: string;
  pattern: KitPattern;
}

const KITS: Record<string, Kit> = {
  // UEFA
  eng: { primary: '#ffffff', secondary: '#c8102e', ink: '#111827', pattern: 'solid' },
  sco: { primary: '#12305e', secondary: '#ffffff', ink: '#ffffff', pattern: 'solid' },
  wal: { primary: '#c8102e', secondary: '#00b140', ink: '#ffffff', pattern: 'solid' },
  irl: { primary: '#169b62', secondary: '#ffffff', ink: '#ffffff', pattern: 'solid' },
  esp: { primary: '#c60b1e', secondary: '#ffc400', ink: '#ffffff', pattern: 'solid' },
  ita: { primary: '#0d47a1', secondary: '#ffffff', ink: '#ffffff', pattern: 'solid' },
  ger: { primary: '#ffffff', secondary: '#111111', ink: '#111827', pattern: 'solid' },
  fra: { primary: '#1e3a8a', secondary: '#ef4444', ink: '#ffffff', pattern: 'solid' },
  por: { primary: '#8f1d21', secondary: '#046a38', ink: '#ffffff', pattern: 'solid' },
  ned: { primary: '#f36c21', secondary: '#0f3d8a', ink: '#ffffff', pattern: 'solid' },
  bel: { primary: '#c8102e', secondary: '#111111', ink: '#ffffff', pattern: 'solid' },
  cro: { primary: '#ffffff', secondary: '#c8102e', ink: '#111827', pattern: 'stripes' },
  tur: { primary: '#c8102e', secondary: '#ffffff', ink: '#ffffff', pattern: 'solid' },
  den: { primary: '#c8102e', secondary: '#ffffff', ink: '#ffffff', pattern: 'solid' },
  swe: { primary: '#ffcd00', secondary: '#004b87', ink: '#0b1a2b', pattern: 'solid' },
  nor: { primary: '#c8102e', secondary: '#00205b', ink: '#ffffff', pattern: 'solid' },
  pol: { primary: '#ffffff', secondary: '#dc143c', ink: '#111827', pattern: 'solid' },
  ukr: { primary: '#ffd500', secondary: '#0057b8', ink: '#0b1a2b', pattern: 'solid' },
  srb: { primary: '#c8102e', secondary: '#ffffff', ink: '#ffffff', pattern: 'solid' },
  sui: { primary: '#d52b1e', secondary: '#ffffff', ink: '#ffffff', pattern: 'solid' },
  aut: { primary: '#c8102e', secondary: '#ffffff', ink: '#ffffff', pattern: 'solid' },
  cze: { primary: '#c8102e', secondary: '#11457e', ink: '#ffffff', pattern: 'solid' },
  slo: { primary: '#0b4ea2', secondary: '#ffffff', ink: '#ffffff', pattern: 'solid' },
  gre: { primary: '#ffffff', secondary: '#0d5eaf', ink: '#111827', pattern: 'solid' },
  rou: { primary: '#ffd200', secondary: '#002b7f', ink: '#0b1a2b', pattern: 'solid' },
  rus: { primary: '#c8102e', secondary: '#ffffff', ink: '#ffffff', pattern: 'solid' },

  // CONMEBOL
  arg: { primary: '#75aadb', secondary: '#ffffff', ink: '#0b1a2b', pattern: 'stripes' },
  bra: { primary: '#ffdf00', secondary: '#009739', ink: '#0b3b1e', pattern: 'solid' },
  uru: { primary: '#5cbcf6', secondary: '#111111', ink: '#0b1a2b', pattern: 'solid' },
  col: { primary: '#fcd116', secondary: '#003893', ink: '#0b1a2b', pattern: 'solid' },
  chi: { primary: '#c8102e', secondary: '#0033a0', ink: '#ffffff', pattern: 'solid' },
  ecu: { primary: '#ffdd00', secondary: '#0033a0', ink: '#0b1a2b', pattern: 'solid' },
  per: { primary: '#ffffff', secondary: '#d91023', ink: '#111827', pattern: 'sash' },
  par: { primary: '#c8102e', secondary: '#ffffff', ink: '#ffffff', pattern: 'stripes' },

  // AFC
  chn: { primary: '#c8102e', secondary: '#ffde00', ink: '#ffffff', pattern: 'solid' },
  jpn: { primary: '#0b1f66', secondary: '#ffffff', ink: '#ffffff', pattern: 'solid' },
  kor: { primary: '#c8102e', secondary: '#0047a0', ink: '#ffffff', pattern: 'solid' },
  ksa: { primary: '#ffffff', secondary: '#006c35', ink: '#0b3b1e', pattern: 'solid' },
  irn: { primary: '#ffffff', secondary: '#239f40', ink: '#111827', pattern: 'solid' },
  aus: { primary: '#ffcd00', secondary: '#046a38', ink: '#0b3b1e', pattern: 'solid' },
  qat: { primary: '#8a1538', secondary: '#ffffff', ink: '#ffffff', pattern: 'solid' },
  uae: { primary: '#ffffff', secondary: '#00732f', ink: '#111827', pattern: 'solid' },
  uzb: { primary: '#0099b5', secondary: '#ffffff', ink: '#ffffff', pattern: 'solid' },
  irq: { primary: '#127a3d', secondary: '#ffffff', ink: '#ffffff', pattern: 'solid' },
  tha: { primary: '#241d4f', secondary: '#ef3340', ink: '#ffffff', pattern: 'solid' },
  vie: { primary: '#da251d', secondary: '#ffcd00', ink: '#ffffff', pattern: 'solid' },

  // CAF
  mar: { primary: '#c1272d', secondary: '#006233', ink: '#ffffff', pattern: 'solid' },
  sen: { primary: '#ffffff', secondary: '#00853f', ink: '#111827', pattern: 'solid' },
  nga: { primary: '#008751', secondary: '#ffffff', ink: '#ffffff', pattern: 'solid' },
  egy: { primary: '#c8102e', secondary: '#ffffff', ink: '#ffffff', pattern: 'solid' },
  alg: { primary: '#ffffff', secondary: '#006233', ink: '#0b3b1e', pattern: 'solid' },
  civ: { primary: '#f77f00', secondary: '#ffffff', ink: '#ffffff', pattern: 'solid' },
  gha: { primary: '#ffffff', secondary: '#ce1126', ink: '#111827', pattern: 'solid' },
  cmr: { primary: '#008751', secondary: '#fcd116', ink: '#ffffff', pattern: 'solid' },
  tun: { primary: '#ffffff', secondary: '#e70013', ink: '#111827', pattern: 'solid' },
  rsa: { primary: '#ffcd00', secondary: '#007a4d', ink: '#0b3b1e', pattern: 'solid' },
  gui: { primary: '#ce1126', secondary: '#fcd116', ink: '#ffffff', pattern: 'solid' },

  // CONCACAF + OFC
  usa: { primary: '#ffffff', secondary: '#0a3161', ink: '#111827', pattern: 'solid' },
  mex: { primary: '#046a38', secondary: '#ffffff', ink: '#ffffff', pattern: 'solid' },
  can: { primary: '#c8102e', secondary: '#ffffff', ink: '#ffffff', pattern: 'solid' },
  crc: { primary: '#c8102e', secondary: '#002b7f', ink: '#ffffff', pattern: 'solid' },
  jam: { primary: '#ffb81c', secondary: '#111111', ink: '#0b1a2b', pattern: 'solid' },
  nzl: { primary: '#ffffff', secondary: '#111111', ink: '#111827', pattern: 'solid' },
};

const FALLBACK: Kit = { primary: '#e11d48', secondary: '#ffffff', ink: '#ffffff', pattern: 'solid' };

export function kitFor(countryId: string): Kit {
  return KITS[countryId] ?? FALLBACK;
}
