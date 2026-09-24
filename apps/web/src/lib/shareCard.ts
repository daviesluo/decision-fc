/**
 * The shareable career card, drawn on a canvas.
 *
 * Deliberately canvas rather than a DOM-to-image library: the whole app has
 * three runtime dependencies (react, react-dom, and the two workspace
 * packages) and a screenshot library would be the largest thing in the bundle
 * for one button. Canvas also has no foreignObject/CSS-support surprises, and
 * every image it draws is same-origin (`/crests`, `/trophies`), so the result
 * is never tainted and `toBlob` always works.
 *
 * 1080×1920 — a portrait story frame, which is where these get posted.
 */


const W = 1080;
const H = 1920;

export interface ShareCardData {
  endingTitle: string;
  /** Already-localised, e.g. "19 Seasons". */
  seasons: string;
  lastName: string;
  shirtNumber: number;
  position: string;
  countryName: string;
  flag: string;
  peakOverall: number;
  clubName: string | null;
  clubCrestUrl: string | null;
  totals: { apps: number; goals: number; assists: number; trophies: number };
  totalsLabels: { apps: string; goals: string; assists: string; trophies: string };
  boards: { label: string; value: string; percentile: string }[];
  /** Trophy/award artwork, most prestigious first, with how many were won. */
  art: { src: string; count: number }[];
  /** The international record, when there is one. */
  national: { flag: string; name: string; caps: number; goals: number } | null;
  rows: {
    age: number;
    club: string;
    crestUrl: string | null;
    accent: string;
    overall: number;
    apps: number;
    goals: number;
    assists: number;
  }[];
  footer: string;
}

