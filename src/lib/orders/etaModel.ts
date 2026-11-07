// Delivery-time model (Uber Eats / Bolt Food style). Pure, no RN imports.
//
// Arrival = when the food leaves the store + ride to the customer + handover.
// "Leaves the store" = the later of: food ready, platform rider at the store
// (the rider is dispatched while the kitchen cooks, as Uber/Bolt do).
//
// Each leg uses real data once it exists, so the window narrows as the order
// moves on:
//   pending           duration only ("25-35 min"), never a clock time: the
//                     store hasn't committed to anything yet
//   accepted/preparing ready_by (the vendor's prep promise, plus slack)
//   ready             rider -> store (live km when a rider is assigned)
//   out_for_delivery  rider -> customer (live km), else pickup + ride
//   ended             no estimate
//
// Never shows a time in the past: every leg is clamped to start at `now`.
// `late` = the new window ends after what was promised at accept.
//
// The server (supabase/migrations/0010_order_eta.sql, public.t3_order_eta)
// runs the same model and is authoritative; this copy renders mock orders,
// and covers the gap before 0010 is deployed. The constants below are checked
// against the SQL by etaModel-sql-test.ts: edit both together.
import type { OrderStatus } from "../../services/orders";

export const ETA_MODEL = {
  // Store reaction time after the order lands on the vendor tablet.
  acceptMin: 2,
  acceptMax: 5,
  // Unanswered orders are rejected after this (server job).
  acceptTimeoutMins: 8,
  // Haversine -> road distance.
  roadFactor: 1.35,
  // Motorbike speed in Accra traffic: fast bound / slow bound.
  speedFastKmh: 24,
  speedSlowKmh: 16,
  // Parking, finding the door, handing over.
  handoverMin: 2,
  handoverMax: 4,
  // Rider reaching the store when no live rider position is known.
  riderToStoreMin: 3,
  riderToStoreMax: 8,
  // Kitchens run over: the window's upper side gets this past ready_by.
  prepSlackMins: 5,
  // Narrowest window shown ("10:45-10:50").
  minWindowMins: 5,
} as const;

// Vendor app accept screen: "Ready in ..." choices (store default preselected).
export const PREP_CHOICES = [5, 10, 15, 20, 25, 30, 45, 60] as const;
// Vendor app "Need more time" choices.
export const DELAY_CHOICES = [5, 10, 15] as const;

const MIN = 60_000;

export type EtaInput = {
  status: OrderStatus;
  now: number;
  // Store -> drop-off straight-line km (orders.distance_km).
  distanceKm: number;
  // Store default prep range (vendors.prep_min/max), used before accept.
  prepMins: readonly [number, number];
  acceptedAt: number | null;
  readyBy: number | null;
  pickedUpAt: number | null;
  // Live rider distances, null when no rider / no fix.
  riderToStoreKm: number | null;
  riderToDropKm: number | null;
  // eta_to promised at accept (late detection).
  promisedTo: number | null;
};

export type Eta =
  | { kind: "none" }
  | { kind: "duration"; mins: readonly [number, number] }
  | { kind: "window"; from: number; to: number; basis: "store" | "rider"; late: boolean };

// Ride minutes for straight-line km: [fast, slow].
export function rideMins(km: number): [number, number] {
  const road = Math.max(0, km) * ETA_MODEL.roadFactor;
  return [(road / ETA_MODEL.speedFastKmh) * 60, (road / ETA_MODEL.speedSlowKmh) * 60];
}

function riderToStore(km: number | null): [number, number] {
  if (km == null) return [ETA_MODEL.riderToStoreMin, ETA_MODEL.riderToStoreMax];
  return rideMins(km);
}

const floor5 = (n: number) => Math.floor(n / 5) * 5;
const ceil5 = (n: number) => Math.ceil(n / 5) * 5;

function window(input: EtaInput, from: number, to: number, basis: "store" | "rider"): Eta {
  // Whole minutes, never before now, never narrower than minWindowMins.
  let lo = Math.floor(Math.max(from, input.now) / MIN) * MIN;
  let hi = Math.ceil(Math.max(to, input.now) / MIN) * MIN;
  if (hi - lo < ETA_MODEL.minWindowMins * MIN) hi = lo + ETA_MODEL.minWindowMins * MIN;
  const late = input.promisedTo != null && hi > input.promisedTo + 2 * MIN;
  if (lo > hi) lo = hi;
  return { kind: "window", from: lo, to: hi, basis, late };
}

export function computeEta(input: EtaInput): Eta {
  const m = ETA_MODEL;
  const { now } = input;
  const [rideLo, rideHi] = rideMins(input.distanceKm);
  const [prepLo, prepHi] = input.prepMins;

  switch (input.status) {
    case "pending": {
      const [rLo, rHi] = riderToStore(null);
      const lo = m.acceptMin + Math.max(prepLo, rLo) + rideLo + m.handoverMin;
      const hi = m.acceptMax + Math.max(prepHi, rHi) + rideHi + m.handoverMax;
      const a = Math.max(5, floor5(lo));
      return { kind: "duration", mins: [a, Math.max(a + 5, ceil5(hi))] };
    }
    case "accepted":
    case "preparing": {
      const accepted = input.acceptedAt ?? now;
      const readyLo = input.readyBy ?? accepted + prepLo * MIN;
      const readyHi = (input.readyBy ?? accepted + prepHi * MIN) + m.prepSlackMins * MIN;
      const [rLo, rHi] = riderToStore(input.riderToStoreKm);
      const departLo = Math.max(readyLo, now + rLo * MIN);
      const departHi = Math.max(readyHi, now + rHi * MIN);
      return window(
        input,
        departLo + (rideLo + m.handoverMin) * MIN,
        departHi + (rideHi + m.handoverMax) * MIN,
        "store",
      );
    }
    case "ready": {
      const [rLo, rHi] = riderToStore(input.riderToStoreKm);
      return window(
        input,
        now + (rLo + rideLo + m.handoverMin) * MIN,
        now + (rHi + rideHi + m.handoverMax) * MIN,
        "store",
      );
    }
    case "out_for_delivery": {
      if (input.riderToDropKm != null) {
        const [lo, hi] = rideMins(input.riderToDropKm);
        return window(
          input,
          now + (lo + m.handoverMin) * MIN,
          now + (hi + m.handoverMax) * MIN,
          "rider",
        );
      }
      const picked = input.pickedUpAt ?? now;
      return window(
        input,
        picked + (rideLo + m.handoverMin) * MIN,
        picked + (rideHi + m.handoverMax) * MIN,
        "store",
      );
    }
    default:
      return { kind: "none" };
  }
}
