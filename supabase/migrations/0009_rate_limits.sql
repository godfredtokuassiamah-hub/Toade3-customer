-- 0009_rate_limits.sql: server-side (authoritative) rate limiting.
--
-- Run order: after 0001-0008 (see supabase/SETUP.md, "Rate limiting
-- migration (0009)"). The triggers need public.profiles (0001) and
-- public.cart_drafts (0005); each is skipped if its table is missing.
-- Re-runnable: `if not exists`, `create or replace`, `drop ... if exists`,
-- an upserted limits seed, and idempotent revokes / grants.
-- UNEXECUTED: written without database access; statically reviewed only.
--
-- What it protects: per-user caps on COMMITTED writes (profile writes and
-- cart upserts via triggers, which no client can skip; order place/cancel
-- once the 0007 owners add one `perform ratelimit.check(...)` line, see
-- section 12). Client-side throttles in the app are UX only; a script with
-- a valid JWT is stopped here.
-- What it does NOT protect:
--   * Reads. PostgREST runs GET/HEAD (and STABLE/IMMUTABLE RPCs such as
--     quote_delivery) in READ ONLY transactions, so nothing can be counted.
--   * Failed calls. ratelimit.check() increments and the caller's later
--     error (or the limit error itself) rolls the increment back: Postgres
--     has no autonomous transactions. Edge Functions should call
--     public.ratelimit_consume() in a separate request first (section 9).
--   * Volumetric floods / DDoS: platform level (Supabase / network).
--   * Auth endpoints (OTP send/verify): Supabase Auth's own limits.
--
-- Error contract (keep in sync with src/lib/security/rateLimitError.ts):
--   raise sqlstate 'PGRST' (PostgREST 12+ parses the JSON below) ->
--   HTTP 429, header Retry-After: <seconds>, body
--   {"code":"T3429","message":"RATE_LIMITED",
--    "details":"{\"action\":\"order.place\",\"retry_after\":42}",
--    "hint":"Too many requests"}
--   On PostgREST < 12 the call still fails, but as HTTP 400 with code
--   "PGRST" and that JSON as the message (the app matches both).
--   Other codes: RATE_LIMIT_CONFIG_MISSING T3430 (unknown action: fails
--   closed), RATE_LIMIT_INVALID_INPUT T3431.
--
-- Algorithm: fixed window per (subject, action), window_start =
-- floor(epoch / window) * window, one atomic upsert per hit. A fixed window
-- can admit up to 2 x max across a boundary; accepted for these limits.
-- Mirror for tests: decideFixedWindow() in src/lib/security/rateLimit.ts.
--
-- Note: `check` is an SQL reserved word. It is legal as a schema-qualified
-- function name, so always call it as ratelimit.check(...).

-- 1. Private schema -----------------------------------------------------------
-- NEVER add `ratelimit` to the Data API exposed schemas (Settings > API).
-- Clients get no USAGE; only SECURITY DEFINER functions (owner) touch it.
create schema if not exists ratelimit;
revoke all on schema ratelimit from public, anon, authenticated;

-- 2. Limits (one row per action) -----------------------------------------------
create table if not exists ratelimit.limits (
  action text primary key check (action ~ '^[a-z][a-z0-9_.]{1,63}$'),
  max_hits integer not null check (max_hits between 1 and 100000),
  window_seconds integer not null check (window_seconds between 1 and 86400),
  description text
);

-- Mirrored by SERVER_RATE_LIMITS in src/lib/security/rateLimit.ts;
-- rateLimitSql-test.ts parses the block between the markers. Edit both.
-- RATE_LIMITS_BEGIN
insert into ratelimit.limits (action, max_hits, window_seconds, description) values
  ('order.place', 5, 60, 'place_order RPC, per customer (replays of a known idempotency key are free)'),
  ('order.cancel', 10, 60, 'cancel_order RPC, per customer'),
  ('profile.write', 10, 60, 'INSERT/UPDATE on public.profiles, per user (trigger)'),
  ('cart.write', 60, 60, 'INSERT/UPDATE on public.cart_drafts, per user (trigger)')
on conflict (action) do update
  set max_hits = excluded.max_hits,
      window_seconds = excluded.window_seconds,
      description = excluded.description;
-- RATE_LIMITS_END

-- 3. Counters -------------------------------------------------------------------
create table if not exists ratelimit.counters (
  -- 'user:<uuid>', 'ip:<md5>', 'anon', or an Edge Function subject.
  subject text not null check (char_length(subject) between 1 and 200),
  action text not null,
  window_start timestamptz not null,
  -- window_start + window length; lets prune() honour each window's size.
  expires_at timestamptz not null,
  hits integer not null check (hits >= 0),
  primary key (subject, action, window_start)
);

create index if not exists counters_expires_at_idx on ratelimit.counters (expires_at);

-- Defence in depth: RLS on, no policies (the definer owner bypasses RLS).
alter table ratelimit.limits enable row level security;
alter table ratelimit.counters enable row level security;
revoke all on all tables in schema ratelimit from public, anon, authenticated;

-- 4. Subject ----------------------------------------------------------------------
-- The signed-in user when there is one. Otherwise a hash of the first
-- X-Forwarded-For entry (set by the Supabase gateway). The IP path is weak
-- (shared campus / mobile NAT, one bucket for many people) and exists only
-- for future anon-callable actions; no current action uses it.
create or replace function ratelimit.subject()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_headers json;
  v_ip text;
begin
  if v_uid is not null then
    return 'user:' || v_uid::text;
  end if;
  begin
    v_headers := nullif(pg_catalog.current_setting('request.headers', true), '')::json;
  exception when others then
    v_headers := null;
  end;
  v_ip := pg_catalog.btrim(pg_catalog.split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1));
  if v_ip <> '' then
    return 'ip:' || pg_catalog.md5(v_ip);
  end if;
  return 'anon';
