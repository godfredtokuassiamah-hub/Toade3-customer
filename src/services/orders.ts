// Orders: delivery quote, placement (idempotent), cancellation, history.
// Supabase RPCs quote_delivery / place_order / cancel_order and the RLS-
// protected orders + order_items tables (supabase/migrations/0006-0007), or
// a local simulation per BACKEND_MODE (src/lib/backend/fallback.ts).
//
// The SERVER prices everything (integer pesewas). The client sends only
// product / option ids, quantities and notes; totals shown before placement
// are estimates.
//
// listMyOrders / getOrder are ready for the Orders tab (owned by another
// tool) to adopt; this module never reads src/data/mock/orders.ts.
import { getItemsByIds } from "../data/mock/catalog";
import { getVendorLocation } from "../data/mock/vendorLocations";
import { type CartLine, lineTotal } from "../lib/cart/cartStore";
import { SERVICE_CHARGE_MINOR } from "../lib/cart/checkoutTotals";
import { BackendError, mapBackendError } from "../lib/backend/errors";
import {
  checkoutFingerprint,
  checkoutKeys,
  outcomeForError,
} from "../lib/backend/idempotency";
import { backend, unwrap } from "../lib/backend/runner";
import { inFlight } from "../lib/security/clientLimits";
import {
  type LatLng,
  MAX_PAYLOAD_G,
  quoteDelivery as localQuote,
  zoneFor,
} from "../lib/stores/deliveryQuote";
import { supabase } from "../lib/supabase";

export type OrderStatus =
  | "pending"
  | "accepted"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "rejected"
  | "cancelled";

export type DeliveryQuoteDTO =
  | {
      deliverable: true;
      vendorId: string;
      distanceKm: number;
      zone: number;
      feeMinor: number;
      etaMins: readonly [number, number];
      serviceFeeMinor: number;
      // false = local estimate (mock / placeholder), true = server quote.
      authoritative: boolean;
    }
  | { deliverable: false; vendorId: string; distanceKm: number; authoritative: boolean };

export type Dropoff = LatLng & { label: string };

export type PlaceOrderInput = {
  vendorId: string;
  lines: readonly CartLine[];
  dropoff: Dropoff;
  instructions: string;
  tipMinor: number;
};

export type PlacedOrder = {
  orderId: string;
  orderNumber: number | null;
  status: OrderStatus;
  version: number;
  itemsTotalMinor: number;
  deliveryFeeMinor: number;
  serviceFeeMinor: number;
  tipMinor: number;
  totalMinor: number;
  distanceKm: number;
  // Same idempotency key seen before: this is the original order.
  replayed: boolean;
  // Simulated locally (BACKEND_MODE mock / backend not deployed, dev only).
  mock: boolean;
};

export type OrderItemDTO = {
  productId: string | null;
  name: string;
  unitPriceMinor: number;
  options: { id: string; label: string; priceMinor: number }[];
  note: string | null;
  qty: number;
  lineTotalMinor: number;
};

export type OrderSummary = {
  orderId: string;
  orderNumber: number | null;
  status: OrderStatus;
  version: number;
  vendorId: string;
  vendorName: string;
  totalMinor: number;
  itemCount: number;
  createdAt: string;
  mock: boolean;
};

export type OrderDetail = OrderSummary & {
  itemsTotalMinor: number;
  deliveryFeeMinor: number;
  serviceFeeMinor: number;
  tipMinor: number;
  distanceKm: number;
  dropoff: Dropoff;
  instructions: string | null;
  items: OrderItemDTO[];
};

export type CancelResult = { orderId: string; status: OrderStatus; version: number };

// ---- Local estimate / simulation ----

export function localDeliveryQuote(vendorId: string, dropoff: LatLng): DeliveryQuoteDTO {
  const q = localQuote(getVendorLocation(vendorId), dropoff);
  if (!q.deliverable) return { deliverable: false, vendorId, distanceKm: q.distanceKm, authoritative: false };
  return {
    deliverable: true,
    vendorId,
    distanceKm: q.distanceKm,
    zone: zoneFor(q.distanceKm)?.id ?? 4,
    feeMinor: q.feeMinor,
    etaMins: q.etaMins,
    serviceFeeMinor: SERVICE_CHARGE_MINOR,
    authoritative: false,
  };
}

const MOCK_LATENCY_MS = 600;
const mockOrders: OrderDetail[] = [];
const mockByKey = new Map<string, OrderDetail>();
let mockNumber = 1000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function toPlaced(o: OrderDetail, replayed: boolean): PlacedOrder {
  return {
    orderId: o.orderId,
    orderNumber: o.orderNumber,
    status: o.status,
    version: o.version,
    itemsTotalMinor: o.itemsTotalMinor,
    deliveryFeeMinor: o.deliveryFeeMinor,
    serviceFeeMinor: o.serviceFeeMinor,
    tipMinor: o.tipMinor,
    totalMinor: o.totalMinor,
    distanceKm: o.distanceKm,
    replayed,
    mock: o.mock,
  };
}

