/// <reference types="jest" />
import type { CartLine } from "../cartStore";
import {
  clampExtraCash,
  computeCheckoutTotals,
  EXTRA_CASH_MAX_MINOR,
  roundUpTipMinor,
  SERVICE_CHARGE_MINOR,
  subtotalMinor,
} from "../checkoutTotals";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

function line(over: Partial<CartLine> = {}): CartLine {
  return {
    lineId: "l1",
    itemId: "i1",
    vendorId: "v1",
    vendorName: "Vendor One",
    name: "Jollof",
    unitPriceMinor: 3800,
    options: [{ optionId: "o1", label: "Beef", priceMinor: 500 }],
    note: "",
    qty: 2,
    ...over,
  };
}

describe("checkout totals", () => {
  test("subtotal sums line totals with options", () => {
    expect(subtotalMinor([])).toBe(0);
    expect(subtotalMinor([line(), line({ lineId: "l2", options: [], qty: 1 })])).toBe(8600 + 3800);
  });

  test("round-up tip to the next whole cedi", () => {
    expect(roundUpTipMinor(14320)).toBe(80);
    expect(roundUpTipMinor(14400)).toBe(0);
    expect(roundUpTipMinor(14301)).toBe(99);
  });

  test("extra cash is clamped", () => {
    expect(clampExtraCash(-100)).toBe(0);
    expect(clampExtraCash(250)).toBe(250);
    expect(clampExtraCash(10_000_000)).toBe(EXTRA_CASH_MAX_MINOR);
  });

  test("totals without rider support", () => {
    const t = computeCheckoutTotals({ lines: [line()], deliveryFeeMinor: 800, support: { kind: "none" } });
    expect(t).toEqual({
      subtotalMinor: 8600,
      deliveryFeeMinor: 800,
      serviceChargeMinor: SERVICE_CHARGE_MINOR,
      riderSupportMinor: 0,
      totalMinor: 8600 + 800 + 300,
    });
  });

  test("round up: 143.20 -> 144.00, whole totals add nothing", () => {
    // 13520 + 500 + 300 = 14320.
    const lines = [line({ options: [], unitPriceMinor: 13520, qty: 1 })];
    const t = computeCheckoutTotals({ lines, deliveryFeeMinor: 500, support: { kind: "round_up" } });
    expect(t.riderSupportMinor).toBe(80);
    expect(t.totalMinor).toBe(14400);
    const whole = computeCheckoutTotals({
      lines: [line({ options: [], unitPriceMinor: 13600, qty: 1 })],
      deliveryFeeMinor: 500,
      support: { kind: "round_up" },
    });
    expect(whole.riderSupportMinor).toBe(0);
    expect(whole.totalMinor).toBe(14400);
  });

  test("extra cash and an undeliverable fee", () => {
    const t = computeCheckoutTotals({
      lines: [line()],
      deliveryFeeMinor: null,
      support: { kind: "extra", amountMinor: 200 },
    });
    expect(t.deliveryFeeMinor).toBeNull();
    expect(t.riderSupportMinor).toBe(200);
    expect(t.totalMinor).toBe(8600 + 300 + 200);
  });
});