end;
$$;

-- 5. One hit ------------------------------------------------------------------------
-- Atomically counts one hit for (subject, action) in the current window and
-- reports whether it is within the limit. Never raises for "over the limit"
-- (check() and ratelimit_consume() decide). p_max / p_window_seconds
-- override the limits row when given.
create or replace function ratelimit.hit(
  p_subject text,
  p_action text,
  p_max integer default null,
  p_window_seconds integer default null)
returns table (allowed boolean, hits integer, max_hits integer, retry_after_seconds integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_max integer;
  v_window integer;
  v_start timestamptz;
  v_hits integer;
  v_retry integer;
begin
  if p_subject is null or char_length(p_subject) not between 1 and 200
     or p_action is null or p_action !~ '^[a-z][a-z0-9_.]{1,63}$' then
    raise exception 'RATE_LIMIT_INVALID_INPUT' using errcode = 'T3431';
  end if;

  select l.max_hits, l.window_seconds into v_max, v_window
  from ratelimit.limits l
  where l.action = p_action;

  v_max := coalesce(p_max, v_max);
  v_window := coalesce(p_window_seconds, v_window);
  -- Unknown action and no override: fail closed, loudly.
  if v_max is null or v_window is null or v_max < 1 or v_window < 1 or v_window > 86400 then
    raise exception 'RATE_LIMIT_CONFIG_MISSING' using errcode = 'T3430',
      detail = pg_catalog.json_build_object('action', p_action)::text;
  end if;

  v_start := pg_catalog.to_timestamp(
    (pg_catalog.floor(extract(epoch from pg_catalog.now()) / v_window) * v_window)::double precision);

  -- Opportunistic cleanup of this subject's older windows for the action.
  delete from ratelimit.counters c
  where c.subject = p_subject and c.action = p_action and c.window_start < v_start;

  insert into ratelimit.counters as c (subject, action, window_start, expires_at, hits)
  values (p_subject, p_action, v_start, v_start + pg_catalog.make_interval(secs => v_window), 1)
  on conflict (subject, action, window_start)
  do update set hits = c.hits + 1
  returning c.hits into v_hits;

  v_retry := greatest(1, pg_catalog.ceil(extract(epoch from (
    v_start + pg_catalog.make_interval(secs => v_window) - pg_catalog.clock_timestamp())))::integer);

  allowed := v_hits <= v_max;
  hits := v_hits;
  max_hits := v_max;
  retry_after_seconds := case when v_hits <= v_max then 0 else v_retry end;
  return next;
end;
$$;

-- 6. Check (raise when over the limit) ---------------------------------------------
-- For SQL callers (definer RPCs, triggers). Over the limit -> HTTP 429 per
-- the contract in the header. The raise rolls back this hit, so the stored
-- count stays at max until the window ends.
create or replace function ratelimit.check(
  p_action text,
  p_max integer default null,
  p_window interval default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r record;
  v_window integer;
begin
  if p_window is not null then
    v_window := greatest(1, pg_catalog.ceil(extract(epoch from p_window))::integer);
  end if;

  select h.allowed, h.retry_after_seconds into r
  from ratelimit.hit(ratelimit.subject(), p_action, p_max, v_window) h;

  if not r.allowed then
    raise sqlstate 'PGRST' using
      message = pg_catalog.json_build_object(
        'code', 'T3429',
        'message', 'RATE_LIMITED',
        'details', pg_catalog.json_build_object(
          'action', p_action,
          'retry_after', r.retry_after_seconds)::text,
        'hint', 'Too many requests')::text,
      detail = pg_catalog.json_build_object(
        'status', 429,
        'status_text', 'Too Many Requests',
        'headers', pg_catalog.json_build_object('Retry-After', r.retry_after_seconds::text))::text;
  end if;
end;
$$;

-- 7. Trigger function ---------------------------------------------------------------
-- Counts one hit per affected row for the action in TG_ARGV[0]. Calls
-- without a user JWT (service jobs, handle_new_user at sign-up, migrations,
-- the SQL editor) are not limited.
create or replace function ratelimit.enforce_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return null;
  end if;
  perform ratelimit.check(tg_argv[0]);
  -- AFTER trigger: the return value is ignored.
  return null;
end;
$$;

-- 8. Triggers -----------------------------------------------------------------------
-- AFTER (not BEFORE) row triggers: INSERT ... ON CONFLICT DO UPDATE may fire
-- BEFORE INSERT and BEFORE UPDATE for one row, but only one AFTER trigger,
-- so an upsert counts once. The error aborts the whole statement.
-- New objects in this file only; 0001 / 0005 are untouched.
do $$
begin
  if pg_catalog.to_regclass('public.profiles') is not null then
    drop trigger if exists profiles_rate_limit on public.profiles;
    create trigger profiles_rate_limit
      after insert or update on public.profiles
      for each row execute function ratelimit.enforce_trigger('profile.write');
  end if;
  if pg_catalog.to_regclass('public.cart_drafts') is not null then
    drop trigger if exists cart_drafts_rate_limit on public.cart_drafts;
    create trigger cart_drafts_rate_limit
      after insert or update on public.cart_drafts
      for each row execute function ratelimit.enforce_trigger('cart.write');
  end if;
end;
$$;

-- 9. Edge Function entry point (service_role only) -----------------------------------
-- Counts one hit and returns {allowed, hits, max_hits, retry_after} WITHOUT
-- raising, so the count commits even if the function's later work fails.
-- Call it with the secret key, server-side only, BEFORE doing the work;
-- respond 429 + Retry-After when allowed is false. Never from the app.
create or replace function public.ratelimit_consume(p_subject text, p_action text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r record;
begin
  select h.allowed, h.hits, h.max_hits, h.retry_after_seconds into r
  from ratelimit.hit(p_subject, p_action) h;
  return pg_catalog.jsonb_build_object(
    'allowed', r.allowed,
    'hits', r.hits,
    'max_hits', r.max_hits,
    'retry_after', r.retry_after_seconds);
end;
$$;

-- 10. Cleanup ------------------------------------------------------------------------
-- hit() already deletes a subject's older windows for the same action.
-- prune() removes every window that expired more than p_older_than ago.
-- Optional schedule (Supabase Cron = pg_cron; enable it first under
-- Integrations > Cron), run once in the SQL editor:
--   select cron.schedule('ratelimit-prune', '17 * * * *', $cron$select ratelimit.prune()$cron$);
create or replace function ratelimit.prune(p_older_than interval default interval '1 day')
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from ratelimit.counters c
  where c.expires_at < pg_catalog.now() - coalesce(p_older_than, interval '1 day');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 11. Grants ---------------------------------------------------------------------------
-- No client role can call anything in ratelimit directly; definer callers
-- (RPCs, triggers) run as the owner. Re-run this block after adding a
-- function here (new functions get PUBLIC EXECUTE by default).
revoke execute on all functions in schema ratelimit from public, anon, authenticated;
revoke all on all tables in schema ratelimit from public, anon, authenticated;
revoke execute on function public.ratelimit_consume(text, text) from public, anon, authenticated;
grant execute on function public.ratelimit_consume(text, text) to service_role;

-- 12. Owner integration (NOT applied here: 0007 belongs to the orders work) -----------
-- Ship as a NEW owner migration that runs after 0009 (re-running an edited
-- 0007 before 0009 makes place_order fail with 42883):
--   public.place_order, right after the replay block
--     if found then
--       return public.t3_order_result(v_existing, true);
--     end if;
--   add
--     perform ratelimit.check('order.place');
--   (replays of a known idempotency key stay free; new keys are counted).
--   public.cancel_order, right after the INVALID_INPUT check
--     raise exception 'INVALID_INPUT' using errcode = 'T3010'; end if;
--   add
--     perform ratelimit.check('order.cancel');
--   public.quote_delivery is STABLE (read-only under PostgREST): no DB
--   limit possible without making it VOLATILE; not recommended now.
