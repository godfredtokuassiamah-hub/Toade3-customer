-- 0007_order_functions.sql: fare matrix + quote_delivery, place_order and
-- cancel_order RPCs.
--
-- Run order: after 0006, before 0008 (see supabase/SETUP.md). Re-runnable
-- (`create or replace`, grants are idempotent).
-- UNEXECUTED: written without database access; statically reviewed only.
--
-- All three RPCs are `security definer` with `set search_path = ''` (every
-- name schema-qualified), derive the customer from auth.uid(), validate every
-- input, and are executable by `authenticated` only. Internal helpers (t3_*)
-- are not executable by clients at all.
--
-- Stable errors: raise exception '<CODE>' using errcode = '<SQLSTATE>'.
-- PostgREST returns { code: SQLSTATE, message: CODE, details } with HTTP 400.
-- Keep in sync with src/lib/backend/errors.ts (SQLSTATE_BY_CODE):
--   NOT_AUTHENTICATED       T3001
--   ITEM_UNAVAILABLE        T3002
--   OPTION_INVALID          T3003
--   REQUIRED_OPTION_MISSING T3004
--   MIXED_VENDORS           T3005
--   OUT_OF_RADIUS           T3006
--   OVER_WEIGHT             T3007
--   STALE_VERSION           T3008
--   NOT_CANCELLABLE         T3009
--   INVALID_INPUT           T3010
--   VENDOR_UNAVAILABLE      T3011
--   ORDER_NOT_FOUND         T3012

-- 1. Fare matrix ----------------------------------------------------------------
-- Mirrors src/lib/stores/deliveryQuote.ts; both are checked against
-- src/lib/backend/__fixtures__/fareMatrix.json by fareMatrix-test.ts, which
-- parses the block between the two markers below. Edit all three together.
-- FARE_MATRIX_BEGIN
-- columns: (zone, max_tenths, fee_base_minor, per_tenth_over_40_minor, eta_min, eta_max)
create or replace function public.t3_fare_for_tenths(p_tenths integer)
returns table (zone integer, fee_minor integer, eta_min integer, eta_max integer)
language sql
immutable
set search_path = ''
as $$
  select z.zone,
         z.fee_base + z.per_tenth * greatest(0, p_tenths - 40),
         z.eta_min,
         z.eta_max
  from (values
    (1, 10, 500, 0, 10, 15),
    (2, 25, 800, 0, 15, 25),
    (3, 40, 1200, 0, 25, 35),
    (4, 50, 1200, 25, 35, 45)
  ) as z (zone, max_tenths, fee_base, per_tenth, eta_min, eta_max)
  where p_tenths >= 0 and p_tenths <= z.max_tenths
  order by z.zone
  limit 1
$$;

create or replace function public.t3_max_payload_g()
returns integer
language sql
immutable
set search_path = ''
as $$ select 8000 $$;

create or replace function public.t3_service_fee_minor()
returns integer
language sql
immutable
set search_path = ''
as $$ select 300 $$;
-- FARE_MATRIX_END

-- 2. Geometry helpers -------------------------------------------------------------
-- Haversine, R = 6371 km (same as haversineKm in deliveryQuote.ts).
create or replace function public.t3_haversine_km(
  p_lat1 double precision, p_lng1 double precision,
  p_lat2 double precision, p_lng2 double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 2 * 6371 * asin(least(1, sqrt(
    power(sin(radians(p_lat2 - p_lat1) / 2), 2)
    + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
  )))
$$;

-- Distance in whole tenths of a km, rounded UP (1.04 -> 11). The epsilon
-- matches toTenths() in deliveryQuote.ts.
create or replace function public.t3_price_tenths(p_km double precision)
returns integer
language sql
immutable
set search_path = ''
as $$ select greatest(0, ceil(p_km * 10 - 1e-9))::integer $$;

-- Opening hours {"open":"HH:MM","close":"HH:MM"} in UTC; null = always open.
create or replace function public.t3_vendor_open_now(p_hours jsonb)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_now integer;
  v_open integer;
  v_close integer;
begin
  if p_hours is null then
    return true;
  end if;
  v_now := extract(hour from (now() at time zone 'UTC'))::integer * 60
         + extract(minute from (now() at time zone 'UTC'))::integer;
  v_open := split_part(p_hours ->> 'open', ':', 1)::integer * 60
          + split_part(p_hours ->> 'open', ':', 2)::integer;
  v_close := split_part(p_hours ->> 'close', ':', 1)::integer * 60
           + split_part(p_hours ->> 'close', ':', 2)::integer;
  if v_open = v_close then
    return false;
  end if;
  if v_open < v_close then
    return v_now >= v_open and v_now < v_close;
  end if;
  return v_now >= v_open or v_now < v_close;
end;
$$;

-- Result object shared by place_order (new and replayed).
create or replace function public.t3_order_result(p_order public.orders, p_replayed boolean)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'order_id', p_order.id,
    'order_number', p_order.order_number,
    'status', p_order.status,
    'version', p_order.version,
    'items_total_minor', p_order.items_total_minor,
    'delivery_fee_minor', p_order.delivery_fee_minor,
    'service_fee_minor', p_order.service_fee_minor,
    'tip_minor', p_order.tip_minor,
    'total_minor', p_order.total_minor,
    'distance_km', p_order.distance_km,
    'created_at', p_order.created_at,
    'replayed', p_replayed)
