// Pure helpers for the "order placed" bottom sheet (OrderPlacedSheet).
// No RN / expo runtime imports so they unit-test in plain jest.
//
// Copy only states what the real order status says: no "on the way" unless
// the status is out_for_delivery, and no ETA unless one came from the server
// delivery quote (the notification spec forbids fabricated states / ETAs).
import type { OrderItemDTO, OrderStatus } from "../../services/orders";

// Icons8 rider-on-scooter (id wCClDpWTvma9), size=300 for a crisp render at
// ~104dp on 3x screens. Loaded remotely on purpose (quality); Icons8 requires
// attribution (README) or a paid licence before release.
export const ORDER_PLACED_ILLUSTRATION_URL =
  "https://img.icons8.com/?size=300&id=wCClDpWTvma9&format=png&color=000000";

export type StatusTone = "success" | "error";

export type OrderStatusCopy = {
  title: string;
  subtitle: string;
  statusLine: string;
  tone: StatusTone;
};

const STATUS_COPY: Record<OrderStatus, OrderStatusCopy> = {
  pending: {
    title: "Order placed",
    subtitle: "Waiting for the restaurant to accept your order",
    statusLine: "Order sent to the restaurant",
    tone: "success",
  },
  accepted: {
    title: "Order placed",
    subtitle: "Your order is confirmed",
    statusLine: "Your order is confirmed",
    tone: "success",
  },
  preparing: {
    title: "Order placed",
    subtitle: "The restaurant is preparing your order",
    statusLine: "Your order is confirmed",
    tone: "success",
  },
  ready: {
    title: "Order placed",
    subtitle: "Your order is ready for a rider to collect",
    statusLine: "Your order is confirmed",
    tone: "success",
  },
  out_for_delivery: {
    title: "Order on the way",
    subtitle: "Your rider is on the way",
    statusLine: "Your order is on the way",
    tone: "success",
  },
  delivered: {
    title: "Order delivered",
    subtitle: "Your order has been delivered",
    statusLine: "Delivered",
    tone: "success",
  },
  rejected: {
    title: "Order declined",
    subtitle: "The restaurant couldn't accept this order",
    statusLine: "Order declined",
    tone: "error",
  },
  cancelled: {
    title: "Order cancelled",
    subtitle: "This order was cancelled",
    statusLine: "Order cancelled",
    tone: "error",
  },
};

export const ORDER_STATUSES = Object.keys(STATUS_COPY) as OrderStatus[];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(STATUS_COPY, value);
}

export function orderStatusCopy(status: OrderStatus): OrderStatusCopy {
  return STATUS_COPY[status];
}

// "#1042", or "#" + the first 8 id chars (mock- prefix stripped), upper-cased.
export function shortOrderRef(orderId: string, orderNumber: number | null): string {
  if (orderNumber != null) return `#${orderNumber}`;
  return `#${orderId.replace(/^mock-/, "").slice(0, 8).toUpperCase()}`;
}

const MAX_ETA_MINS = 240;

function parseMins(value: string | string[] | undefined): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

// Route params -> [min, max] minutes, or null if missing / invalid.
export function parseEtaParams(
  min: string | string[] | undefined,
  max: string | string[] | undefined,
): [number, number] | null {
  const lo = parseMins(min);
  const hi = parseMins(max);
  if (lo == null || hi == null) return null;
  if (lo <= 0 || lo > hi || hi > MAX_ETA_MINS) return null;
  return [lo, hi];
}

export const ETA_FALLBACK = "We'll update you soon";

export function etaText(eta: readonly [number, number] | null): string {
  if (!eta) return ETA_FALLBACK;
  const [lo, hi] = eta;
  return lo === hi ? `${lo} mins` : `${lo}–${hi} mins`;
}

// "" for 0 / 1 items, else "+N more".
export function moreLabel(count: number): string {
  return count > 1 ? `+${count - 1} more` : "";
}

export type ItemCardText = { title: string; itemLine: string; countLine: string };

export function itemCardText(
  vendorName: string,
  items: readonly Pick<OrderItemDTO, "name" | "options">[],
  itemCount: number,
): ItemCardText {
  const first = items[0];
  const title = vendorName.trim() || first?.name || "";
  const more = moreLabel(items.length);
  const itemLine = first ? (more ? `${first.name} ${more}` : first.name) : "";
  const count = Math.max(itemCount, 0);
  const options = first ? first.options.map((o) => o.label).join(", ") : "";
  const countLine = `${count} ${count === 1 ? "item" : "items"}${options ? ` · ${options}` : ""}`;
  return { title, itemLine, countLine };
}

export type SummaryRow = { key: string; label: string; value: string };

// No payment row: no payment-method field exists on orders yet.
export function buildSummaryRows({
  orderRef,
  addressLabel,
  eta,
}: {
  orderRef: string;
  addressLabel: string | null | undefined;
  eta: readonly [number, number] | null;
}): SummaryRow[] {
  const rows: SummaryRow[] = [{ key: "id", label: "Order ID", value: orderRef }];
  const address = addressLabel?.trim();
  if (address) rows.push({ key: "address", label: "Delivery address", value: address });
  rows.push({ key: "eta", label: "Estimated delivery", value: etaText(eta) });
  return rows;
}
