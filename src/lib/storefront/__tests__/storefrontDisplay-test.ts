/// <reference types="jest" />
import type { MockItem } from "../../discovery/types";
import {
  etaSpanAccessibilityLabel,
  formatEtaSpan,
  formatRating,
  formatRatingCount,
  itemSubtitle,
  maxDiscountPercent,
  originalPriceFromDiscount,
  ratingAccessibilityLabel,
  storefrontDeliveryEstimate,
} from "../storefrontDisplay";

function item(id: string, overrides: Partial<MockItem> = {}): MockItem {
  return {
    item_id: id,
    name: id,
    vendor_id: "v-test",
    scope: "food",
    category_ids: ["snacks"],
    price_minor: 1000,
    stock: 10,
    disabled: false,
    weight_g: 500,
    published: true,
    eta_mins: 10,
    ...overrides,
  };
}

describe("originalPriceFromDiscount", () => {
  test.each([
    [4000, 20, 5000],
    [1500, 10, 1667],
    [3400, 15, 4000],
    [0, 20, 0],
  ])("%d @%d%% -> %d", (current, percent, expected) => {
    expect(originalPriceFromDiscount(current, percent)).toBe(expected);
  });

  test.each([undefined, 0, -5, 91, 100, 12.5, NaN])("invalid percent %p -> null", (p) => {
    expect(originalPriceFromDiscount(4000, p)).toBeNull();
  });

  test("negative price -> null", () => {
    expect(originalPriceFromDiscount(-1, 20)).toBeNull();
  });
});

describe("rating formatting", () => {
  test.each([
    [0, "0"],
    [64, "64"],
    [99, "99"],
    [100, "100+"],
    [640, "600+"],
    [999, "900+"],
    [1000, "1,000+"],
    [5234, "5,000+"],
    [12800, "12,000+"],
  ])("formatRatingCount(%d) -> %s", (count, expected) => {
    expect(formatRatingCount(count)).toBe(expected);
  });

  test("formatRating", () => {
    expect(formatRating({ value: 4.5, count: 5234 })).toBe("4.5 (5,000+)");
    expect(formatRating({ value: 4, count: 64 })).toBe("4.0 (64)");
  });

  test("ratingAccessibilityLabel", () => {
    expect(ratingAccessibilityLabel({ value: 4.5, count: 5234 })).toBe(
      "Rated 4.5 out of 5, more than 5,000 ratings",
    );
    expect(ratingAccessibilityLabel({ value: 4.3, count: 64 })).toBe("Rated 4.3 out of 5, 64 ratings");
    expect(ratingAccessibilityLabel({ value: 5, count: 1 })).toBe("Rated 5.0 out of 5, 1 rating");
  });
});

describe("ETA span", () => {
  test("range uses an en dash", () => {
    expect(formatEtaSpan([15, 20])).toBe("15\u201320 min");
  });
  test("single value", () => {
    expect(formatEtaSpan([20, 20])).toBe("20 min");
  });
  test("spoken labels", () => {
    expect(etaSpanAccessibilityLabel([15, 20])).toBe("Delivery in 15 to 20 minutes");
    expect(etaSpanAccessibilityLabel([20, 20])).toBe("Delivery in about 20 minutes");
  });
});

describe("storefrontDeliveryEstimate (display estimate)", () => {
  test("empty menu -> null", () => {
    expect(storefrontDeliveryEstimate([])).toBeNull();
  });
  test("zone-2 matrix fee and min..max eta", () => {
    expect(
      storefrontDeliveryEstimate([
        item("a", { eta_mins: 20 }),
        item("b", { eta_mins: 15 }),
        item("c", { eta_mins: 18 }),
      ]),
    ).toEqual({ feeMinor: 800, etaMins: [15, 20] });
  });
});

describe("maxDiscountPercent", () => {
  test("highest valid discount", () => {
    expect(
      maxDiscountPercent([
        item("a", { discountPercent: 10 }),
        item("b", { discountPercent: 20 }),
        item("c", { discountPercent: 95 }),
        item("d"),
      ]),
    ).toBe(20);
  });
  test("none -> null", () => {
    expect(maxDiscountPercent([item("a")])).toBeNull();
    expect(maxDiscountPercent([])).toBeNull();
  });
});

describe("itemSubtitle", () => {
  const labels = new Map([["snacks", "Snacks"]]);
  test("category label and eta", () => {
    expect(itemSubtitle(item("a", { eta_mins: 15 }), labels)).toBe("Snacks · 15 mins");
  });
  test("unknown category -> eta only", () => {
    expect(itemSubtitle(item("a", { category_ids: ["nope"] }), labels)).toBe("10 mins");
    expect(itemSubtitle(item("a", { category_ids: [] }), labels)).toBe("10 mins");
  });
});