// Simulates place_order's checks on the mock catalog (dev only).
async function mockPlaceOrder(input: PlaceOrderInput, key: string): Promise<PlacedOrder> {
  if (!__DEV__) {
    // Never fake an order in a production build.
    throw new BackendError("BACKEND_MISSING", "Ordering backend not deployed");
  }
  await sleep(MOCK_LATENCY_MS);
  const existing = mockByKey.get(key);
  if (existing) return toPlaced(existing, true);

  const items = new Map(getItemsByIds(input.lines.map((l) => l.itemId)).map((i) => [i.item_id, i]));
  let weight = 0;
  for (const line of input.lines) {
    const item = items.get(line.itemId);
    if (line.vendorId !== input.vendorId || (item && item.vendor_id !== input.vendorId)) {
      throw new BackendError("MIXED_VENDORS", "MIXED_VENDORS");
    }
    if (!item || item.disabled || item.stock < line.qty || item.weight_g == null) {
      throw new BackendError("ITEM_UNAVAILABLE", "ITEM_UNAVAILABLE");
    }
    weight += item.weight_g * line.qty;
  }
  if (weight > MAX_PAYLOAD_G) throw new BackendError("OVER_WEIGHT", "OVER_WEIGHT");
  const quote = localDeliveryQuote(input.vendorId, input.dropoff);
  if (!quote.deliverable) throw new BackendError("OUT_OF_RADIUS", "OUT_OF_RADIUS");

  const itemsTotal = input.lines.reduce((s, l) => s + lineTotal(l), 0);
  mockNumber += 1;
  const order: OrderDetail = {
    orderId: `mock-${Date.now().toString(36)}`,
    orderNumber: mockNumber,
    status: "pending",
    version: 1,
    vendorId: input.vendorId,
    vendorName: input.lines[0]?.vendorName ?? "",
    itemsTotalMinor: itemsTotal,
    deliveryFeeMinor: quote.feeMinor,
    serviceFeeMinor: quote.serviceFeeMinor,
    tipMinor: input.tipMinor,
    totalMinor: itemsTotal + quote.feeMinor + quote.serviceFeeMinor + input.tipMinor,
    distanceKm: quote.distanceKm,
    itemCount: input.lines.reduce((s, l) => s + l.qty, 0),
    createdAt: new Date().toISOString(),
    dropoff: input.dropoff,
    instructions: input.instructions.trim() || null,
    items: input.lines.map((l) => ({
      productId: l.itemId,
      name: l.name,
      unitPriceMinor: l.unitPriceMinor,
      options: l.options.map((o) => ({ id: o.optionId, label: o.label, priceMinor: o.priceMinor })),
      note: l.note || null,
      qty: l.qty,
      lineTotalMinor: lineTotal(l),
    })),
    mock: true,
  };
  mockOrders.unshift(order);
  mockByKey.set(key, order);
  console.log(`[backend:mock] placeOrder -> simulated order ${order.orderId} (#${order.orderNumber})`);
  return toPlaced(order, false);
}

function summary(o: OrderDetail): OrderSummary {
  const { orderId, orderNumber, status, version, vendorId, vendorName, totalMinor, itemCount, createdAt, mock } = o;
  return { orderId, orderNumber, status, version, vendorId, vendorName, totalMinor, itemCount, createdAt, mock };
}

// ---- Remote rows ----

type Res<T> = { data: T | null; error: unknown; status: number };

type PlaceResult = {
  order_id: string;
  order_number: number | null;
  status: OrderStatus;
  version: number;
  items_total_minor: number;
  delivery_fee_minor: number;
  service_fee_minor: number;
  tip_minor: number;
  total_minor: number;
  distance_km: number | string;
  replayed: boolean;
};

type QuoteResult = {
  vendor_id: string;
  distance_km: number | string;
  zone: number;
  fee_minor: number;
  eta_min: number;
  eta_max: number;
  service_fee_minor: number;
};

type OrderItemRow = {
  product_legacy_id: string | null;
  product_id: string | null;
  name: string;
  unit_price_minor: number;
  options: { id: string; label: string; price_minor: number }[] | null;
  note: string | null;
  qty: number;
  line_total_minor: number;
  sort: number;
};

