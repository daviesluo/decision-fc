-- Decision FC — a leaderboard played by the final engine, and a clock on it.
--
-- Applied 2026-09-23. Everything here is idempotent, as in 001 and 002.
--
-- ## Why
--
-- On 2026-09-17 the scoring rules changed (a club medal is now worth the
-- minutes behind it, and a season on the bench stopped paying for
-- development), and the 566 rows stamped `engine = 'v1'` were scored under
-- the old, more generous rules. A career finished today was ranked against
-- that inflated history. Re-scoring by replay was measured and does not work —
-- 10 of 200 old decision lists survive a rules change —
-- so the decision was to replace them with careers played through the
-- final engine by `tools/seed-boards.ts`, and to keep the real careers scored
-- by the current rules exactly as they are.
--
-- Three things follow from that and are below: a column that says which rows
-- are simulated, a clock on the boards so the daily challenge fills through
-- the day instead of appearing at midnight, and an archive of what is removed.

-- ---------------------------------------------------------------------------
-- 1. Which rows are simulated
-- ---------------------------------------------------------------------------

-- A real player's row is written by the edge function, which never sets this,
-- so it is false by default and true only on rows `seed-boards.ts` wrote. The
-- point is that the two can always be told apart — counted, filtered, or the
-- simulated ones deleted outright — without touching anybody's career.
alter table public.bg_runs add column if not exists seeded boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. The boards count only what has already happened
-- ---------------------------------------------------------------------------

-- `seed-boards.ts` writes a day's simulated careers ahead of time, each with
-- the moment in that day it "finished". Counting only rows whose moment has
-- passed is what makes the daily board start at zero at 00:00 UTC and climb
-- through the day, rather than holding the whole day's field at one past
-- midnight. A real row is written with `now()` and so always counts the moment
-- it exists — the submitting player is ranked against the board as it stands.
create or replace function public.bg_ranks(
  p_legacy integer,
  p_gross  bigint,
  p_value  bigint,
  p_seed   text,
  p_pace   text
) returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'total',        (select count(*) from public.bg_runs where created_at <= now()),
    'above_legacy', (select count(*) from public.bg_runs
                      where created_at <= now() and legacy_score > p_legacy),
    'above_gross',  (select count(*) from public.bg_runs
                      where created_at <= now() and gross_earnings > p_gross),
    'above_value',  (select count(*) from public.bg_runs
                      where created_at <= now() and peak_market_value > p_value),
    'seed_total',   (select count(*) from public.bg_runs
                      where created_at <= now() and seed = p_seed and pace = p_pace),
    'seed_above',   (select count(*) from public.bg_runs
                      where created_at <= now() and seed = p_seed and pace = p_pace
                        and legacy_score > p_legacy)
  );
$$;

-- `create or replace` keeps the grants 001 set, but they are restated so this
-- file is right on its own. Named roles, not just PUBLIC — see 001.
revoke all on function public.bg_ranks(integer, bigint, bigint, text, text) from public, anon, authenticated;
grant execute on function public.bg_ranks(integer, bigint, bigint, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Keep what is replaced, then replace it
-- ---------------------------------------------------------------------------

-- Nothing is deleted without a copy. The archive has the same shape as the
-- board plus the moment a row left it, the same posture as every other table
-- here (row level security on, no policies, no grants), and a unique key, so
-- re-applying this file archives nothing twice.
create table if not exists public.bg_runs_archive (like public.bg_runs including all);
alter table public.bg_runs_archive add column if not exists archived_at timestamptz not null default now();
alter table public.bg_runs_archive enable row level security;
revoke all on table public.bg_runs_archive from public, anon, authenticated;

-- Run after `seed-boards.ts --backfill` has filled the board, so it is never
-- close to empty in between. Only the old-rules rows go; a real career scored
-- by the current rules stays where it is.
insert into public.bg_runs_archive
select r.*, now() from public.bg_runs r where r.engine = 'v1'
on conflict do nothing;
delete from public.bg_runs where engine = 'v1';
