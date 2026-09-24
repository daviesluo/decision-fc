#!/bin/sh
# Every gate CI runs (.github/workflows/ci.yml), in CI's order, stopping at the
# first failure. Run it before every push.
#
# CI runs four jobs side by side; this runs them one after another: check, ui,
# balance, rules. The ui checks play whole careers in Chromium against a served
# build. CI installs its browser with `npx playwright install --with-deps
# chromium`; a machine that has one at /opt/pw-browsers/chromium, or names one in
# CHROMIUM, uses that. The whole run takes about ten minutes.
set -e
cd "$(dirname "$0")/.."

# check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm verify:no-leak
pnpm verify:artwork
pnpm verify:itch
node tools/build-edge.mjs
npx tsx tools/verify-bundle.ts

# ui: `pnpm preview`, not `npx vite preview`, because vite belongs to apps/web.
# A server already on :4173 would be checked instead of this build, so refuse.
if curl -sf http://127.0.0.1:4173/ > /dev/null 2>&1; then
  echo "something is already serving :4173; stop it and run again" >&2
  exit 1
fi
# `pnpm preview` runs vite a few processes down, so stopping it means stopping
# the whole tree, children first. (Job control would give it a process group of
# its own, but a shell without a terminal cannot turn job control on.)
stop_tree() {
  for child in $(pgrep -P "$1" 2>/dev/null); do stop_tree "$child"; done
  kill "$1" 2>/dev/null || true
}
pnpm preview > /dev/null 2>&1 &
PREVIEW=$!
trap 'stop_tree "$PREVIEW"' EXIT
trap 'exit 130' INT TERM
up=
for _ in $(seq 1 60); do
  if curl -sf http://127.0.0.1:4173/ > /dev/null; then up=1; break; fi
  sleep 1
done
[ -n "$up" ] || { echo "the preview never came up" >&2; exit 1; }
pnpm verify:ui
pnpm verify:desktop
pnpm seo

# balance: a 1,500-career smoke of the 20,000-career sweep, same bands
pnpm balance -- --runs=1500 --assert

# rules: the logic sweeps, at their full counts
pnpm fairness --assert
pnpm market
pnpm skill --assert
pnpm deck      # prints the cards that are not a decision; never fails
pnpm plausibility --assert

echo "all gates green"