/** Rating band colours, matching `components/rating.tsx`. */
function ratingColours(overall: number): { fill: string[]; ink: string } {
  if (overall >= 99) return { fill: ['#7c3aed', '#18181b', '#c026d3'], ink: '#ffffff' };
  if (overall >= 95) return { fill: ['#a855f7', '#c026d3', '#4338ca'], ink: '#faf5ff' };
  if (overall >= 90) return { fill: ['#cffafe', '#bae6fd', '#60a5fa'], ink: '#082f49' };
  if (overall >= 80) return { fill: ['#fcd34d', '#facc15', '#d97706'], ink: '#451a03' };
  if (overall >= 70) return { fill: ['#e2e8f0', '#cbd5e1', '#94a3b8'], ink: '#0f172a' };
  return { fill: ['#d97706', '#b45309', '#78350f'], ink: '#fef3c7' };
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw `text`, shrinking the font until it fits `maxWidth`. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  weight = 700,
  family = 'BarlowCond, "Arial Narrow", sans-serif',
): void {
  let current = size;
  ctx.font = `${weight} ${current}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && current > 8) {
    current -= 1;
    ctx.font = `${weight} ${current}px ${family}`;
  }
  ctx.fillText(text, x, y);
}

export async function renderShareCard(data: ShareCardData): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const sans = '"Inter", system-ui, sans-serif';
  const cond = 'BarlowCond, "Arial Narrow", sans-serif';

  // ---- background ---------------------------------------------------------
  ctx.fillStyle = '#08130d';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W);
  glow.addColorStop(0, 'rgba(155,238,22,0.22)');
  glow.addColorStop(1, 'rgba(155,238,22,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H * 0.6);

  const M = 56;
  let y = 96;

  // ---- ending headline ----------------------------------------------------
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = `700 26px ${sans}`;
  ctx.fillText(`${data.seasons} · ${data.footer}`.toUpperCase(), M, y);
  y += 62;
  ctx.fillStyle = '#b8ff3c';
  fitText(ctx, data.endingTitle.toUpperCase(), M, y, W - M * 2, 76);
  y += 44;

  // ---- identity card ------------------------------------------------------
  const cardH = 190;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  roundRect(ctx, M, y, W - M * 2, cardH, 28);
  ctx.fill();

  const skin = ratingColours(data.peakOverall);
  const badge = ctx.createLinearGradient(M + 28, y + 28, M + 168, y + 168);
  badge.addColorStop(0, skin.fill[0]!);
  badge.addColorStop(0.5, skin.fill[1]!);
  badge.addColorStop(1, skin.fill[2]!);
  ctx.fillStyle = badge;
  roundRect(ctx, M + 28, y + 28, 134, 134, 26);
  ctx.fill();
  ctx.fillStyle = skin.ink;
  ctx.textAlign = 'center';
  ctx.font = `700 22px ${sans}`;
  ctx.globalAlpha = 0.6;
  ctx.fillText('OVR', M + 95, y + 74);
  ctx.globalAlpha = 1;
  ctx.font = `700 76px ${cond}`;
  ctx.fillText(String(data.peakOverall), M + 95, y + 142);
  ctx.textAlign = 'left';

  const textX = M + 190;
  // An empty `lastName` means the sharer chose to keep it off the card. Rather
  // than leaving the gap where it was — which reads as a rendering fault — the
  // identity line takes the whole block and sets larger, so the card still has
  // a subject.
  const named = data.lastName.trim().length > 0;
  const identity = `${data.flag} ${data.countryName}  ·  #${data.shirtNumber} ${data.position}`;
  if (named) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `600 27px ${sans}`;
    ctx.fillText(identity, textX, y + 74);
    ctx.fillStyle = '#ffffff';
    fitText(ctx, data.lastName.toUpperCase(), textX, y + 140, W - M * 2 - 220, 64);
  } else {
    ctx.fillStyle = '#ffffff';
    fitText(ctx, identity, textX, y + 116, W - M * 2 - 220, 40);
  }
  y += cardH + 30;

  // ---- career table -------------------------------------------------------
  const crestCache = new Map<string, HTMLImageElement | null>();
  const crestSources = new Set(
    [...data.rows.map((r) => r.crestUrl), data.clubCrestUrl].filter((s): s is string => !!s),
  );
  await Promise.all(
    [...crestSources].map(async (src) => crestCache.set(src, await loadImage(src))),
  );

  // Fit however many seasons there are into the space left above the totals.
  const tableTop = y;
  const tableBottom = H - 620 - (data.national ? 58 : 0);
  const rowH = Math.min(52, Math.max(30, (tableBottom - tableTop) / Math.max(1, data.rows.length)));
  ctx.font = `700 22px ${sans}`;
  for (const [i, row] of data.rows.entries()) {
    const top = tableTop + i * rowH;
    if (top + rowH > tableBottom) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText(`+${data.rows.length - i}`, M, top + rowH * 0.7);
      break;
    }
    const stripe = ctx.createLinearGradient(M, 0, W - M, 0);
    stripe.addColorStop(0, `${row.accent}26`);
    stripe.addColorStop(0.7, 'rgba(0,0,0,0)');
    ctx.fillStyle = stripe;
    roundRect(ctx, M, top, W - M * 2, rowH - 4, 8);
    ctx.fill();

    const mid = top + (rowH - 4) / 2;
    // Age chip.
    ctx.fillStyle = row.accent;
    roundRect(ctx, M + 6, top + 4, 52, rowH - 12, 8);
    ctx.fill();
    ctx.fillStyle = contrastInk(row.accent);
    ctx.textAlign = 'center';
    ctx.font = `700 24px ${cond}`;
    ctx.fillText(String(row.age), M + 32, mid + 8);

    // Crest + club.
    ctx.textAlign = 'left';
    const crest = row.crestUrl ? crestCache.get(row.crestUrl) : null;
    if (crest) ctx.drawImage(crest, M + 70, top + 5, rowH - 14, rowH - 14);
    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    ctx.font = `600 25px ${sans}`;
    fitText(ctx, row.club, M + 76 + rowH, mid + 8, 330, 25, 600, sans);

    // Rating chip.
    const rowSkin = ratingColours(row.overall);
    const chip = ctx.createLinearGradient(0, top, 0, top + rowH);
    chip.addColorStop(0, rowSkin.fill[0]!);
    chip.addColorStop(1, rowSkin.fill[2]!);
    ctx.fillStyle = chip;
    roundRect(ctx, W - M - 320, top + 6, 64, rowH - 16, 8);
    ctx.fill();
    ctx.fillStyle = rowSkin.ink;
    ctx.textAlign = 'center';
    ctx.font = `700 24px ${cond}`;
    ctx.fillText(String(row.overall), W - M - 288, mid + 8);

    // The three numbers.
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `600 24px ${sans}`;
    ctx.fillText(String(row.apps), W - M - 208, mid + 8);
    ctx.fillText(String(row.goals), W - M - 128, mid + 8);
    ctx.fillText(String(row.assists), W - M - 48, mid + 8);
    ctx.textAlign = 'left';
  }

  // ---- the international row ---------------------------------------------
  if (data.national) {
    const top = Math.min(tableTop + data.rows.length * rowH, tableBottom) + 8;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(ctx, M, top, W - M * 2, 46, 10);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    ctx.font = `600 26px ${sans}`;
    ctx.fillText(`${data.national.flag}  ${data.national.name}`, M + 18, top + 32);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(String(data.national.caps), W - M - 208, top + 32);
    ctx.fillText(String(data.national.goals), W - M - 128, top + 32);
    ctx.textAlign = 'left';
  }

  // ---- totals -------------------------------------------------------------
  y = H - 592;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  roundRect(ctx, M, y, W - M * 2, 150, 24);
  ctx.fill();
  const totals: [string, number][] = [
    [data.totalsLabels.apps, data.totals.apps],
    [data.totalsLabels.goals, data.totals.goals],
    [data.totalsLabels.assists, data.totals.assists],
    [data.totalsLabels.trophies, data.totals.trophies],
  ];
  const colW = (W - M * 2) / 4;
  ctx.textAlign = 'center';
  totals.forEach(([label, value], i) => {
    const cx = M + colW * i + colW / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `700 22px ${sans}`;
    ctx.fillText(label.toUpperCase(), cx, y + 52);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 58px ${cond}`;
    ctx.fillText(String(value), cx, y + 116);
  });
  y += 176;

  // ---- silverware ---------------------------------------------------------
  const shown = data.art.slice(0, 8);
  const artImages = (await Promise.all(shown.map((a) => loadImage(a.src)))).map((image, i) => ({
    image,
    count: shown[i]!.count,
  }));
  const drawable = artImages.filter((a): a is { image: HTMLImageElement; count: number } => a.image !== null);
  if (drawable.length > 0) {
    const size = Math.min(128, (W - M * 2) / drawable.length - 8);
    const totalW = drawable.length * size + (drawable.length - 1) * 8;
    let x = (W - totalW) / 2;
    for (const { image, count } of drawable) {
      /*
       * Fit, do not stretch. Every trophy was being drawn into a square box
       * whatever shape it actually was, and trophies are taller than they are
       * wide — so the European Cup came out squat and the medals came out oval.
       * Scale by the longer side and centre what is left over, which is what a
       * shelf looks like: different objects, same height of space.
       */
      const ratio = image.naturalWidth > 0 ? image.naturalWidth / image.naturalHeight : 1;
      const drawH = ratio >= 1 ? size / ratio : size;
      const drawW = ratio >= 1 ? size : size * ratio;
      ctx.drawImage(image, x + (size - drawW) / 2, y + (size - drawH), drawW, drawH);
      if (count > 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        roundRect(ctx, x + size - 40, y + size - 30, 44, 30, 15);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = `700 21px ${sans}`;
        ctx.fillText(`×${count}`, x + size - 18, y + size - 9);
        ctx.textAlign = 'left';
      }
      x += size + 8;
    }
    y += size + 26;
  }

  // ---- the ranks ----------------------------------------------------------
  const boardW = (W - M * 2 - 24) / 3;
  data.boards.slice(0, 3).forEach((board, i) => {
    const x = M + (boardW + 12) * i;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(ctx, x, y, boardW, 128, 20);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `700 20px ${sans}`;
    ctx.fillText(board.label.toUpperCase(), x + boardW / 2, y + 38);
    ctx.fillStyle = '#ffffff';
    fitText(ctx, board.value, x + boardW / 2, y + 84, boardW - 24, 42, 700, cond);
    ctx.fillStyle = '#facc15';
    ctx.font = `700 22px ${sans}`;
    ctx.fillText(board.percentile, x + boardW / 2, y + 114);
  });
  y += 128;

  // ---- footer ------------------------------------------------------------
  /*
   * One centred line. It carried a QR for the site, which was removed:
   * the address is written here in words, and a code on top of it was a second
   * way of saying the same thing occupying a corner of the card. `lib/qr.ts`
   * is kept — the matrix is verified and expensive to re-derive — so putting
   * it back is an import and six lines.
   */
  y += 40;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `700 26px ${sans}`;
  ctx.fillText(data.footer, W / 2, Math.min(H - 60, y));
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.font = `700 22px ${sans}`;
  ctx.fillText('decisionfc.com', W / 2, Math.min(H - 26, y + 34));

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}

function contrastInk(hex: string): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#0b1a12' : '#ffffff';
}
