// Pure rules for the order tracking screen (order/[id].tsx). No RN / expo
// runtime imports so they unit-test in plain jest.
//
// Lifecycle the customer sees:
//   pending (waiting for the store) -> accepted -> preparing -> ready
//   -> out_for_delivery -> delivered, or rejected / cancelled.
// The customer can cancel ONLY while the order is pending: once the store
// accepts, the kitchen has started and the Cancel button is disabled. (The
// server also allows "accepted"; the app is deliberately stricter.)
//
// Copy only states what the real status says: no rider names and no ETA
// unless one came from the server delivery quote.
import type { BackendErrorCode } from "../backend/errors";
import type { OrderStatus } from "../../services/orders";
import type { Eta } from "./etaModel";

// Icons8 (id XrEFnp33pJYw) hero art while waiting for the store to confirm.
// size=300 for a crisp render at ~112dp on 3x screens. Loaded remotely like
// ORDER_PLACED_ILLUSTRATION_URL; Icons8 requires attribution (README) or a
// paid licence before release.
export const WAITING_ILLUSTRATION_URL =
  "https://img.icons8.com/?size=300&id=XrEFnp33pJYw&format=png&color=000000";

export type TrackingTone = "waiting" | "active" | "done" | "error";

export type TrackingCopy = {
  title: string;
  // Banner under the title.
  banner: string;
  tone: TrackingTone;
};

// extra.rider: the assigned platform rider's first name (real data only).
// extra.rejectReason: vendor reason / "no_response" from the accept timeout.
export function trackingCopy(
  status: OrderStatus,
  vendorName: string,
  extra: { rider?: string | null; rejectReason?: string | null } = {},
): TrackingCopy {
  const store = vendorName.trim() || "The store";
  const rider = extra.rider?.trim();
  if (rider) {
    if (status === "accepted" || status === "preparing") {
      return { title: "Preparing order", banner: `${rider} is heading to ${store}`, tone: "active" };
    }
    if (status === "ready") {
      return { title: "Ready for pickup", banner: `${rider} is picking up your order`, tone: "active" };
    }
    if (status === "out_for_delivery") {
      return { title: "On the way", banner: `${rider} is on the way to you`, tone: "active" };
    }
  }
  if (status === "rejected" && extra.rejectReason) {
    const why: Record<string, string> = {
      no_response: `${store} didn't respond in time. You won't be charged.`,
      busy: `${store} is too busy right now. You won't be charged.`,
      closed: `${store} has closed for now. You won't be charged.`,
      item_unavailable: `${store} ran out of something you ordered. You won't be charged.`,
    };
    const banner = why[extra.rejectReason];
    if (banner) return { title: "Order declined", banner, tone: "error" };
  }
  switch (status) {
    case "pending":
      return {
        title: "Waiting for confirmation",
        banner: `Waiting for ${store} to accept your order. You can cancel until they do.`,
        tone: "waiting",
      };
    case "accepted":
      return { title: "Order confirmed", banner: `${store} accepted your order`, tone: "active" };
    case "preparing":
      return { title: "Preparing order", banner: `${store} is preparing your order`, tone: "active" };
    case "ready":
      return { title: "Ready for pickup", banner: "Waiting for a rider to collect your order", tone: "active" };
    case "out_for_delivery":
      return { title: "On the way", banner: "Your rider is on the way to you", tone: "active" };
    case "delivered":
      return { title: "Delivered", banner: "Your order was delivered. Enjoy!", tone: "done" };
    case "rejected":
      return { title: "Order declined", banner: `${store} couldn't accept this order`, tone: "error" };
    case "cancelled":
      return { title: "Order cancelled", banner: "This order was cancelled", tone: "error" };
  }
}

export function canCancel(status: OrderStatus): boolean {
  return status === "pending";
}

export function isTerminal(status: OrderStatus): boolean {
  return status === "delivered" || status === "rejected" || status === "cancelled";
}

export const TRACKING_STEPS = ["Confirmed", "Preparing", "On the way", "Delivered"] as const;

// Index of the current step in TRACKING_STEPS (-1 = waiting for the store),
// or null when the order ended without delivery (no progress bar).
export function stepIndex(status: OrderStatus): number | null {
  switch (status) {
    case "pending":
      return -1;
    case "accepted":
      return 0;
    case "preparing":
    case "ready":
      return 1;
    case "out_for_delivery":
      return 2;
    case "delivered":
      return 3;
    default:
      return null;
  }
}

