# Club crest artwork

Club crests are trademarks of their respective owners and are used with
permission. They are not licensed by this repository's `LICENSE`.

Files are named `<club id>.png` (ids from `packages/content/src/data/clubs.ts`).
Any club without a file here automatically falls back to the generated badge —
deleting this folder's images is always safe. See `docs/crests.md` for adding
or replacing art.

Re-download or top up with:

    node tools/crests-fetch-tsdb.mjs
