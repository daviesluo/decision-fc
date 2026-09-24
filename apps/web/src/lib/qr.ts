/**
 * The QR code on the share card, as a constant.
 *
 * The card is drawn on a canvas and a share image nobody can act on is a
 * missed door. The code ships in the bundle rather than being fetched as an
 * image, because a cross-origin image taints the canvas and `toBlob` then
 * throws. And no encoder runs in the page, because the URL never changes — so
 * the code is a constant, 25 × 25 modules of version 2, byte mode,
 * error-correction level M, mask 5.
 *
 * **It was generated and then read back.** Structural checks — three finder
 * rings, the timing rows — only prove the picture looks like a QR code. The
 * matrix below was decoded the way a scanner does (undo mask 5, walk the
 * zigzag, read the mode nibble, the length and the bytes) and it comes back as
 * exactly `https://decisionfc.com/`. A QR that does not scan is worse than no QR.
 *
 * To change the URL: regenerate the matrix with any QR encoder (one row of
 * modules per string, `1` for dark), decode it back before committing, and
 * update both the matrix and `QR_URL`.
 */

export const QR_URL = 'https://decisionfc.com/';

/** One string per row; `1` is a dark module. */
export const QR_MATRIX: readonly string[] = [
  '1111111001110110001111111',
  '1000001011111100001000001',
  '1011101011000010101011101',
  '1011101010110110101011101',
  '1011101000110100101011101',
  '1000001001000110001000001',
  '1111111010101010101111111',
  '0000000010111001100000000',
  '1000001011100110011001110',
  '1100100001001011000111110',
  '1000001110111101111001011',
  '0101010010101011111101001',
  '0010011101011000101100001',
  '1011000110000101100100010',
  '1001101010011111101111011',
  '1001010001110000110101101',
  '1011111111110110111110100',
  '0000000010001100100010000',
  '1111111000110100101010001',
  '1000001001001011100010010',
  '1011101001001101111110111',
  '1011101001100111011000011',
  '1011101000011111000001101',
  '1000001001110011100110001',
  '1111111011101110101001001',
];