// "10:45 AM" in device local time (no Intl: identical on Hermes everywhere).
export function formatClock(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h % 12 || 12}:${m < 10 ? "0" : ""}${m} ${h < 12 ? "AM" : "PM"}`;
}

// "Arriving at 10:45 AM – 10:50 AM" from placement time + the server ETA,
// or null when there is no ETA, the date is invalid, or the order is over.
export function arrivalText(
  createdAt: string,
  eta: readonly [number, number] | null,
  status: OrderStatus,
): string | null {
  if (!eta || isTerminal(status)) return null;
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return null;
  const lo = formatClock(new Date(t + eta[0] * 60_000));
  const hi = formatClock(new Date(t + eta[1] * 60_000));
  return lo === hi ? `Arriving at ${lo}` : `Arriving at ${lo} \u2013 ${hi}`;
}

// "10:50 AM" for the map's "Dropoff by" bubble: placement time + the upper
// ETA bound. null without a server ETA or once the order has ended.
export function dropoffByText(
  createdAt: string,
  eta: readonly [number, number] | null,
  status: OrderStatus,
): string | null {
  if (!eta || isTerminal(status)) return null;
  const t = Date.parse(createdAt);
  return Number.isNaN(t) ? null : formatClock(new Date(t + eta[1] * 60_000));
}

export type MapPoint = { latitude: number; longitude: number };

// True for a usable coordinate (rejects the 0,0 placeholder and NaN).
export function isRealPoint(p: MapPoint | null | undefined): p is MapPoint {
  return (
    !!p &&
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    !(p.latitude === 0 && p.longitude === 0) &&
    Math.abs(p.latitude) <= 90 &&
    Math.abs(p.longitude) <= 180
  );
}

// Gently curved store -> drop-off line for the tracking map: a quadratic
// Bezier whose control point is pushed sideways by `bend` x the distance.
// Illustrative only (not a road route); first point = a, last = b.
export function curvedPath(a: MapPoint, b: MapPoint, segments = 24, bend = 0.2): MapPoint[] {
  const midLat = (a.latitude + b.latitude) / 2;
  const midLng = (a.longitude + b.longitude) / 2;
  // Perpendicular to a -> b.
  const ctrl = {
    latitude: midLat - (b.longitude - a.longitude) * bend,
    longitude: midLng + (b.latitude - a.latitude) * bend,
  };
  const n = Math.max(1, Math.floor(segments));
  const out: MapPoint[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const u = 1 - t;
    out.push({
      latitude: u * u * a.latitude + 2 * u * t * ctrl.latitude + t * t * b.latitude,
      longitude: u * u * a.longitude + 2 * u * t * ctrl.longitude + t * t * b.longitude,
    });
  }
  return out;
}

export function cancelErrorMessage(code: BackendErrorCode): string {
  switch (code) {
    case "STALE_VERSION":
    case "NOT_CANCELLABLE":
      return "The store has already accepted your order, so it can't be cancelled now.";
    case "NETWORK":
      return "Couldn't reach Toade3. Check your connection and try again.";
    case "RATE_LIMITED":
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return "Couldn't cancel the order. Please try again.";
  }
}

export type EtaLabels = {
  // Hero line: "Arriving at 10:45 AM – 10:50 AM", "About 25–35 min once the
  // store accepts", or "Running late · now 11:05 AM – 11:10 AM".
  arrival: string | null;
  // Map bubble: upper bound of the window ("10:50 AM").
  dropoffBy: string | null;
  late: boolean;
};

export function etaLabels(eta: Eta): EtaLabels {
  if (eta.kind === "duration") {
    const [a, b] = eta.mins;
    return { arrival: `About ${a}\u2013${b} min once the store accepts`, dropoffBy: null, late: false };
  }
  if (eta.kind === "window") {
    const lo = formatClock(new Date(eta.from));
    const hi = formatClock(new Date(eta.to));
    const range = lo === hi ? lo : `${lo} \u2013 ${hi}`;
    return {
      arrival: eta.late ? `Running late \u00b7 now ${range}` : `Arriving at ${range}`,
      dropoffBy: hi,
      late: eta.late,
    };
  }
  return { arrival: null, dropoffBy: null, late: false };
}

// "The store has until 10:23 AM to accept" (pending only).
export function acceptDeadlineText(deadline: number | null, now: number): string | null {
  if (deadline == null || deadline <= now) return null;
  return `The store has until ${formatClock(new Date(deadline))} to accept`;
}