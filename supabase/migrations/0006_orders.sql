-- 0006_orders.sql: orders + immutable order item snapshots.
--
-- Run order: after 0005, before 0007 (see supabase/SETUP.md). Re-runnable.
-- UNEXECUTED: written without database access; statically reviewed only.
--
-- Access model:
--   - Customers SELECT their own orders and items only (RLS).
--   - NO client INSERT / UPDATE / DELETE: no grants and no write policies.
--     Orders are created and changed only by the security-definer functions
--     in 0007 (place_order, cancel_order).

-- 1. Status enum --------------------------------------------------------------
do $$
begin
  create type public.order_status as enum (
    'pending', 'accepted', 'preparing', 'ready', 'out_for_delivery',
    'delivered', 'rejected', 'cancelled');
exception
  when duplicate_object then null;
end;
$$;

-- 2. orders -------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  -- Short human number for support / the confirmation screen.
  order_number bigint generated always as identity unique,
  customer_id uuid not null references auth.users (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id),
  status public.order_status not null default 'pending',
  -- Optimistic concurrency: every status change bumps it.
  version integer not null default 1 check (version >= 1),
  -- Integer pesewas, all computed server-side by place_order.
  items_total_minor integer not null check (items_total_minor >= 0),
  delivery_fee_minor integer not null check (delivery_fee_minor >= 0),
  service_fee_minor integer not null check (service_fee_minor >= 0),
  tip_minor integer not null default 0 check (tip_minor >= 0),
  total_minor integer not null check (total_minor >= 0),
  distance_km numeric(4, 1) not null check (distance_km >= 0),
  -- Drop-off snapshot.
  dropoff_label text not null check (char_length(dropoff_label) between 1 and 200),
  dropoff_lat double precision not null check (dropoff_lat between -90 and 90),
  dropoff_lng double precision not null check (dropoff_lng between -180 and 180),
  instructions text check (instructions is null or char_length(instructions) <= 500),
  idempotency_key uuid not null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_idempotency_unique unique (customer_id, idempotency_key),
  constraint orders_total_matches check (
    total_minor = items_total_minor + delivery_fee_minor + service_fee_minor + tip_minor)
);

create index if not exists orders_customer_created_idx
  on public.orders (customer_id, created_at desc);
create index if not exists orders_vendor_idx on public.orders (vendor_id);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- 3. order_items (snapshots: never updated) -----------------------------------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_legacy_id text,
  name text not null,
  unit_price_minor integer not null check (unit_price_minor >= 0),
  -- [{ "id": "protein-beef", "label": "Beef", "price_minor": 500 }, ...]
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  note text check (note is null or char_length(note) <= 200),
  qty integer not null check (qty between 1 and 20),
  line_total_minor integer not null check (line_total_minor >= 0),
  sort integer not null default 0
);

create index if not exists order_items_order_idx on public.order_items (order_id, sort);

-- 4. Row level security -------------------------------------------------------
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders
  for select to authenticated
  using ((select auth.uid()) = customer_id);

drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_own" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.customer_id = (select auth.uid())
  ));

-- 5. Grants: read-only, signed-in customers only -------------------------------
revoke all on public.orders from anon, authenticated;
revoke all on public.order_items from anon, authenticated;
grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;
