// Pure helpers for the Orders tab (Uber Eats / Bolt Food style). No RN
// imports (unit-tested).
//
// "In progress" = not delivered / declined / cancelled (shown on top, live).
// "Past" = everything else, newest first, in day sections.
import type { OrderStatus, OrderSummary } from "../../services/orders";
import { formatClock } from "./orderTracking";

export const ACTIVE_STATUSES: ReadonlySet<OrderStatus> = new Set([
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
]);

export function isActive(status: OrderStatus): boolean {
  return ACTIVE_STATUSES.has(status);
}

export type HistorySection = { key: string; title: string; orders: OrderSummary[] };

export function splitOrders(orders: readonly OrderSummary[]): {
  active: OrderSummary[];
  past: OrderSummary[];
} {
  const byNewest = [...orders].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return {
    active: byNewest.filter((o) => isActive(o.status)),
    past: byNewest.filter((o) => !isActive(o.status)),
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// "Today", "Yesterday", "Mon, 12 Oct" (this year) or "12 Oct 2025".
export function dayTitle(d: Date, now: Date): string {
  if (dayKey(d) === dayKey(now)) return "Today";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (dayKey(d) === dayKey(y)) return "Yesterday";
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? `${DAYS[d.getDay()]}, ${base}` : `${base} ${d.getFullYear()}`;
}

// Past orders grouped by local day, newest day first (input already sorted).
export function groupByDay(orders: readonly OrderSummary[], now: Date): HistorySection[] {
  const out: HistorySection[] = [];
  for (const o of orders) {
    const d = new Date(o.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = dayKey(d);
    let section = out[out.length - 1];
    if (!section || section.key !== key) {
      section = { key, title: dayTitle(d, now), orders: [] };
      out.push(section);
    }
    section.orders.push(o);
  }
  return out;
}

export type Badge = { label: string; tone: "success" | "error" | "active" };

export function statusBadge(status: OrderStatus): Badge {
  switch (status) {
    case "delivered":
      return { label: "Delivered", tone: "success" };
    case "cancelled":
      return { label: "Cancelled", tone: "error" };
    case "rejected":
      return { label: "Declined", tone: "error" };
    case "pending":
      return { label: "Waiting for store", tone: "active" };
    case "accepted":
    case "preparing":
      return { label: "Preparing", tone: "active" };
    case "ready":
      return { label: "Ready for pickup", tone: "active" };
    case "out_for_delivery":
      return { label: "On the way", tone: "active" };
  }
}

// "2 items · 3:15 PM"
export function cardMeta(o: Pick<OrderSummary, "itemCount" | "createdAt">): string {
  const items = `${o.itemCount} ${o.itemCount === 1 ? "item" : "items"}`;
  const d = new Date(o.createdAt);
  return Number.isNaN(d.getTime()) ? items : `${items} \u00b7 ${formatClock(d)}`;
}

// Delivered / cancelled orders can be reordered; an order still in progress
// can't (Uber/Bolt hide "Order again" until it's over).
export function canReorder(status: OrderStatus): boolean {
  return !isActive(status);
}
