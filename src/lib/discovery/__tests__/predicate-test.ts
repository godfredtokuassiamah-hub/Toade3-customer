/// <reference types="jest" />
import { vendorOpenAt } from "../predicate";
import type { MockVendor } from "../types";

// vendorOpenAt reads UTC (Accra is UTC+0), so Dates are built with Date.UTC.
function vendor(open: string, close: string, paused = false): MockVendor {
  return { vendor_id: "v-test", name: "Test", hours: { open, close }, paused };
}

function at(hours: number, minutes = 0): Date {
  return new Date(Date.UTC(2024, 0, 1, hours, minutes));
}

describe("vendorOpenAt", () => {
  it("is open mid-window", () => {
    expect(vendorOpenAt(vendor("07:00", "22:00"), at(12))).toBe(true);
  });

  it("is closed before opening", () => {
    expect(vendorOpenAt(vendor("07:00", "22:00"), at(6))).toBe(false);
  });

  it("is closed at/after closing", () => {
    expect(vendorOpenAt(vendor("07:00", "22:00"), at(22))).toBe(false);
    expect(vendorOpenAt(vendor("07:00", "22:00"), at(23))).toBe(false);
  });

  it("is closed when paused regardless of hours", () => {
    expect(vendorOpenAt(vendor("07:00", "22:00", true), at(12))).toBe(false);
  });

  it("is closed when open equals close", () => {
    expect(vendorOpenAt(vendor("09:00", "09:00"), at(9))).toBe(false);
  });

  it("handles overnight wrap (close < open)", () => {
    const v = vendor("20:00", "04:00");
    expect(vendorOpenAt(v, at(23))).toBe(true); // late evening
    expect(vendorOpenAt(v, at(2))).toBe(true); // early morning
    expect(vendorOpenAt(v, at(12))).toBe(false); // midday gap
  });
});
