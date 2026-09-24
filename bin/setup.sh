#!/bin/sh
# One-time setup for a fresh clone. Safe to re-run.
set -e
cd "$(dirname "$0")/.."

pnpm install

echo "set up: the workspace is installed"
