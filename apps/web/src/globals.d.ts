/**
 * Injected by Vite (`define` in vite.config.ts): a short hash of the bundled,
 * minified engine + content, i.e. of the rules a career replays against. See
 * `loadSave` in lib/game.ts for what it is for.
 */
declare const __ENGINE_BUILD__: string;

/**
 * True in the itch.io build only (`pnpm build:itch`). The game there runs in an
 * iframe on someone else's host, inside a directory it does not own, so the few
 * places that assume "we are the whole of decisionfc.com" have to stand down —
 * chiefly the language switch, which otherwise rewrites itch's address bar.
 */
declare const __ITCH__: boolean;
