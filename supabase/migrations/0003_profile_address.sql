-- 0003_profile_address.sql: delivery address + last device location on profiles.
--
-- Run order: run in the Supabase SQL Editor AFTER 0001_profiles.sql (and
-- 0002_storage.sql). Re-runnable: columns use `add column if not exists`,
-- table constraints use `drop constraint if exists` + `add constraint`, and
-- grants are idempotent.
--
-- What it does NOT touch: RLS policies (still own-row only), the
-- role CHECK / role-escalation guard, the updated_at and handle_new_user
-- triggers, and the existing 0001 grants. Grants below are ADDITIVE column
-- privileges only (no revoke, no table-wide grant); role, created_at,
-- updated_at (and id on update) stay non-writable by clients.
--
-- New client-writable columns (INSERT + UPDATE, authenticated only):
--   address_label, address_full, address_details, address_lat, address_lng,
--   address_place_id, location_lat, location_lng, location_label,
--   location_updated_at
--
-- Note: like 0001, `add column if not exists` skips the inline CHECK when the
-- column already exists. The paired-coordinate rules are table constraints
-- so they are (re)applied on every run.
--
-- Existing users with name + phone but no address_label are sent to the
-- app's address step on their next launch (intended).

-- 1. Columns (all nullable) ---------------------------------------------------
-- Short display line, e.g. "University Avenue". Required by the app for a
-- profile to count as complete.
alter table public.profiles add column if not exists address_label text
  check (address_label is null or char_length(btrim(address_label)) between 1 and 200);
alter table public.profiles add column if not exists address_full text
  check (address_full is null or char_length(address_full) <= 500);
-- Apartment, floor, landmark (free text from the rider's point of view).
alter table public.profiles add column if not exists address_details text
  check (address_details is null or char_length(btrim(address_details)) between 1 and 120);
alter table public.profiles add column if not exists address_lat double precision
  check (address_lat is null or address_lat between -90 and 90);
alter table public.profiles add column if not exists address_lng double precision
  check (address_lng is null or address_lng between -180 and 180);
alter table public.profiles add column if not exists address_place_id text
  check (address_place_id is null or char_length(address_place_id) <= 100);
alter table public.profiles add column if not exists location_lat double precision
  check (location_lat is null or location_lat between -90 and 90);
alter table public.profiles add column if not exists location_lng double precision
  check (location_lng is null or location_lng between -180 and 180);
alter table public.profiles add column if not exists location_label text
  check (location_label is null or char_length(location_label) <= 200);
alter table public.profiles add column if not exists location_updated_at timestamptz;

-- 2. Paired coordinates (both or neither) -------------------------------------
alter table public.profiles drop constraint if exists profiles_address_coords_paired;
alter table public.profiles add constraint profiles_address_coords_paired
  check ((address_lat is null) = (address_lng is null));
alter table public.profiles drop constraint if exists profiles_location_coords_paired;
alter table public.profiles add constraint profiles_location_coords_paired
  check ((location_lat is null) = (location_lng is null));

-- 3. Column comments -----------------------------------------------------------
comment on column public.profiles.address_label is
  'Short delivery address line shown in the app, e.g. "University Avenue".';
comment on column public.profiles.address_full is
  'Full formatted delivery address.';
comment on column public.profiles.address_details is
  'Optional apartment / floor / landmark notes for the rider.';
comment on column public.profiles.address_place_id is
  'Provider id: "photon:<osm_type><osm_id>" (OpenStreetMap via Photon) or "device:<lat>,<lng>" (GPS + reverse geocode).';
comment on column public.profiles.location_label is
  'Short label for the last device location (Home top bar).';
comment on column public.profiles.location_updated_at is
  'When the device location was last saved by the app.';

-- 4. Grants: additive column privileges only ----------------------------------
grant insert (address_label, address_full, address_details, address_lat, address_lng,
  address_place_id, location_lat, location_lng, location_label, location_updated_at)
  on public.profiles to authenticated;
grant update (address_label, address_full, address_details, address_lat, address_lng,
  address_place_id, location_lat, location_lng, location_label, location_updated_at)
  on public.profiles to authenticated;
