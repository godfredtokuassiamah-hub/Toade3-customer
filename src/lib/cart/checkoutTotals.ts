// Checkout price summary. Pure functions, integer pesewas only.
//
// DISPLAY ESTIMATES: the server quote (quote_id) is authoritative when
// placing an order; these numbers are never charged.
import { type CartLine, lineTotal } from "./cartStore";

// TODO(checkout): mock service charge until the pricing service exists.
export const SERVICE_CHARGE_MINOR = 300;
// Rider-support "Add extra cash" step (GHS 1.00) and cap (GHS 999.00).
export const EXTRA_CASH_STEP_MINOR = 100;
export const EXTRA_CASH_MAX_MINOR = 99900;

export type RiderSupport =
  | { kind: "none" }
  | { kind: "round_up" }
  | { kind: "extra"; amountMinor: number };

export type CheckoutTotals = {
  subtotalMinor: number;
  // null = not deliverable (too far); counts as 0 in the total.
  deliveryFeeMinor: number | null;
  serviceChargeMinor: number;
  riderSupportMinor: number;
  totalMinor: number;
};

export function subtotalMinor(lines: readonly CartLine[]): number {
  return lines.reduce((s, l) => s + lineTotal(l), 0);
}

// Tip that rounds `totalMinor` up to the next whole cedi: 14320 -> 80,
// 14400 -> 0.
export function roundUpTipMinor(totalMinor: number): number {
  const rest = totalMinor % 100;
  return rest === 0 ? 0 : 100 - rest;
}

// Extra cash clamped to [0, max], whole pesewas.
export function clampExtraCash(amountMinor: number): number {
  return Math.min(EXTRA_CASH_MAX_MINOR, Math.max(0, Math.round(amountMinor)));
}

export function computeCheckoutTotals(input: {
  lines: readonly CartLine[];
  deliveryFeeMinor: number | null;
  support: RiderSupport;
  serviceChargeMinor?: number;
}): CheckoutTotals {
  const sub = subtotalMinor(input.lines);
  const service = input.serviceChargeMinor ?? SERVICE_CHARGE_MINOR;
  const base = sub + (input.deliveryFeeMinor ?? 0) + service;
  let rider = 0;
  if (input.support.kind === "round_up") rider = roundUpTipMinor(base);
  else if (input.support.kind === "extra") rider = clampExtraCash(input.support.amountMinor);
  return {
    subtotalMinor: sub,
    deliveryFeeMinor: input.deliveryFeeMinor,
    serviceChargeMinor: service,
    riderSupportMinor: rider,
    totalMinor: base + rider,
  };
}