$$;

revoke execute on function public.t3_fare_for_tenths(integer) from public, anon, authenticated;
revoke execute on function public.t3_max_payload_g() from public, anon, authenticated;
revoke execute on function public.t3_service_fee_minor() from public, anon, authenticated;
revoke execute on function public.t3_haversine_km(double precision, double precision, double precision, double precision) from public, anon, authenticated;
revoke execute on function public.t3_price_tenths(double precision) from public, anon, authenticated;
revoke execute on function public.t3_vendor_open_now(jsonb) from public, anon, authenticated;
revoke execute on function public.t3_order_result(public.orders, boolean) from public, anon, authenticated;

-- 3. quote_delivery -----------------------------------------------------------------
-- -> { vendor_id, distance_km, zone, fee_minor, eta_min, eta_max, service_fee_minor }
-- eta = vendor prep range + zone range. OUT_OF_RADIUS over 5.0 km.
create or replace function public.quote_delivery(
  p_vendor_ref text,
  p_lat double precision,
  p_lng double precision)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_vendor public.vendors;
  v_tenths integer;
  v_fare record;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'T3001';
  end if;
  if p_vendor_ref is null or char_length(p_vendor_ref) not between 1 and 80
     or p_lat is null or p_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'INVALID_INPUT' using errcode = 'T3010';
  end if;

  select * into v_vendor
  from public.vendors v
  where (v.legacy_id = p_vendor_ref or v.id::text = p_vendor_ref) and v.published
  limit 1;
  if not found then
    raise exception 'VENDOR_UNAVAILABLE' using errcode = 'T3011',
      detail = jsonb_build_object('vendor', p_vendor_ref)::text;
  end if;

  v_tenths := public.t3_price_tenths(public.t3_haversine_km(v_vendor.lat, v_vendor.lng, p_lat, p_lng));
  select * into v_fare from public.t3_fare_for_tenths(v_tenths);
  if not found then
    raise exception 'OUT_OF_RADIUS' using errcode = 'T3006',
      detail = jsonb_build_object('distance_km', v_tenths / 10.0)::text;
  end if;

  return jsonb_build_object(
    'vendor_id', coalesce(v_vendor.legacy_id, v_vendor.id::text),
    'distance_km', v_tenths / 10.0,
    'zone', v_fare.zone,
    'fee_minor', v_fare.fee_minor,
    'eta_min', v_vendor.prep_min + v_fare.eta_min,
    'eta_max', v_vendor.prep_max + v_fare.eta_max,
    'service_fee_minor', public.t3_service_fee_minor());
end;
$$;

