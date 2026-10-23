-- 0004_catalog.sql: stores / vendors, categories, products, option groups
-- and options + public read RLS + search indexes.
--
-- Run order: after 0001-0003, before 0005-0008 (see supabase/SETUP.md).
-- Re-runnable: `if not exists` / `create or replace` / `drop ... if exists`.
-- UNEXECUTED: written without database access; statically reviewed only.
--
-- Access model:
--   - anon + authenticated may SELECT published rows only (RLS).
--   - No client writes at all (no insert/update/delete grants or policies).
--     The vendor app will write later through its own role / functions.
--
-- Ids: uuid primary keys; `legacy_id` holds the app's mock id ("v-campus-grill",
-- "st-medie-foods", "lm-jollof-chicken", option "protein-beef", ...) so local
-- carts and favourites keep working against the database. The RPCs accept
-- either the legacy id or the uuid text.

create extension if not exists pg_trgm with schema extensions;

-- 1. vendors ------------------------------------------------------------------
-- One table for both catalog vendors (have products, `listed = false`) and
-- the Stores-tab directory entries (`listed = true`). A directory entry shows
-- another vendor's menu through `menu_vendor_id` (several directory stores can
-- share one catalog vendor, e.g. City Stores).
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  slug text not null unique
    check (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  name text not null
    check (char_length(btrim(name)) between 1 and 120),
  category text
    check (category is null or category in (
      'groceries', 'pharmacy', 'electronics', 'bakery', 'flowers', 'gifts',
      'home-diy', 'sports', 'health-beauty', 'restaurants')),
  listed boolean not null default false,
  menu_vendor_id uuid references public.vendors (id) on delete set null,
  logo_path text,
  cover_path text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  prep_min integer not null default 10,
  prep_max integer not null default 15,
  -- Directory open flag; ordering also checks opening_hours + paused.
  is_open boolean not null default true,
  -- {"open":"HH:MM","close":"HH:MM"} in UTC (Accra is UTC+0); close may be
  -- "24:00"; close < open wraps past midnight. null = always open.
  opening_hours jsonb
    check (opening_hours is null or (
      jsonb_typeof(opening_hours) = 'object'
      and opening_hours ->> 'open' ~ '^([01][0-9]|2[0-4]):[0-5][0-9]$'
      and opening_hours ->> 'close' ~ '^([01][0-9]|2[0-4]):[0-5][0-9]$')),
  paused boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendors_prep_range check (prep_min >= 0 and prep_min <= prep_max and prep_max <= 240)
);

comment on table public.vendors is
  'Catalog vendors (listed = false, own products) and Stores-tab directory entries (listed = true, menu via menu_vendor_id).';

create index if not exists vendors_listed_idx on public.vendors (listed) where published;
create index if not exists vendors_menu_vendor_idx on public.vendors (menu_vendor_id);

-- 2. categories ---------------------------------------------------------------
create table if not exists public.categories (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  label text not null check (char_length(btrim(label)) between 1 and 80),
  scope text not null check (scope in ('food', 'groceries')),
  icon text,
  sort integer not null default 0
);

-- 3. products -----------------------------------------------------------------
-- Search text for the tsvector column. Marked immutable (array_to_string is
-- only stable in general, but deterministic for text[]), as a generated
-- column requires.
create or replace function public.product_search_text(p_name text, p_aliases text[])
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_name, '') || ' ' || coalesce(pg_catalog.array_to_string(p_aliases, ' '), '')
$$;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  aliases text[] not null default '{}',
  description text check (description is null or char_length(description) <= 1000),
  scope text not null check (scope in ('food', 'groceries')),
  -- Integer pesewas. The server always prices from these columns.
  price_minor integer not null check (price_minor >= 0),
  compare_at_minor integer,
  -- null = unknown weight: not orderable.
  weight_g integer check (weight_g is null or weight_g > 0),
  stock integer not null default 0 check (stock >= 0),
  disabled boolean not null default false,
  published boolean not null default false,
  image_path text,
  eta_mins integer not null default 15 check (eta_mins between 0 and 240),
  -- MOCK promo flags (display only, never priced from).
  popular boolean not null default false,
  discount_percent integer check (discount_percent is null or discount_percent between 1 and 90),
  search tsvector generated always as (
    to_tsvector('simple'::regconfig, public.product_search_text(name, aliases))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_compare_at_above_price
    check (compare_at_minor is null or compare_at_minor > price_minor)
);

