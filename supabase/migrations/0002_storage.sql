-- 0002_storage.sql: image storage buckets + RLS policies.
--
-- Run order: run once in the Supabase SQL Editor AFTER 0001_profiles.sql.
-- Re-runnable: buckets use on-conflict upsert and policies drop-if-exists.
--
-- Buckets:
--   food-images  public read (menu photos). No client writes; vendors/admins
--                upload server-side later.
--   avatars      private. A signed-in user reads/writes ONLY their own folder
--                avatars/<auth.uid()>/...
--
-- The S3-compatible endpoint and its access keys (see SETUP.md) are NOT used
-- by the app and must never ship in it; the app uses the Storage API under
-- these policies with the user's session.

-- 1. Buckets ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('food-images', 'food-images', true)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do update set public = excluded.public;

-- 2. food-images: public read, no client writes ---------------------------
drop policy if exists "food-images public read" on storage.objects;
create policy "food-images public read"
  on storage.objects for select
  using (bucket_id = 'food-images');

-- 3. avatars: each user reads/writes only avatars/<their uid>/ -------------
-- storage.foldername(name)[1] is the first path segment (the user id).
drop policy if exists "avatars read own" on storage.objects;
create policy "avatars read own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars insert own" on storage.objects;
create policy "avatars insert own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars update own" on storage.objects;
create policy "avatars update own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars delete own" on storage.objects;
create policy "avatars delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
