-- 0010_order_eta.sql: order timeline, vendor + rider actions, live ETA.
--
-- Run order: after 0009 (see supabase/SETUP.md). Re-runnable.
-- UNEXECUTED: written without database access; statically reviewed only
-- (src/lib/security/__tests__/migrationAudit-test.ts, etaModel-sql-test.ts).
--
-- Model (Uber Eats / Bolt Food style, mirrored in src/lib/orders/etaModel.ts):
--   arrival = leaves store + ride to customer + handover
--   leaves store = later of (food ready, platform rider at the store)
-- Each leg switches from an estimate to real data once it exists:
--   pending              duration only (no clock time before the store commits)
--   accepted / preparing ready_by = accepted_at + prep the VENDOR confirmed
--   ready                rider -> store (live position when known)
--   out_for_delivery     rider -> customer (live position), else pickup + ride
-- The window never starts in the past; `late` = it now ends after the
-- promise made at accept (promised_eta_to).
--
-- Who does what:
--   customer app   place_order / cancel_order (0007, pending only in the app),
--                  order_tracking() to read the live ETA
--   vendor app     vendor_accept_order (picks prep), vendor_add_delay,
--                  vendor_mark_ready, vendor_reject_order. Members only.
--   rider dispatch rider_assign / rider_update_location / rider_picked_up /
--                  rider_delivered: service_role only (a trusted backend, never
--                  a phone holding the service key)
--   scheduler      expire_unaccepted_orders(): rejects orders the store didn't
--                  answer in time. Schedule with pg_cron once enabled, e.g.
--                  select cron.schedule('t3-expire-orders', '* * * * *',
--                    $$select public.expire_unaccepted_orders()$$);
--
-- Stable errors (src/lib/backend/errors.ts SQLSTATE_BY_CODE):
--   STALE_VERSION T3008, INVALID_INPUT T3010, ORDER_NOT_FOUND T3012,
--   INVALID_TRANSITION T3013 (the order isn't in a state that allows this),
--   42501 FORBIDDEN (not a member of the order's vendor).

-- 1. Timeline + rider columns ---------------------------------------------------
alter table public.orders
  add column if not exists accepted_at timestamptz,
  add column if not exists prep_minutes integer
    check (prep_minutes is null or prep_minutes between 1 and 120),
  add column if not exists ready_by timestamptz,
  add column if not exists ready_at timestamptz,
  add column if not exists picked_up_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists reject_reason text
    check (reject_reason is null or reject_reason in (
      'busy', 'closed', 'item_unavailable', 'no_response', 'other')),
  add column if not exists promised_eta_to timestamptz,
  add column if not exists rider_name text
    check (rider_name is null or char_length(rider_name) between 1 and 60),
  add column if not exists rider_lat double precision
    check (rider_lat is null or rider_lat between -90 and 90),
  add column if not exists rider_lng double precision
    check (rider_lng is null or rider_lng between -180 and 180),
  add column if not exists rider_location_at timestamptz;

create index if not exists orders_vendor_status_idx
  on public.orders (vendor_id, status, created_at);

-- 2. Vendor staff ------------------------------------------------------------------
create table if not exists public.vendor_members (
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (vendor_id, user_id)
);
create index if not exists vendor_members_user_idx on public.vendor_members (user_id);

alter table public.vendor_members enable row level security;
revoke all on public.vendor_members from anon, authenticated;
grant select on public.vendor_members to authenticated;
drop policy if exists "vendor_members_select_own" on public.vendor_members;
create policy "vendor_members_select_own" on public.vendor_members
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Vendor staff can read their store's orders (the vendor app's queue).
drop policy if exists "orders_select_vendor" on public.orders;
create policy "orders_select_vendor" on public.orders
  for select to authenticated
  using (exists (
    select 1 from public.vendor_members m
    where m.vendor_id = orders.vendor_id and m.user_id = (select auth.uid())));

drop policy if exists "order_items_select_vendor" on public.order_items;
create policy "order_items_select_vendor" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    join public.vendor_members m on m.vendor_id = o.vendor_id
    where o.id = order_items.order_id and m.user_id = (select auth.uid())));

