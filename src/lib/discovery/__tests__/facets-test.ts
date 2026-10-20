/// <reference types="jest" />
import { bucketOverlaps, buildPriceHistogram, categoryFacets } from "../facets";

describe("buildPriceHistogram", () => {
  test("empty set: no buckets, null bounds", () => {
    expect(buildPriceHistogram([], 20)).toEqual({ buckets: [], min: null, max: null });
  });

  test("one distinct price: one bucket, no divide-by-zero", () => {
    expect(buildPriceHistogram([1500, 1500, 1500], 20)).toEqual({
      buckets: [{ lower: 1500, upper: 1500, count: 3 }],
      min: 1500,
      max: 1500,
    });
  });

  test("<= 20 integer buckets, contiguous, last includes upper, each price once", () => {
    const prices = [500, 650, 800, 1000, 1200, 1500, 2000, 2500, 4000, 4500, 5000, 12000, 15000];
    const h = buildPriceHistogram(prices, 20);
    expect(h.min).toBe(500);
    expect(h.max).toBe(15000);
    expect(h.buckets.length).toBeLessThanOrEqual(20);
    expect(h.buckets[0].lower).toBe(500);
    expect(h.buckets[h.buckets.length - 1].upper).toBe(15000);
    for (let i = 0; i < h.buckets.length; i++) {
      const b = h.buckets[i];
      expect(Number.isInteger(b.lower) && Number.isInteger(b.upper)).toBe(true);
      if (i > 0) expect(b.lower).toBe(h.buckets[i - 1].upper);
    }
    expect(h.buckets.reduce((n, b) => n + b.count, 0)).toBe(prices.length);
    // The maximum lands in the final bucket.
    expect(h.buckets[h.buckets.length - 1].count).toBeGreaterThanOrEqual(1);
  });

  test("[lower, upper): a price on an inner edge goes to the next bucket", () => {
    const h = buildPriceHistogram([0, 10, 20], 2);
    expect(h.buckets).toEqual([
      { lower: 0, upper: 10, count: 1 },
      { lower: 10, upper: 20, count: 2 },
    ]);
  });

  test("small span never makes zero-width buckets", () => {
    const h = buildPriceHistogram([100, 103], 20);
    expect(h.buckets.length).toBe(3);
    expect(h.buckets.every((b) => b.upper > b.lower)).toBe(true);
    expect(h.buckets.reduce((n, b) => n + b.count, 0)).toBe(2);
  });
});

describe("bucketOverlaps", () => {
  const inner = { lower: 1000, upper: 2000, count: 1 };
  test("half-open inner bucket, inclusive last bucket, null = unbounded", () => {
    expect(bucketOverlaps(inner, false, null, null)).toBe(true);
    expect(bucketOverlaps(inner, false, 2000, null)).toBe(false);
    expect(bucketOverlaps(inner, true, 2000, null)).toBe(true);
    expect(bucketOverlaps(inner, false, null, 1000)).toBe(true);
    expect(bucketOverlaps(inner, false, null, 999)).toBe(false);
  });
});

describe("categoryFacets", () => {
  test("distinct items per category; multi-category items count in each", () => {
    const cats = [
      { id: "a", label: "A", scope: "food" as const, icon: "snacks" as const },
      { id: "b", label: "B", scope: "food" as const, icon: "snacks" as const },
    ];
    const facets = categoryFacets(cats, [
      { item_id: "1", category_ids: ["a", "b"] },
      { item_id: "2", category_ids: ["a"] },
      { item_id: "2", category_ids: ["a"] },
    ]);
    expect(facets).toEqual([
      { id: "a", label: "A", count: 2 },
      { id: "b", label: "B", count: 1 },
    ]);
  });
});
