-- 0001_profiles.sql: customer profiles + RLS + sign-up trigger.
--
-- Run order: run once in the Supabase SQL Editor (or `supabase db push`)
-- BEFORE the app's first real sign-in. It is re-runnable: tables/policies/
-- triggers use `if not exists` / `drop ... if exists` / `create or replace`,
-- and the backfill uses `on conflict do nothing`.
--
-- Sections: 1 table, 2 RLS policies, 3 grants (role-escalation guard),
-- 4 updated_at trigger, 5 handle_new_user trigger, 6 backfill.
--
-- Role escalation (a client making itself something other than a customer)
-- is blocked three ways:
--   a. CHECK (role in ('customer')) - the only value the column accepts;
--      future roles are granted server-side by widening this check.
--   b. Column-level privileges: clients can INSERT/UPDATE only full_name,
--      phone, country_code (+ id on insert). Writing role, created_at or
--      updated_at fails with "permission denied", even with a valid JWT.
--   c. role defaults to 'customer' and the trigger never sets it.

-- 1. Table -------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text
    check (full_name is null or char_length(btrim(full_name)) between 2 and 80),
  -- E.164, e.g. +233201234567. Collected, not verified (auth is email OTP).
  phone text
    check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  -- Dial code, e.g. +233.
  country_code text
    check (country_code is null or country_code ~ '^\+[0-9]{1,4}$'),
  role text not null default 'customer'
    check (role in ('customer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1b. Patch a pre-existing profiles table (e.g. from a Supabase template) --
-- `create table if not exists` skips the whole definition when the table is
-- already there, so add any missing columns explicitly. No-ops on a fresh DB.
alter table public.profiles
  add column if not exists full_name text
    check (full_name is null or char_length(btrim(full_name)) between 2 and 80);
alter table public.profiles
  add column if not exists phone text
    check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$');
alter table public.profiles
  add column if not exists country_code text
    check (country_code is null or country_code ~ '^\+[0-9]{1,4}$');
alter table public.profiles
  add column if not exists role text not null default 'customer'
    check (role in ('customer'));
alter table public.profiles
  add column if not exists created_at timestamptz not null default now();
alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

comment on table public.profiles is
  'One row per auth user. Created by handle_new_user; filled by the app''s complete-profile screen.';

-- 2. Row level security ------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No DELETE policy: rows go away only via `on delete cascade` from auth.users.

-- 3. Grants ------------------------------------------------------------------
-- role, created_at and updated_at are not client-writable.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, full_name, phone, country_code) on public.profiles to authenticated;
grant update (full_name, phone, country_code) on public.profiles to authenticated;

-- 4. updated_at --------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 5. Create a minimal row for every new auth user ----------------------------
-- security definer so it can write past RLS/grants; empty search_path so
-- every name is schema-qualified.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Only the trigger should call it.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6. Backfill users who signed up before this migration -----------------------
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