-- 4. place_order ----------------------------------------------------------------------
-- p_lines: [{ "product_id": "<legacy id or uuid>", "option_ids": ["..."],
--             "qty": 1..20, "note": "..." }]  (1..50 lines)
-- One transaction (the function call): any raise rolls everything back.
-- Prices, fees and totals come ONLY from the database; the client sends no
-- prices. A repeated (customer, idempotency key) returns the original order.
create or replace function public.place_order(
  p_idempotency_key uuid,
  p_vendor_ref text,
  p_lines jsonb,
  p_dropoff_lat double precision,
  p_dropoff_lng double precision,
  p_dropoff_label text,
  p_instructions text,
  p_tip_minor integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.orders;
  v_order public.orders;
  v_vendor public.vendors;
  v_product public.products;
  v_line jsonb;
  v_ref text;
  v_qty integer;
  v_note text;
  v_option_refs jsonb;
  v_group record;
  v_stock record;
  v_count integer;
  v_opts_total integer;
  v_opts jsonb;
  v_unit integer;
  v_line_total bigint;
  v_items_total bigint := 0;
  v_weight bigint := 0;
  v_resolved jsonb := '[]'::jsonb;
  v_sort integer := 0;
  v_tenths integer;
  v_fare record;
  v_service integer := public.t3_service_fee_minor();
  v_total bigint;
begin
  -- Caller.
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'T3001';
  end if;
  if p_idempotency_key is null then
    raise exception 'INVALID_INPUT' using errcode = 'T3010',
      detail = '{"field":"idempotency_key"}';
  end if;

  -- Serialise attempts with the same key, then replay if it already exists.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_idempotency_key::text, 0));
  select * into v_existing
  from public.orders o
  where o.customer_id = v_uid and o.idempotency_key = p_idempotency_key;
  if found then
    return public.t3_order_result(v_existing, true);
  end if;

  -- Scalar inputs.
  if p_vendor_ref is null or char_length(p_vendor_ref) not between 1 and 80 then
    raise exception 'INVALID_INPUT' using errcode = 'T3010', detail = '{"field":"vendor"}';
  end if;
  if p_dropoff_lat is null or p_dropoff_lng is null
     or p_dropoff_lat not between -90 and 90 or p_dropoff_lng not between -180 and 180 then
    raise exception 'INVALID_INPUT' using errcode = 'T3010', detail = '{"field":"dropoff"}';
  end if;
  if p_dropoff_label is null or char_length(btrim(p_dropoff_label)) not between 1 and 200 then
    raise exception 'INVALID_INPUT' using errcode = 'T3010', detail = '{"field":"dropoff_label"}';
  end if;
  if p_instructions is not null and char_length(p_instructions) > 500 then
    raise exception 'INVALID_INPUT' using errcode = 'T3010', detail = '{"field":"instructions"}';
  end if;
  if p_tip_minor is null or p_tip_minor not between 0 and 99900 then
    raise exception 'INVALID_INPUT' using errcode = 'T3010', detail = '{"field":"tip_minor"}';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) not between 1 and 50 then
    raise exception 'INVALID_INPUT' using errcode = 'T3010', detail = '{"field":"lines"}';
  end if;

  -- Line shapes (before any cast can fail).
  for v_line in select value from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(v_line) <> 'object'
       or jsonb_typeof(v_line -> 'product_id') is distinct from 'string'
       or char_length(v_line ->> 'product_id') not between 1 and 80
       or jsonb_typeof(v_line -> 'qty') is distinct from 'number'
       -- CASE guards the cast: OR operands have no guaranteed evaluation order.
       or (case when (v_line ->> 'qty') ~ '^[0-9]{1,2}$'
                then (v_line ->> 'qty')::integer else 0 end) not between 1 and 20
       or (v_line ? 'note' and jsonb_typeof(v_line -> 'note') not in ('string', 'null'))
       or char_length(coalesce(v_line ->> 'note', '')) > 200
       or (v_line ? 'option_ids' and jsonb_typeof(v_line -> 'option_ids') not in ('array', 'null')) then
      raise exception 'INVALID_INPUT' using errcode = 'T3010', detail = '{"field":"lines"}';
    end if;
    if jsonb_typeof(v_line -> 'option_ids') = 'array' then
      if jsonb_array_length(v_line -> 'option_ids') > 20
         or exists (
           select 1 from jsonb_array_elements(v_line -> 'option_ids') e
           where jsonb_typeof(e.value) <> 'string' or char_length(e.value #>> '{}') > 80) then
        raise exception 'INVALID_INPUT' using errcode = 'T3010', detail = '{"field":"option_ids"}';
      end if;
    end if;
  end loop;

  -- Vendor: published, not paused, open now.
  select * into v_vendor
  from public.vendors v
  where v.legacy_id = p_vendor_ref or v.id::text = p_vendor_ref
  limit 1;
  if not found or not v_vendor.published or v_vendor.paused
     or not public.t3_vendor_open_now(v_vendor.opening_hours) then
    raise exception 'VENDOR_UNAVAILABLE' using errcode = 'T3011',
      detail = jsonb_build_object('vendor', p_vendor_ref)::text;
  end if;

  -- Lines: resolve, validate and price from the database.
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_ref := v_line ->> 'product_id';
    v_qty := (v_line ->> 'qty')::integer;
    v_note := nullif(btrim(coalesce(v_line ->> 'note', '')), '');
    v_option_refs := case
      when jsonb_typeof(v_line -> 'option_ids') = 'array' then v_line -> 'option_ids'
      else '[]'::jsonb end;

    -- Lock the product row: stock is decremented below.
    select * into v_product
    from public.products p
    where p.legacy_id = v_ref or p.id::text = v_ref
    limit 1
    for update;
    if not found then
      raise exception 'ITEM_UNAVAILABLE' using errcode = 'T3002',
        detail = jsonb_build_object('product', v_ref)::text;
    end if;
    if v_product.vendor_id <> v_vendor.id then
      raise exception 'MIXED_VENDORS' using errcode = 'T3005',
        detail = jsonb_build_object('product', v_ref)::text;
    end if;
    if not v_product.published or v_product.disabled
       or v_product.weight_g is null or v_product.weight_g <= 0 or v_product.stock < 1 then
      raise exception 'ITEM_UNAVAILABLE' using errcode = 'T3002',
        detail = jsonb_build_object('product', v_ref)::text;
    end if;

    -- Options: no duplicates, every ref belongs to THIS product.
    select count(*) - count(distinct e.ref) into v_count
    from jsonb_array_elements_text(v_option_refs) as e (ref);
    if v_count > 0 then
      raise exception 'OPTION_INVALID' using errcode = 'T3003',
        detail = jsonb_build_object('product', v_ref)::text;
    end if;
    select count(*) into v_count
    from jsonb_array_elements_text(v_option_refs) as e (ref)
    where not exists (
      select 1
      from public.options o
      join public.option_groups g on g.id = o.group_id
      where g.product_id = v_product.id
        and (o.legacy_id = e.ref or o.id::text = e.ref));
    if v_count > 0 then
      raise exception 'OPTION_INVALID' using errcode = 'T3003',
        detail = jsonb_build_object('product', v_ref)::text;
    end if;

    -- Group bounds: required groups need >= min_select, nobody exceeds max.
    for v_group in
      select g.title, g.min_select, g.max_select,
             (select count(*)
              from public.options o
              where o.group_id = g.id
                and exists (
                  select 1 from jsonb_array_elements_text(v_option_refs) as e (ref)
                  where e.ref = o.legacy_id or e.ref = o.id::text)) as picked
      from public.option_groups g
      where g.product_id = v_product.id
      order by g.sort
    loop
      if v_group.picked < v_group.min_select then
        raise exception 'REQUIRED_OPTION_MISSING' using errcode = 'T3004',
          detail = jsonb_build_object('product', v_ref, 'group', v_group.title)::text;
      end if;
      if v_group.picked > v_group.max_select then
        raise exception 'OPTION_INVALID' using errcode = 'T3003',
          detail = jsonb_build_object('product', v_ref, 'group', v_group.title)::text;
      end if;
    end loop;

    -- Price + snapshot of the chosen options (database prices only).
    select coalesce(sum(o.price_minor), 0)::integer,
           coalesce(jsonb_agg(jsonb_build_object(
             'id', o.legacy_id, 'label', o.label, 'price_minor', o.price_minor)
             order by g.sort, o.sort), '[]'::jsonb)
      into v_opts_total, v_opts
    from public.options o
    join public.option_groups g on g.id = o.group_id
    where g.product_id = v_product.id
      and exists (
        select 1 from jsonb_array_elements_text(v_option_refs) as e (ref)
        where e.ref = o.legacy_id or e.ref = o.id::text);

    v_unit := v_product.price_minor;
    v_line_total := (v_unit::bigint + v_opts_total) * v_qty;
    v_items_total := v_items_total + v_line_total;
    v_weight := v_weight + v_product.weight_g::bigint * v_qty;
    v_resolved := v_resolved || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'legacy_id', v_product.legacy_id,
      'name', v_product.name,
      'unit', v_unit,
      'options', v_opts,
      'note', v_note,
      'qty', v_qty,
      'line_total', v_line_total,
      'sort', v_sort));
    v_sort := v_sort + 1;
  end loop;

  -- Stock for the summed quantity per product (rows are locked above).
  for v_stock in
    select (r.value ->> 'product_id')::uuid as product_id,
           sum((r.value ->> 'qty')::integer) as qty
    from jsonb_array_elements(v_resolved) r
    group by 1
  loop
    if (select p.stock from public.products p where p.id = v_stock.product_id) < v_stock.qty then
      raise exception 'ITEM_UNAVAILABLE' using errcode = 'T3002',
        detail = jsonb_build_object('product', v_stock.product_id)::text;
    end if;
  end loop;

  -- Payload limit.
  if v_weight > public.t3_max_payload_g() then
    raise exception 'OVER_WEIGHT' using errcode = 'T3007',
      detail = jsonb_build_object('weight_g', v_weight)::text;
  end if;

  -- Delivery fee from the fare matrix (server-side distance).
  v_tenths := public.t3_price_tenths(
    public.t3_haversine_km(v_vendor.lat, v_vendor.lng, p_dropoff_lat, p_dropoff_lng));
  select * into v_fare from public.t3_fare_for_tenths(v_tenths);
  if not found then
    raise exception 'OUT_OF_RADIUS' using errcode = 'T3006',
      detail = jsonb_build_object('distance_km', v_tenths / 10.0)::text;
  end if;

  v_total := v_items_total + v_fare.fee_minor + v_service + p_tip_minor;
  if v_total > 2147483647 then
    raise exception 'INVALID_INPUT' using errcode = 'T3010', detail = '{"field":"total"}';
  end if;

  -- Order row. The unique (customer_id, idempotency_key) constraint is the
  -- last line of defence if two calls slip past the advisory lock.
  begin
    insert into public.orders (
      customer_id, vendor_id, status, version,
      items_total_minor, delivery_fee_minor, service_fee_minor, tip_minor, total_minor,
      distance_km, dropoff_label, dropoff_lat, dropoff_lng, instructions, idempotency_key)
    values (
      v_uid, v_vendor.id, 'pending', 1,
      v_items_total::integer, v_fare.fee_minor, v_service, p_tip_minor, v_total::integer,
      v_tenths / 10.0, btrim(p_dropoff_label), p_dropoff_lat, p_dropoff_lng,
      nullif(btrim(coalesce(p_instructions, '')), ''), p_idempotency_key)
    returning * into v_order;
  exception
    when unique_violation then
      select * into v_existing
      from public.orders o
      where o.customer_id = v_uid and o.idempotency_key = p_idempotency_key;
      return public.t3_order_result(v_existing, true);
  end;

  insert into public.order_items (
    order_id, product_id, product_legacy_id, name, unit_price_minor,
    options, note, qty, line_total_minor, sort)
  select v_order.id,
         (r.value ->> 'product_id')::uuid,
         r.value ->> 'legacy_id',
         r.value ->> 'name',
         (r.value ->> 'unit')::integer,
         r.value -> 'options',
         r.value ->> 'note',
         (r.value ->> 'qty')::integer,
         (r.value ->> 'line_total')::integer,
         (r.value ->> 'sort')::integer
  from jsonb_array_elements(v_resolved) r;

  update public.products p
  set stock = p.stock - s.qty
  from (
    select (r.value ->> 'product_id')::uuid as product_id,
           sum((r.value ->> 'qty')::integer) as qty
    from jsonb_array_elements(v_resolved) r
    group by 1
  ) s
  where p.id = s.product_id;

  return public.t3_order_result(v_order, false);