type OrderRow = {
  id: string;
  order_number: number | null;
  status: OrderStatus;
  version: number;
  total_minor: number;
  created_at: string;
  vendor: { id: string; legacy_id: string | null; name: string } | null;
  order_items: OrderItemRow[] | null;
  items_total_minor?: number;
  delivery_fee_minor?: number;
  service_fee_minor?: number;
  tip_minor?: number;
  distance_km?: number | string;
  dropoff_label?: string;
  dropoff_lat?: number;
  dropoff_lng?: number;
  instructions?: string | null;
};

const SUMMARY_COLUMNS =
  "id, order_number, status, version, total_minor, created_at, vendor:vendor_id(id, legacy_id, name), order_items(qty)";
const DETAIL_COLUMNS =
  "id, order_number, status, version, total_minor, created_at, items_total_minor, delivery_fee_minor, service_fee_minor, tip_minor, distance_km, dropoff_label, dropoff_lat, dropoff_lng, instructions, vendor:vendor_id(id, legacy_id, name), order_items(product_id, product_legacy_id, name, unit_price_minor, options, note, qty, line_total_minor, sort)";

function toSummary(r: OrderRow): OrderSummary {
  return {
    orderId: r.id,
    orderNumber: r.order_number,
    status: r.status,
    version: r.version,
    vendorId: r.vendor ? (r.vendor.legacy_id ?? r.vendor.id) : "",
    vendorName: r.vendor?.name ?? "",
    totalMinor: r.total_minor,
    itemCount: (r.order_items ?? []).reduce((s, i) => s + i.qty, 0),
    createdAt: r.created_at,
    mock: false,
  };
}

function toDetail(r: OrderRow): OrderDetail {
  return {
    ...toSummary(r),
    itemsTotalMinor: r.items_total_minor ?? 0,
    deliveryFeeMinor: r.delivery_fee_minor ?? 0,
    serviceFeeMinor: r.service_fee_minor ?? 0,
    tipMinor: r.tip_minor ?? 0,
    distanceKm: Number(r.distance_km ?? 0),
    dropoff: {
      label: r.dropoff_label ?? "",
      latitude: r.dropoff_lat ?? 0,
      longitude: r.dropoff_lng ?? 0,
    },
    instructions: r.instructions ?? null,
    items: [...(r.order_items ?? [])]
      .sort((a, b) => a.sort - b.sort)
      .map((i) => ({
        productId: i.product_legacy_id ?? i.product_id,
        name: i.name,
        unitPriceMinor: i.unit_price_minor,
        options: (i.options ?? []).map((o) => ({ id: o.id, label: o.label, priceMinor: o.price_minor })),
        note: i.note,
        qty: i.qty,
        lineTotalMinor: i.line_total_minor,
      })),
  };
}

// ---- Public API ----

// Server quote at checkout (authoritative). OUT_OF_RADIUS comes back as
// { deliverable: false } rather than an error, like the local estimate.
export function quoteDelivery(vendorId: string, dropoff: LatLng): Promise<DeliveryQuoteDTO> {
  return backend.run({
    resource: "orders.quote",
    op: "read",
    requiresAuth: true,
    remote: async () => {
      const res = await supabase.rpc("quote_delivery", {
        p_vendor_ref: vendorId,
        p_lat: dropoff.latitude,
        p_lng: dropoff.longitude,
      });
      if (res.error) {
        const err = mapBackendError(res.error, res.status);
        if (err.code === "OUT_OF_RADIUS") {
          let km = Number.NaN;
          try {
            km = Number((JSON.parse(err.details ?? "{}") as { distance_km?: unknown }).distance_km);
          } catch {
            // Keep NaN; the estimate below supplies the distance.
          }
          const distanceKm = Number.isFinite(km) ? km : localDeliveryQuote(vendorId, dropoff).distanceKm;
          return { deliverable: false, vendorId, distanceKm, authoritative: true } as const;
        }
        throw err;
      }
      const q = unwrap(res as unknown as Res<QuoteResult>);
      return {
        deliverable: true,
        vendorId,
        distanceKm: Number(q.distance_km),
        zone: q.zone,
        feeMinor: q.fee_minor,
        etaMins: [q.eta_min, q.eta_max] as const,
        serviceFeeMinor: q.service_fee_minor,
        authoritative: true,
      } as const;
    },
    mock: () => localDeliveryQuote(vendorId, dropoff),
  });
}

// Places the order with an idempotency key that is created once per
// checkout attempt and reused on retries (src/lib/backend/idempotency.ts).
//
// Concurrent calls for the same checkout (double tap) share ONE RPC: the
// de-dupe key is the fingerprint, because two first calls racing through
// getOrCreate could otherwise mint two keys. Never retried automatically;
// a user-initiated retry reuses the stored key. RATE_LIMITED keeps the key.
export function placeOrder(input: PlaceOrderInput): Promise<PlacedOrder> {
  const fingerprint = checkoutFingerprint(input);
  return inFlight.run(`order.place:${fingerprint}`, () => placeOrderOnce(input, fingerprint));
}