create index if not exists products_vendor_idx on public.products (vendor_id);
create index if not exists products_price_id_idx on public.products (price_minor, id);
create index if not exists products_search_idx on public.products using gin (search);
create index if not exists products_name_trgm_idx
  on public.products using gin (name extensions.gin_trgm_ops);

-- 4. product_categories (many-to-many) ----------------------------------------
create table if not exists public.product_categories (
  product_id uuid not null references public.products (id) on delete cascade,
  category_id text not null references public.categories (id) on delete cascade,
  primary key (product_id, category_id)
);

create index if not exists product_categories_category_idx
  on public.product_categories (category_id, product_id);

-- 5. option groups + options --------------------------------------------------
create table if not exists public.option_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  legacy_id text not null,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  required boolean not null default false,
  min_select integer not null default 0,
  max_select integer not null default 1,
  sort integer not null default 0,
  unique (product_id, legacy_id),
  constraint option_groups_bounds check (
    min_select >= 0 and max_select >= 1 and min_select <= max_select
    and ((required and min_select >= 1) or (not required and min_select = 0)))
);

create index if not exists option_groups_product_idx on public.option_groups (product_id, sort);

create table if not exists public.options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.option_groups (id) on delete cascade,
  legacy_id text not null,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  price_minor integer not null default 0 check (price_minor >= 0),
  sort integer not null default 0,
  unique (group_id, legacy_id)
);

create index if not exists options_group_idx on public.options (group_id, sort);

-- 6. updated_at (function from 0001; re-declared identically so this file
-- also runs on its own) ---------------------------------------------------------
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

drop trigger if exists vendors_set_updated_at on public.vendors;
create trigger vendors_set_updated_at
  before update on public.vendors
  for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- 7. Row level security: public read of PUBLISHED rows only -------------------
alter table public.vendors enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.option_groups enable row level security;
alter table public.options enable row level security;

drop policy if exists "vendors_public_read" on public.vendors;
create policy "vendors_public_read" on public.vendors
  for select to anon, authenticated
  using (published);

drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories
  for select to anon, authenticated
  using (true);

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products
  for select to anon, authenticated
  using (
    published
    and exists (
      select 1 from public.vendors v
      where v.id = products.vendor_id and v.published
    )
  );

-- Child rows are visible only through a visible (published) product; the
-- subqueries are themselves filtered by the products / option_groups policies.
drop policy if exists "product_categories_public_read" on public.product_categories;
create policy "product_categories_public_read" on public.product_categories
  for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_categories.product_id and p.published
  ));

drop policy if exists "option_groups_public_read" on public.option_groups;
create policy "option_groups_public_read" on public.option_groups
  for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = option_groups.product_id and p.published
  ));

drop policy if exists "options_public_read" on public.options;
create policy "options_public_read" on public.options
  for select to anon, authenticated
  using (exists (
    select 1
    from public.option_groups g
    join public.products p on p.id = g.product_id
    where g.id = options.group_id and p.published
  ));

-- 8. Grants: read-only for clients ---------------------------------------------
revoke all on public.vendors from anon, authenticated;
revoke all on public.categories from anon, authenticated;
revoke all on public.products from anon, authenticated;
revoke all on public.product_categories from anon, authenticated;
revoke all on public.option_groups from anon, authenticated;
revoke all on public.options from anon, authenticated;

grant select on public.vendors to anon, authenticated;
grant select on public.categories to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.product_categories to anon, authenticated;
grant select on public.option_groups to anon, authenticated;
grant select on public.options to anon, authenticated;
-- product_search_text keeps the default EXECUTE: it is a pure text helper
-- that the generated column evaluates for whichever role writes products.
