-- Decision FC — make the rate limits mean something, and stop a hash from
-- being reversible with a constant anybody can read.
--
-- Applied 2026-09-18. Everything here is idempotent, as in 001.
--
-- ## Why
--
-- An independent audit of the 2026-09-17 work asked whether
-- `x-forwarded-for.split(',')[0]` is really the caller. It is not, and this was
-- measured rather than argued: three requests to `bg_event` with
-- `X-Forwarded-For: 10.1.1.1 / 10.2.2.2 / 10.3.3.3` produced three separate
-- buckets in `bg_rate`, each with a count of one. The proxy **appends**, so the
-- first hop is whatever the caller sent, and both rate limits — 20 submissions
-- a minute and 120 events a minute — were bypassed by rotating one header
-- string. The funnel integers were not tamper-resistant either.
--
-- A probe function (since dropped) showed what the proxy actually provides:
--
--   cf-connecting-ip: 160.79.106.129
--   x-forwarded-for:  10.9.9.9,160.79.106.129   ← forged value first
--
-- `cf-connecting-ip` is set by Cloudflare and overwritten on every request, so
-- it cannot be forged from outside. Prefer it; fall back to the **last** hop of
-- `x-forwarded-for`, which is the one the closest trusted proxy wrote.
--
-- ## And the salt
--
-- The bucket is a hash of the address, which is what lets the limiter work
-- without storing anybody's address. That only holds if the salt is a secret:
-- the previous one was a string literal in the repository, and a SHA-256 over
-- the IPv4 space with a known salt is seconds of GPU time. So the salt is
-- generated in the database, lives in `bg_secret` (RLS on, no grants, no API
-- path), and never appears in source control.
--
-- Retention drops from an hour to five minutes at the same time. The limiter
-- only ever needs the current window; everything older was exposure with no
-- purpose.

-- ---------------------------------------------------------------------------
-- 1. The salt
-- ---------------------------------------------------------------------------

create table if not exists public.bg_secret (
  id         text        not null primary key,
  value      text        not null,
  created_at timestamptz not null default now()
);
alter table public.bg_secret enable row level security;
-- Named roles, not just PUBLIC — see the lesson in 001.
revoke all on table public.bg_secret from public, anon, authenticated;

-- Two UUIDs' worth of hex. `gen_random_uuid()` is built in, so this needs no
-- extension, and `on conflict do nothing` means re-applying never rotates a
-- salt out from under the buckets already keyed on it.
insert into public.bg_secret (id, value)
values ('rate_salt', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Five minutes, not an hour
-- ---------------------------------------------------------------------------

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

  if c = 1 then
    delete from public.bg_rate where window_start < clock_timestamp() - interval '5 minutes';
  end if;

  return c <= p_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. The real caller, a secret salt, and one more funnel step
-- ---------------------------------------------------------------------------

-- `career_started` is new: the funnel's first ratio in `docs/tech-plan.md`
-- §7 is "entry → identity-creation completion rate", and it could not be
-- computed because `visit` counts page loads while everything else counts
-- careers. This gives the top of the funnel a per-career denominator without
-- introducing a session id — which is the one thing this design does not have
-- and is not worth buying.
create or replace function public.bg_event(p_name text) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hdrs json;
  hops text[];
  ip   text;
  salt text;
begin
  if p_name is null or p_name not in (
    'visit', 'career_started', 'identity_done', 'season_5', 'career_finished', 'replay', 'share', 'error'
  ) then
    return;
  end if;

  hdrs := coalesce(current_setting('request.headers', true)::json, '{}'::json);

  -- Cloudflare's own value first: it is overwritten on every request and so
  -- cannot be forged. Only then the last hop of x-forwarded-for, which is what
  -- the nearest trusted proxy wrote — never the first, which is the caller's.
  ip := nullif(btrim(coalesce(hdrs ->> 'cf-connecting-ip', '')), '');
  if ip is null then
    hops := string_to_array(coalesce(hdrs ->> 'x-forwarded-for', ''), ',');
    if array_length(hops, 1) > 0 then
      ip := nullif(btrim(hops[array_length(hops, 1)]), '');
    end if;
  end if;
  ip := coalesce(ip, 'unknown');

  select value into salt from public.bg_secret where id = 'rate_salt';
  salt := coalesce(salt, 'decision-fc-funnel');

  if not public.bg_rate_take(
    'ev:' || encode(sha256(convert_to(ip || '|' || salt, 'utf8')), 'hex'),
    120,
    60
  ) then
    return;
  end if;

  insert into public.bg_events as e (day, name, n)
  values (current_date, p_name, 1)
  on conflict (day, name) do update set n = e.n + 1;
end;
$$;

revoke all on function public.bg_event(text) from public, anon, authenticated;
grant execute on function public.bg_event(text) to anon, authenticated, service_role;