async function placeOrderOnce(input: PlaceOrderInput, fingerprint: string): Promise<PlacedOrder> {
  const key = await checkoutKeys.getOrCreate(fingerprint);
  try {
    const placed = await backend.run<PlacedOrder>({
      resource: "orders.place",
      op: "write",
      requiresAuth: true,
      remote: async () => {
        const res = await supabase.rpc("place_order", {
          p_idempotency_key: key,
          p_vendor_ref: input.vendorId,
          p_lines: input.lines.map((l) => ({
            product_id: l.itemId,
            option_ids: l.options.map((o) => o.optionId),
            qty: l.qty,
            note: l.note.trim() || null,
          })),
          p_dropoff_lat: input.dropoff.latitude,
          p_dropoff_lng: input.dropoff.longitude,
          p_dropoff_label: input.dropoff.label.trim() || "Drop-off pin",
          p_instructions: input.instructions.trim() || null,
          p_tip_minor: input.tipMinor,
        });
        const r = unwrap(res as unknown as Res<PlaceResult>);
        return {
          orderId: r.order_id,
          orderNumber: r.order_number,
          status: r.status,
          version: r.version,
          itemsTotalMinor: r.items_total_minor,
          deliveryFeeMinor: r.delivery_fee_minor,
          serviceFeeMinor: r.service_fee_minor,
          tipMinor: r.tip_minor,
          totalMinor: r.total_minor,
          distanceKm: Number(r.distance_km),
          replayed: r.replayed,
          mock: false,
        };
      },
      mock: () => mockPlaceOrder(input, key),
    });
    await checkoutKeys.settle("success");
    return placed;
  } catch (e) {
    const err = mapBackendError(e);
    await checkoutKeys.settle(outcomeForError(err.code));
    throw err;
  }
}

// Identical concurrent cancels share one RPC. Never retried automatically
// (a repeat returns STALE_VERSION anyway).
export function cancelOrder(orderId: string, expectedVersion: number): Promise<CancelResult> {
  return inFlight.run(`order.cancel:${orderId}:${expectedVersion}`, () => cancelOrderOnce(orderId, expectedVersion));
}

function cancelOrderOnce(orderId: string, expectedVersion: number): Promise<CancelResult> {
  return backend.run({
    resource: "orders.cancel",
    op: "write",
    requiresAuth: true,
    remote: async () => {
      const res = await supabase.rpc("cancel_order", {
        p_order_id: orderId,
        p_expected_version: expectedVersion,
      });
      const r = unwrap(res as unknown as Res<{ order_id: string; status: OrderStatus; version: number }>);
      return { orderId: r.order_id, status: r.status, version: r.version };
    },
    mock: () => {
      const o = mockOrders.find((m) => m.orderId === orderId);
      if (!o) throw new BackendError("ORDER_NOT_FOUND", "ORDER_NOT_FOUND");
      if (o.version !== expectedVersion) throw new BackendError("STALE_VERSION", "STALE_VERSION");
      if (o.status !== "pending" && o.status !== "accepted") {
        throw new BackendError("NOT_CANCELLABLE", "NOT_CANCELLABLE");
      }
      o.status = "cancelled";
      o.version += 1;
      return { orderId: o.orderId, status: o.status, version: o.version };
    },
  });
}

// The signed-in customer's orders, newest first (RLS: own rows only).
export function listMyOrders(): Promise<OrderSummary[]> {
  return backend.run({
    resource: "orders.read",
    op: "read",
    requiresAuth: true,
    remote: async () => {
      const res = await supabase
        .from("orders")
        .select(SUMMARY_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(50);
      return unwrap(res as unknown as Res<OrderRow[]>).map(toSummary);
    },
    mock: () => mockOrders.map(summary),
  });
}

export function getOrder(orderId: string): Promise<OrderDetail | null> {
  return backend.run({
    resource: "orders.read",
    op: "read",
    requiresAuth: true,
    remote: async () => {
      if (orderId.startsWith("mock-")) return mockOrders.find((o) => o.orderId === orderId) ?? null;
      const res = await supabase.from("orders").select(DETAIL_COLUMNS).eq("id", orderId).maybeSingle();
      if (res.error) unwrap(res as unknown as Res<null>);
      const row = res.data as unknown as OrderRow | null;
      return row ? toDetail(row) : null;
    },
    mock: () => mockOrders.find((o) => o.orderId === orderId) ?? null,
  });
}
