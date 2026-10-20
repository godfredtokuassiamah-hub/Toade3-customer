// Facet math (§06). Pure.
import type { Category, CategoryFacet, PriceBucket, PriceFacet } from "./types";

export const MAX_PRICE_BUCKETS = 20;

// Up to `maxBuckets` buckets across [min, max] with integer pesewa edges.
// Intervals are [lower, upper); the final bucket also includes `upper`, so
// each price falls in exactly one bucket. One distinct price -> one bucket
// (no divide-by-zero); no prices -> no buckets.
export function buildPriceHistogram(
  prices: readonly number[],
  maxBuckets: number,
): PriceFacet {
  if (prices.length === 0) return { buckets: [], min: null, max: null };
  let min = prices[0];
  let max = prices[0];
  for (const p of prices) {
    if (p < min) min = p;
    if (p > max) max = p;
  }
  if (min === max) {
    return { buckets: [{ lower: min, upper: max, count: prices.length }], min, max };
  }
  const span = max - min;
  const target = Math.max(1, Math.min(maxBuckets, span));
  let width = Math.ceil(span / target);
  // Whole-cedi widths read better once the range allows it.
  if (span >= 100 * target) width = Math.ceil(width / 100) * 100;
  const count = Math.ceil(span / width);
  const buckets: PriceBucket[] = [];
  for (let i = 0; i < count; i++) {
    const lower = min + i * width;
    buckets.push({ lower, upper: i === count - 1 ? max : lower + width, count: 0 });
  }
  for (const p of prices) {
    buckets[Math.min(count - 1, Math.floor((p - min) / width))].count += 1;
  }
  return { buckets, min, max };
}

// Does the bucket share any price with [min, max]? (null = unbounded.)
export function bucketOverlaps(
  bucket: PriceBucket,
  isLast: boolean,
  min: number | null,
  max: number | null,
): boolean {
  const belowMax = max == null || bucket.lower <= max;
  const aboveMin = min == null || (isLast ? bucket.upper >= min : bucket.upper > min);
  return belowMax && aboveMin;
}

// Bucket edges [b0.lower, b0.upper, ..., last.upper] for accessible steps.
export function bucketEdges(buckets: readonly PriceBucket[]): number[] {
  if (buckets.length === 0) return [];
  return [buckets[0].lower, ...buckets.map((b) => b.upper)];
}

// VoiceOver/TalkBack increment/decrement: one bucket edge per step. The far
// left edge means "Any minimum" (null), the far right "No limit" (null).
// Handles never cross.
export function stepMinBound(
  edges: readonly number[],
  current: number | null,
  max: number | null,
  dir: 1 | -1,
): number | null {
  if (edges.length < 2) return current;
  const first = edges[0];
  if (dir === 1) {
    const next = current == null ? edges[1] : edges.find((e) => e > current);
    if (next == null) return current;
    return max != null && next > max ? max : next;
  }
  if (current == null) return null;
  const prev = [...edges].reverse().find((e) => e < current);
  return prev == null || prev <= first ? null : prev;
}

export function stepMaxBound(
  edges: readonly number[],
  current: number | null,
  min: number | null,
  dir: 1 | -1,
): number | null {
  if (edges.length < 2) return current;
  const last = edges[edges.length - 1];
  if (dir === -1) {
    const prev = current == null ? edges[edges.length - 2] : [...edges].reverse().find((e) => e < current);
    if (prev == null) return current;
    return min != null && prev < min ? min : prev;
  }
  if (current == null) return null;
  const next = edges.find((e) => e > current);
  return next == null || next >= last ? null : next;
}

// Distinct items per category, from items that already passed every
// filter EXCEPT the category filter (self-exclusion).
export function categoryFacets(
  categories: readonly Category[],
  items: readonly { item_id: string; category_ids: readonly string[] }[],
): CategoryFacet[] {
  return categories.map((c) => {
    const ids = new Set<string>();
    for (const item of items) if (item.category_ids.includes(c.id)) ids.add(item.item_id);
    return { id: c.id, label: c.label, count: ids.size };
  });
}