-- 3. ETA model -----------------------------------------------------------------
-- t3_order_eta(order, now) -> jsonb, one of:
--   {"kind":"none"}
--   {"kind":"duration","mins":[lo,hi]}
--   {"kind":"window","from":ts,"to":ts,"basis":"store"|"rider","late":bool}
create or replace function public.t3_order_eta(p_order public.orders, p_now timestamptz)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  -- ETA_MODEL_BEGIN (mirrors ETA_MODEL in src/lib/orders/etaModel.ts)
  c_accept_min constant double precision := 2;
  c_accept_max constant double precision := 5;
  c_accept_timeout_mins constant double precision := 8;
  c_road_factor constant double precision := 1.35;
  c_speed_fast_kmh constant double precision := 24;
  c_speed_slow_kmh constant double precision := 16;
  c_handover_min constant double precision := 2;
  c_handover_max constant double precision := 4;
  c_rider_to_store_min constant double precision := 3;
  c_rider_to_store_max constant double precision := 8;
  c_prep_slack_mins constant double precision := 5;
  c_min_window_mins constant double precision := 5;
  -- ETA_MODEL_END
  v_vendor public.vendors;
  v_ride_lo double precision;
  v_ride_hi double precision;
  v_rs_lo double precision;
  v_rs_hi double precision;
  v_km double precision;
  v_lo timestamptz;
  v_hi timestamptz;
  v_ready_lo timestamptz;
  v_ready_hi timestamptz;
  v_basis text := 'store';
  v_a integer;
  v_b integer;
begin
  select * into v_vendor from public.vendors where id = p_order.vendor_id;
  v_ride_lo := p_order.distance_km * c_road_factor / c_speed_fast_kmh * 60;
  v_ride_hi := p_order.distance_km * c_road_factor / c_speed_slow_kmh * 60;

  -- Rider -> store: live position when known, else the default range.
  if p_order.rider_lat is not null and p_order.rider_lng is not null then
    v_km := public.t3_haversine_km(p_order.rider_lat, p_order.rider_lng, v_vendor.lat, v_vendor.lng);
    v_rs_lo := v_km * c_road_factor / c_speed_fast_kmh * 60;
    v_rs_hi := v_km * c_road_factor / c_speed_slow_kmh * 60;
  else
    v_rs_lo := c_rider_to_store_min;
    v_rs_hi := c_rider_to_store_max;
  end if;

  if p_order.status = 'pending' then
    v_a := greatest(5, floor((c_accept_min + greatest(v_vendor.prep_min, c_rider_to_store_min)
      + v_ride_lo + c_handover_min) / 5) * 5);
    v_b := greatest(v_a + 5, ceil((c_accept_max + greatest(v_vendor.prep_max, c_rider_to_store_max)
      + v_ride_hi + c_handover_max) / 5) * 5);
    return jsonb_build_object('kind', 'duration', 'mins', jsonb_build_array(v_a, v_b));
  elsif p_order.status in ('accepted', 'preparing') then
    v_ready_lo := coalesce(p_order.ready_by,
      coalesce(p_order.accepted_at, p_now) + make_interval(mins => v_vendor.prep_min));
    v_ready_hi := coalesce(p_order.ready_by,
      coalesce(p_order.accepted_at, p_now) + make_interval(mins => v_vendor.prep_max))
      + make_interval(secs => c_prep_slack_mins * 60);
    v_lo := greatest(v_ready_lo, p_now + make_interval(secs => v_rs_lo * 60))
      + make_interval(secs => (v_ride_lo + c_handover_min) * 60);
    v_hi := greatest(v_ready_hi, p_now + make_interval(secs => v_rs_hi * 60))
      + make_interval(secs => (v_ride_hi + c_handover_max) * 60);
  elsif p_order.status = 'ready' then
    v_lo := p_now + make_interval(secs => (v_rs_lo + v_ride_lo + c_handover_min) * 60);
    v_hi := p_now + make_interval(secs => (v_rs_hi + v_ride_hi + c_handover_max) * 60);
  elsif p_order.status = 'out_for_delivery' then
    if p_order.rider_lat is not null and p_order.rider_lng is not null then
      v_km := public.t3_haversine_km(p_order.rider_lat, p_order.rider_lng,
        p_order.dropoff_lat, p_order.dropoff_lng);
      v_lo := p_now + make_interval(secs => (v_km * c_road_factor / c_speed_fast_kmh * 60 + c_handover_min) * 60);
      v_hi := p_now + make_interval(secs => (v_km * c_road_factor / c_speed_slow_kmh * 60 + c_handover_max) * 60);
      v_basis := 'rider';
    else
      v_lo := coalesce(p_order.picked_up_at, p_now) + make_interval(secs => (v_ride_lo + c_handover_min) * 60);
      v_hi := coalesce(p_order.picked_up_at, p_now) + make_interval(secs => (v_ride_hi + c_handover_max) * 60);
    end if;
  else
    return jsonb_build_object('kind', 'none');
  end if;

  -- Whole minutes, never before now, never narrower than the minimum window.
  v_lo := date_trunc('minute', greatest(v_lo, p_now));
  v_hi := greatest(v_hi, p_now);
  if v_hi > date_trunc('minute', v_hi) then
    v_hi := date_trunc('minute', v_hi) + interval '1 minute';
  end if;
  if v_hi - v_lo < make_interval(secs => c_min_window_mins * 60) then
    v_hi := v_lo + make_interval(secs => c_min_window_mins * 60);
  end if;
  return jsonb_build_object(
    'kind', 'window',
    'from', v_lo,
    'to', v_hi,
    'basis', v_basis,
    'late', p_order.promised_eta_to is not null
      and v_hi > p_order.promised_eta_to + interval '2 minutes');
