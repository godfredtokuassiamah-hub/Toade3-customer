-- pgTAP tests for supabase/migrations/0009_rate_limits.sql.
-- WRITTEN, NOT EXECUTED (no database access in this workflow).
-- Run locally after `supabase start` + migrations: `supabase test db`.
-- Everything runs in one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(31);

-- Users (as postgres). handle_new_user creates their profiles rows; with no
-- JWT the rate-limit trigger skips those inserts.
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'rl-a@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'rl-b@example.com');

-- 1. Schema / grants ------------------------------------------------------------
select has_schema('ratelimit');
select ok(not has_schema_privilege('anon', 'ratelimit', 'usage'), 'anon has no USAGE on ratelimit');
select ok(not has_schema_privilege('authenticated', 'ratelimit', 'usage'), 'authenticated has no USAGE on ratelimit');

select ok(not has_function_privilege('anon', 'ratelimit.check(text, integer, interval)', 'execute'), 'anon cannot execute check');
select ok(not has_function_privilege('authenticated', 'ratelimit.check(text, integer, interval)', 'execute'), 'authenticated cannot execute check');
select ok(not has_function_privilege('anon', 'ratelimit.hit(text, text, integer, integer)', 'execute'), 'anon cannot execute hit');
select ok(not has_function_privilege('authenticated', 'ratelimit.hit(text, text, integer, integer)', 'execute'), 'authenticated cannot execute hit');
select ok(not has_function_privilege('authenticated', 'ratelimit.subject()', 'execute'), 'authenticated cannot execute subject');
select ok(not has_function_privilege('authenticated', 'ratelimit.prune(interval)', 'execute'), 'authenticated cannot execute prune');
select ok(not has_function_privilege('authenticated', 'ratelimit.enforce_trigger()', 'execute'), 'authenticated cannot execute enforce_trigger');
select ok(not has_function_privilege('anon', 'public.ratelimit_consume(text, text)', 'execute'), 'anon cannot execute ratelimit_consume');
select ok(not has_function_privilege('authenticated', 'public.ratelimit_consume(text, text)', 'execute'), 'authenticated cannot execute ratelimit_consume');
select ok(has_function_privilege('service_role', 'public.ratelimit_consume(text, text)', 'execute'), 'service_role can execute ratelimit_consume');

select ok(not has_table_privilege('authenticated', 'ratelimit.counters', 'select'), 'authenticated cannot read counters');

-- 2. Definer hygiene ---------------------------------------------------------------
select is(
  (select count(*) from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where (n.nspname = 'ratelimit' or (n.nspname = 'public' and p.proname = 'ratelimit_consume'))
     and (not p.prosecdef or not coalesce(p.proconfig @> array['search_path=""'], false))),
  0::bigint,
  'every rate-limit function is SECURITY DEFINER with an empty search_path');

-- 3. RLS + seed ---------------------------------------------------------------------
select ok((select relrowsecurity from pg_catalog.pg_class where oid = 'ratelimit.limits'::regclass), 'RLS on limits');
select ok((select relrowsecurity from pg_catalog.pg_class where oid = 'ratelimit.counters'::regclass), 'RLS on counters');
select results_eq(
  $$ select action, max_hits, window_seconds from ratelimit.limits order by action $$,
  $$ values ('cart.write'::text, 60, 60), ('order.cancel', 10, 60), ('order.place', 5, 60), ('profile.write', 10, 60) $$,
  'limits seed matches SERVER_RATE_LIMITS');
select has_trigger('public', 'profiles', 'profiles_rate_limit', 'profiles has the rate-limit trigger');
select has_trigger('public', 'cart_drafts', 'cart_drafts_rate_limit', 'cart_drafts has the rate-limit trigger');

-- 4. Unknown action fails closed --------------------------------------------------------
select throws_ok($$ select ratelimit.check('no.such.action') $$, 'T3430', null, 'unknown action -> T3430');

-- 5. profile.write: 10 per minute for user A ---------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$
  do $d$
  begin
    for i in 1..10 loop
      update public.profiles set full_name = 'Rate Test' where id = '11111111-1111-4111-8111-111111111111';
    end loop;
  end
  $d$ $$, '10 profile writes within a minute pass');

select throws_ok($$
  update public.profiles set full_name = 'Rate Test' where id = '11111111-1111-4111-8111-111111111111'
$$, 'PGRST', null, '11th profile write is rate limited (PGRST -> HTTP 429)');

-- 6. A different user has an independent budget; an upsert counts once ------------------
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);

select lives_ok($$
  update public.profiles set full_name = 'Other User' where id = '22222222-2222-4222-8222-222222222222'
$$, 'user B is not affected by user A''s limit');

select lives_ok($$
  insert into public.cart_drafts (customer_id, lines, updated_at)
  values ('22222222-2222-4222-8222-222222222222', '[]'::jsonb, now())
  on conflict (customer_id) do update set lines = excluded.lines, updated_at = excluded.updated_at
$$, 'cart upsert (insert path)');
select lives_ok($$
  insert into public.cart_drafts (customer_id, lines, updated_at)
  values ('22222222-2222-4222-8222-222222222222', '[]'::jsonb, now())
  on conflict (customer_id) do update set lines = excluded.lines, updated_at = excluded.updated_at
$$, 'cart upsert (update path)');

reset role;
select set_config('request.jwt.claims', '', true);

select is(
  (select hits from ratelimit.counters
   where subject = 'user:11111111-1111-4111-8111-111111111111' and action = 'profile.write'),
  10, 'the rejected 11th write rolled back: user A stays at 10');
select is(
  (select hits from ratelimit.counters
   where subject = 'user:22222222-2222-4222-8222-222222222222' and action = 'cart.write'),
  2, 'two upserts -> two hits (one per statement, not per BEFORE trigger)');

-- 7. ratelimit_consume (service_role, never raises) -----------------------------------------
set local role service_role;
select is(
  (select count(*) from (
     select public.ratelimit_consume('svc:test', 'order.place') from generate_series(1, 5)) s),
  5::bigint, 'five consumes');
select is(
  (public.ratelimit_consume('svc:test', 'order.place') ->> 'allowed')::boolean,
  false, '6th consume in the window -> allowed = false (no exception)');
reset role;

-- 8. prune ----------------------------------------------------------------------------------
insert into ratelimit.counters (subject, action, window_start, expires_at, hits)
values ('user:old', 'order.place', now() - interval '3 days', now() - interval '3 days' + interval '60 seconds', 1);
select is(ratelimit.prune(), 1, 'prune removes only windows that expired over a day ago');

select * from finish();
rollback;