end;
$$;

-- 5. cancel_order ---------------------------------------------------------------------
-- Customer cancel only while pending / accepted, and only at the version the
-- client last saw (STALE_VERSION when the vendor moved it on meanwhile).
-- Restores the stock taken by place_order.
create or replace function public.cancel_order(p_order_id uuid, p_expected_version integer)
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
  if p_order_id is null or p_expected_version is null or p_expected_version < 1 then
    raise exception 'INVALID_INPUT' using errcode = 'T3010';
  end if;

  select * into v_order
  from public.orders o
  where o.id = p_order_id and o.customer_id = v_uid
  for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'T3012';
  end if;
  if v_order.version <> p_expected_version then
    raise exception 'STALE_VERSION' using errcode = 'T3008',
      detail = jsonb_build_object('version', v_order.version, 'status', v_order.status)::text;
  end if;
  if v_order.status not in ('pending', 'accepted') then
    raise exception 'NOT_CANCELLABLE' using errcode = 'T3009',
      detail = jsonb_build_object('status', v_order.status)::text;
  end if;

  update public.orders o
  set status = 'cancelled', version = o.version + 1, cancelled_at = now()
  where o.id = v_order.id
  returning * into v_order;

  update public.products p
  set stock = p.stock + s.qty
  from (
    select i.product_id, sum(i.qty) as qty
    from public.order_items i
    where i.order_id = v_order.id and i.product_id is not null
    group by i.product_id
  ) s
  where p.id = s.product_id;

  return jsonb_build_object(
    'order_id', v_order.id,
    'status', v_order.status,
    'version', v_order.version);
end;
$$;

-- 6. Grants: signed-in customers only ---------------------------------------------------
revoke execute on function public.quote_delivery(text, double precision, double precision)
  from public, anon;
revoke execute on function public.place_order(uuid, text, jsonb, double precision, double precision, text, text, integer)
  from public, anon;
revoke execute on function public.cancel_order(uuid, integer)
  from public, anon;

grant execute on function public.quote_delivery(text, double precision, double precision)
  to authenticated;
grant execute on function public.place_order(uuid, text, jsonb, double precision, double precision, text, text, integer)
  to authenticated;
grant execute on function public.cancel_order(uuid, integer)
  to authenticated;