end;
$$;

-- Accept deadline for a pending order (shown as "we'll cancel at ...").
create or replace function public.t3_accept_deadline(p_order public.orders)
returns timestamptz
language sql
immutable
set search_path = ''
as $$ select p_order.created_at + interval '8 minutes' $$;

-- 4. Customer read: live tracking -------------------------------------------------
-- Own orders only. Returns the timeline, rider (first name + position, only
-- once assigned) and the server-computed ETA.
create or replace function public.order_tracking(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'T3001';
  end if;
  select * into v_order from public.orders o where o.id = p_order_id and o.customer_id = v_uid;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'T3012';
  end if;
  return jsonb_build_object(
    'order_id', v_order.id,
    'status', v_order.status,
    'version', v_order.version,
    'server_now', now(),
    'accepted_at', v_order.accepted_at,
    'prep_minutes', v_order.prep_minutes,
    'ready_by', v_order.ready_by,
    'picked_up_at', v_order.picked_up_at,
    'delivered_at', v_order.delivered_at,
    'reject_reason', v_order.reject_reason,
    'accept_deadline', case when v_order.status = 'pending'
      then public.t3_accept_deadline(v_order) end,
    'rider', case when v_order.rider_name is null then null else jsonb_build_object(
      'name', v_order.rider_name,
      'lat', v_order.rider_lat,
      'lng', v_order.rider_lng,
      'at', v_order.rider_location_at) end,
    'eta', public.t3_order_eta(v_order, now()));
end;
$$;

-- 5. Vendor actions ---------------------------------------------------------------
-- Locks the order, checks membership, version and status. Internal helper.
create or replace function public.t3_vendor_order_for_update(
  p_order_id uuid, p_expected_version integer, p_allowed public.order_status[])
returns public.orders
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'T3001';
  end if;
  if p_order_id is null or p_expected_version is null then
    raise exception 'INVALID_INPUT' using errcode = 'T3010';
  end if;
  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'T3012';
  end if;
  if not exists (
    select 1 from public.vendor_members m
    where m.vendor_id = v_order.vendor_id and m.user_id = v_uid) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_order.version <> p_expected_version then
    raise exception 'STALE_VERSION' using errcode = 'T3008',
      detail = jsonb_build_object('version', v_order.version, 'status', v_order.status)::text;
  end if;
  if not (v_order.status = any (p_allowed)) then
    raise exception 'INVALID_TRANSITION' using errcode = 'T3013',
      detail = jsonb_build_object('status', v_order.status)::text;
  end if;
  return v_order;
end;
$$;

-- Accept with a prep time ("Ready in 15 min"; the vendor app preselects the
-- store default). Goes straight to preparing, like Uber Eats / Bolt Food.
create or replace function public.vendor_accept_order(
  p_order_id uuid, p_expected_version integer, p_prep_minutes integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_eta jsonb;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'T3001';
  end if;
  if p_prep_minutes is null or p_prep_minutes < 1 or p_prep_minutes > 120 then
    raise exception 'INVALID_INPUT' using errcode = 'T3010', detail = '{"field":"prep_minutes"}';
  end if;
  v_order := public.t3_vendor_order_for_update(p_order_id, p_expected_version, array['pending']::public.order_status[]);
  update public.orders o
  set status = 'preparing', version = o.version + 1, accepted_at = now(),
      prep_minutes = p_prep_minutes, ready_by = now() + make_interval(mins => p_prep_minutes)
  where o.id = v_order.id
  returning * into v_order;
  -- The promise the customer sees; later windows are "late" past it.
  v_eta := public.t3_order_eta(v_order, now());
  update public.orders o set promised_eta_to = (v_eta ->> 'to')::timestamptz
  where o.id = v_order.id
  returning * into v_order;
  return jsonb_build_object('order_id', v_order.id, 'status', v_order.status,
    'version', v_order.version, 'ready_by', v_order.ready_by, 'eta', v_eta);
end;
$$;

-- "Need more time": pushes ready_by (5-30 min per tap). The customer's
-- window moves and shows "running late" once it passes the promise.
create or replace function public.vendor_add_delay(
  p_order_id uuid, p_expected_version integer, p_minutes integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'T3001';
  end if;
  if p_minutes is null or p_minutes < 5 or p_minutes > 30 then
    raise exception 'INVALID_INPUT' using errcode = 'T3010', detail = '{"field":"minutes"}';
  end if;
  v_order := public.t3_vendor_order_for_update(p_order_id, p_expected_version,
    array['accepted', 'preparing']::public.order_status[]);
  update public.orders o
  set version = o.version + 1,
      ready_by = greatest(coalesce(o.ready_by, now()), now()) + make_interval(mins => p_minutes)
  where o.id = v_order.id
  returning * into v_order;
  return jsonb_build_object('order_id', v_order.id, 'status', v_order.status,
    'version', v_order.version, 'ready_by', v_order.ready_by,
    'eta', public.t3_order_eta(v_order, now()));
end;
$$;

create or replace function public.vendor_mark_ready(p_order_id uuid, p_expected_version integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'T3001';
  end if;
  v_order := public.t3_vendor_order_for_update(p_order_id, p_expected_version,
    array['accepted', 'preparing']::public.order_status[]);
  update public.orders o
  set status = 'ready', version = o.version + 1, ready_at = now()
  where o.id = v_order.id
  returning * into v_order;
  return jsonb_build_object('order_id', v_order.id, 'status', v_order.status, 'version', v_order.version);
end;
$$;

-- Restores stock like cancel_order (0007).
create or replace function public.t3_restock_order(p_order_id uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  update public.products p
  set stock = p.stock + s.qty
  from (
    select i.product_id, sum(i.qty) as qty
    from public.order_items i
    where i.order_id = p_order_id and i.product_id is not null
    group by i.product_id
  ) s
  where p.id = s.product_id
$$;

create or replace function public.vendor_reject_order(
  p_order_id uuid, p_expected_version integer, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'T3001';
  end if;
  if p_reason is null or p_reason not in ('busy', 'closed', 'item_unavailable', 'other') then
    raise exception 'INVALID_INPUT' using errcode = 'T3010', detail = '{"field":"reason"}';
  end if;
  v_order := public.t3_vendor_order_for_update(p_order_id, p_expected_version,
    array['pending']::public.order_status[]);
  update public.orders o
  set status = 'rejected', version = o.version + 1, rejected_at = now(), reject_reason = p_reason
  where o.id = v_order.id
  returning * into v_order;
  perform public.t3_restock_order(v_order.id);
  return jsonb_build_object('order_id', v_order.id, 'status', v_order.status, 'version', v_order.version);
end;
$$;

-- 6. Rider dispatch (service_role only) --------------------------------------------
create or replace function public.rider_assign(p_order_id uuid, p_rider_name text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.orders o set rider_name = left(btrim(p_rider_name), 60), version = o.version + 1
  where o.id = p_order_id and o.status in ('accepted', 'preparing', 'ready');
end;
$$;

create or replace function public.rider_update_location(
  p_order_id uuid, p_lat double precision, p_lng double precision)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_lat is null or p_lng is null or abs(p_lat) > 90 or abs(p_lng) > 180 then
    raise exception 'INVALID_INPUT' using errcode = 'T3010';
  end if;
  -- No version bump: position pings are frequent and never conflict.
  update public.orders o set rider_lat = p_lat, rider_lng = p_lng, rider_location_at = now()
  where o.id = p_order_id and o.status in ('accepted', 'preparing', 'ready', 'out_for_delivery');
end;
$$;

create or replace function public.rider_picked_up(p_order_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.orders o
  set status = 'out_for_delivery', version = o.version + 1, picked_up_at = now()
  where o.id = p_order_id and o.status in ('preparing', 'ready');
end;
$$;

create or replace function public.rider_delivered(p_order_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.orders o
  set status = 'delivered', version = o.version + 1, delivered_at = now()
  where o.id = p_order_id and o.status = 'out_for_delivery';
end;
$$;

-- 7. Accept timeout (scheduler, service_role only) ---------------------------------
create or replace function public.expire_unaccepted_orders()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select o.id from public.orders o
    where o.status = 'pending' and now() >= public.t3_accept_deadline(o)
    for update skip locked
  loop
    update public.orders o
    set status = 'rejected', version = o.version + 1, rejected_at = now(), reject_reason = 'no_response'
    where o.id = v_id;
    perform public.t3_restock_order(v_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- 8. Grants ----------------------------------------------------------------------
revoke execute on function public.t3_order_eta(public.orders, timestamptz) from public, anon, authenticated;
revoke execute on function public.t3_accept_deadline(public.orders) from public, anon, authenticated;
revoke execute on function public.t3_restock_order(uuid) from public, anon, authenticated;
revoke execute on function public.t3_vendor_order_for_update(uuid, integer, public.order_status[])
  from public, anon, authenticated;
revoke execute on function public.order_tracking(uuid) from public, anon;
revoke execute on function public.vendor_accept_order(uuid, integer, integer) from public, anon;
revoke execute on function public.vendor_add_delay(uuid, integer, integer) from public, anon;
revoke execute on function public.vendor_mark_ready(uuid, integer) from public, anon;
revoke execute on function public.vendor_reject_order(uuid, integer, text) from public, anon;
revoke execute on function public.rider_assign(uuid, text) from public, anon, authenticated;
revoke execute on function public.rider_update_location(uuid, double precision, double precision)
  from public, anon, authenticated;
revoke execute on function public.rider_picked_up(uuid) from public, anon, authenticated;
revoke execute on function public.rider_delivered(uuid) from public, anon, authenticated;
revoke execute on function public.expire_unaccepted_orders() from public, anon, authenticated;

grant execute on function public.order_tracking(uuid) to authenticated;
grant execute on function public.vendor_accept_order(uuid, integer, integer) to authenticated;
grant execute on function public.vendor_add_delay(uuid, integer, integer) to authenticated;
grant execute on function public.vendor_mark_ready(uuid, integer) to authenticated;
grant execute on function public.vendor_reject_order(uuid, integer, text) to authenticated;
grant execute on function public.rider_assign(uuid, text) to service_role;
grant execute on function public.rider_update_location(uuid, double precision, double precision) to service_role;
grant execute on function public.rider_picked_up(uuid) to service_role;
grant execute on function public.rider_delivered(uuid) to service_role;
grant execute on function public.expire_unaccepted_orders() to service_role;

-- 9. Realtime: both apps subscribe to order row changes (RLS still applies).
-- Run once in the dashboard if the publication exists:
--   alter publication supabase_realtime add table public.orders;
