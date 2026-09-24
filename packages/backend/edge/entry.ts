/**
 * Everything the career-submit edge function needs from the monorepo, bundled
 * into one ESM file so the Deno runtime needs no package resolution.
 */
export { replay } from '../../engine/src/index.js';
export { WORLD } from '../../content/src/index.js';
