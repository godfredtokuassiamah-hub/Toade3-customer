-- 0005_cart_drafts.sql: one server-side cart draft per customer, so the
-- cart follows the user across devices.
--
-- Run order: after 0004 (see supabase/SETUP.md). Re-runnable.
-- UNEXECUTED: written without database access; statically reviewed only.
--
-- The app stays local-first (AsyncStorage) and syncs in the background:
-- last-write-wins on updated_at, which the CLIENT sets (it is the time the
-- user last changed the cart, so no trigger overwrites it). Lines are the
-- app's CartLine JSON; prices in them are display-only and never charged
-- (place_order re-prices from the catalog).

create table if not exists public.cart_drafts (
  customer_id uuid primary key references auth.users (id) on delete cascade,
  -- Legacy vendor id of the lines ("v-campus-grill"), null when empty.
  vendor_id text check (vendor_id is null or char_length(vendor_id) <= 80),
  lines jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint cart_drafts_lines_shape check (
    jsonb_typeof(lines) = 'array'
    and jsonb_array_length(lines) <= 50
    and pg_column_size(lines) < 32768)
);

alter table public.cart_drafts enable row level security;

drop policy if exists "cart_drafts_select_own" on public.cart_drafts;
create policy "cart_drafts_select_own" on public.cart_drafts
  for select to authenticated
  using ((select auth.uid()) = customer_id);

drop policy if exists "cart_drafts_insert_own" on public.cart_drafts;
create policy "cart_drafts_insert_own" on public.cart_drafts
  for insert to authenticated
  with check ((select auth.uid()) = customer_id);

drop policy if exists "cart_drafts_update_own" on public.cart_drafts;
create policy "cart_drafts_update_own" on public.cart_drafts
  for update to authenticated
  using ((select auth.uid()) = customer_id)
  with check ((select auth.uid()) = customer_id);

drop policy if exists "cart_drafts_delete_own" on public.cart_drafts;
create policy "cart_drafts_delete_own" on public.cart_drafts
  for delete to authenticated
  using ((select auth.uid()) = customer_id);

revoke all on public.cart_drafts from anon, authenticated;
grant select, insert, update, delete on public.cart_drafts to authenticated;
