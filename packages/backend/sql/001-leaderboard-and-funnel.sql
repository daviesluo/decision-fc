-- Decision FC — the database the game actually needs, written down.
--
-- Until this file existed the schema lived only in the Supabase project: every
-- table, index and grant had been applied by hand, so there was no way to read
-- what the database looked like, no way to recreate it, and no record of why
-- any of it was there. That is fixed by writing it down, not by adding a
-- migration framework — one project, one file per change, applied in order.
--
-- Everything here is idempotent. Running it twice is a no-op, which is what
-- makes it safe to re-apply after a restore or against a branch database.
--
-- The posture, which every object below follows: **row level security is on
-- and no table has a policy.** Nothing reaches these tables with the anon key.
-- The leaderboard is written by the `career-submit` edge function with the
-- service role, and read back through the definer functions here; the funnel
-- counters are written only through `bg_event`. A definer function is a door
-- with a shape — it accepts exactly one kind of call and does exactly one
-- thing — which is a far smaller surface than a policy granting table access.

-- ---------------------------------------------------------------------------
-- 1. Indexes on bg_runs
-- ---------------------------------------------------------------------------

-- The daily challenge ranks a career against the other careers played on the
-- same seed at the same pace. Without this index that is a full scan on every
-- submission; with it, it is the board the daily challenge was always supposed
-- to have. Pace is in the key because a Deep career and a Speed career on one
-- seed are not the same contest — see apps/web/src/lib/daily.ts.
create index if not exists bg_runs_seed_pace_legacy_idx
  on public.bg_runs (seed, pace, legacy_score desc);

-- `country_id` is stored on every run and has never been filtered on; Supabase
-- reported the index as never used. An unused index is not free — it is
-- maintained on every insert. Dropped rather than kept "in case": recreating it
-- is one line, and this file is where that line would go.
drop index if exists public.bg_runs_country_idx;

-- ---------------------------------------------------------------------------
-- 2. Rate limiting for every public write path
-- ---------------------------------------------------------------------------

-- `career-submit` runs the game engine on demand for anybody who can reach it,
-- with no authentication and no limit. That is a free compute faucet: the
-- replay of a 400-decision career is real CPU, and nothing stopped a script
-- asking for a thousand of them. This is the ceiling.
--
-- A fixed window rather than a sliding one, deliberately. A sliding window
-- needs a row per event; this needs one row per bucket per minute, which is
-- what keeps the limiter itself from becoming the load.
create table if not exists public.bg_rate (
  bucket       text        not null,
  window_start timestamptz not null,
  n            integer     not null default 0,
  primary key (bucket, window_start)
);
alter table public.bg_rate enable row level security;

-- Count one hit against a bucket and say whether it is still under the limit.
--
-- The bucket is a *hash* of the caller's address, never the address: the edge
-- function hashes it before it gets here, and `bg_event` below hashes it in
-- SQL. So this table cannot say who did anything, only that some bucket was
-- busy — which is all a limiter needs, and it means an hour-old row is not
-- personal data waiting to leak.
create or replace function public.bg_rate_take(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer default 60
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  w timestamptz;
  c integer;
begin
  w := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / greatest(p_window_seconds, 1))
    * greatest(p_window_seconds, 1)
  );

  insert into public.bg_rate as r (bucket, window_start, n)
  values (left(coalesce(p_bucket, 'unknown'), 128), w, 1)
  on conflict (bucket, window_start) do update set n = r.n + 1
  returning r.n into c;

  -- Opportunistic sweep, on the first hit of a new bucket only, so the cost
  -- lands on one call in many rather than on every one. Nothing else ever
  -- deletes from this table and it would otherwise grow forever.
  if c = 1 then
    delete from public.bg_rate where window_start < clock_timestamp() - interval '1 hour';
  end if;

  return c <= p_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Every leaderboard number in one round trip
-- ---------------------------------------------------------------------------

