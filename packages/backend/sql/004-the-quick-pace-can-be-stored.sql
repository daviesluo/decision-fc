-- Decision FC — a career played on Quick can reach the leaderboard.
--
-- Applied 2026-09-23. Idempotent, as in 001–003.
--
-- ## Why
--
-- The table was created with `check (pace in ('blitz', 'standard', 'deep'))`.
-- The engine later renamed its shortest pace from `blitz` to `quick`, and the
-- edge function and the client followed; the constraint did not. So every
-- Quick career since the rename passed the replay, failed the insert with a
-- check violation, and came back to the player as "store failed" — the
-- summary fell back to its local estimate and the career never counted.
-- Nothing looked broken, because nothing ever does when the fallback works.
--
-- It was found by `seed-boards.ts`, whose first insert was a Quick career.
-- The measurement that should have found it earlier had been read the wrong
-- way: 0 Quick careers out of 131 real ones looked like players preferring
-- Deep. It was the board refusing them.
--
-- `apps/web/src/lib/schema.test.ts` now fails if the engine has a pace this
-- check does not name.

alter table public.bg_runs drop constraint if exists bg_runs_pace_check;
alter table public.bg_runs
  add constraint bg_runs_pace_check check (pace in ('quick', 'standard', 'deep'));

-- The archive was copied from the board with `including all`, so it carries
-- the same stale check, and archiving a Quick row would fail on it.
alter table public.bg_runs_archive drop constraint if exists bg_runs_pace_check;
alter table public.bg_runs_archive
  add constraint bg_runs_pace_check check (pace in ('quick', 'standard', 'deep'));