-- The function used to ask for four exact counts over four HTTP requests on
-- every submission — invisible at a few hundred rows, four full scans each
-- time from there. This returns all of them, plus the daily board, in one
-- query.
--
-- `seed_total` and `seed_above` are the daily board, and they are deliberately
-- not "today's" anything: the server does not need to know what day it is or
-- which seed the challenge picked. A career is ranked against the other
-- careers played on the same seed at the same pace, whatever that seed is. For
-- a one-off random seed that is a board of one, and the client does not show
-- it. For the daily seed it is the board the whole feature exists for. No clock
-- shared between client and server, and nothing to lie about.
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
    'total',        (select count(*) from public.bg_runs),
    'above_legacy', (select count(*) from public.bg_runs where legacy_score      > p_legacy),
    'above_gross',  (select count(*) from public.bg_runs where gross_earnings    > p_gross),
    'above_value',  (select count(*) from public.bg_runs where peak_market_value > p_value),
    'seed_total',   (select count(*) from public.bg_runs
                      where seed = p_seed and pace = p_pace),
    'seed_above',   (select count(*) from public.bg_runs
                      where seed = p_seed and pace = p_pace and legacy_score > p_legacy)
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. The funnel, counted and nothing more
-- ---------------------------------------------------------------------------

-- docs/tech-plan.md §7 has named this funnel as a launch requirement since
-- the first week of the project, and nothing was ever recording it. The most
-- valuable number nobody had: how many people start a career and never finish
-- one.
--
-- What this is: one integer per event name per day. No session, no visitor id,
-- no cookie, no address, no user agent, no path, nothing that could be joined
-- to anything. A day's row says "this many careers finished on the 14th" and
-- cannot say whose. That is enough to read every ratio in the funnel, and it
-- is the version that needs no consent banner and cannot become a breach.
create table if not exists public.bg_events (
  day  date   not null,
  name text   not null,
  n    bigint not null default 0,
  primary key (day, name)
);
alter table public.bg_events enable row level security;

-- Bump one counter. Called straight from the browser with the anon key, which
-- is why the name is checked against a fixed list rather than trusted, and why
-- it is rate limited: the worst a flood can do is make a day's number wrong,
-- and this keeps even that cheap.
--
-- Unknown names return quietly instead of erroring. A caller learning which
-- names exist buys nothing, and a telemetry call must never be a way to probe
-- the database.
create or replace function public.bg_event(p_name text) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ip     text;
  bucket text;
begin
  if p_name is null or p_name not in (
    'visit', 'identity_done', 'season_5', 'career_finished', 'replay', 'share', 'error'
  ) then
    return;
  end if;

  -- First hop in X-Forwarded-For is the client as the CDN saw it. Hashed with a
  -- salt immediately and never stored in any other form; md5 is a bucketing
  -- function here, not a security boundary.
  ip := split_part(
    coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''),
    ',', 1);
  bucket := 'ev:' || md5(coalesce(nullif(btrim(ip), ''), 'unknown') || '|decision-fc-funnel');

  -- Generous: a single page load sends at most a handful, and a player who
  -- finishes six careers in a minute is a player, not an attack.
  if not public.bg_rate_take(bucket, 120, 60) then
    return;
  end if;

  insert into public.bg_events as e (day, name, n)
  values (current_date, p_name, 1)
  on conflict (day, name) do update set n = e.n + 1;
end;
$$;

-- The browser calls exactly this and nothing else.
revoke all on function public.bg_event(text) from public;
grant execute on function public.bg_event(text) to anon;
grant execute on function public.bg_event(text) to authenticated;

-- The other two are the edge function's, with the service role. Not the
-- browser's: `bg_ranks` would let anyone walk the score distribution, and
-- `bg_rate_take` would let anyone exhaust somebody else's bucket. The grants
-- are spelled out because revoking from PUBLIC removes the default execute
-- that `service_role` was relying on — revoke without the matching grant is
-- how you take the leaderboard down from inside a hardening change.
--
-- And `anon, authenticated` by name, not just PUBLIC. Supabase's default
-- privileges grant EXECUTE on every new function in `public` to those two
-- roles *directly*, so a revoke from PUBLIC leaves both grants standing and
-- the function stays wide open. That was tried and measured: `bg_ranks`
-- answered an anon request with the whole score distribution until this line
-- existed. Revoking from PUBLIC alone is not a restriction in this database.
revoke all on function public.bg_ranks(integer, bigint, bigint, text, text) from public, anon, authenticated;
revoke all on function public.bg_rate_take(text, integer, integer) from public, anon, authenticated;
grant execute on function public.bg_ranks(integer, bigint, bigint, text, text) to service_role;
grant execute on function public.bg_rate_take(text, integer, integer) to service_role;
grant execute on function public.bg_event(text) to service_role;
