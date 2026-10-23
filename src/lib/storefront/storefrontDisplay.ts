// Pure display helpers for the vendor storefront (no react-native imports,
// unit-tested). Everything here is DISPLAY ONLY: mock ratings/promos and the
// delivery estimate are never used to price or charge anything.
import { formatEta } from "../format";
import type { MockItem, MockVendor } from "../discovery/types";
import { deliveryFeeMinor } from "../stores/deliveryQuote";

function isValidPercent(percent: number | undefined): percent is number {
  return percent != null && Number.isInteger(percent) && percent >= 1 && percent <= 90;
}

// Struck-through "was" price for a MOCK discount. price_minor is the current
// price, so original = current / (1 - p/100), rounded to the pesewa.
// 4000 @20 -> 5000; 1500 @10 -> 1667. null for an invalid percent.
export function originalPriceFromDiscount(
  currentMinor: number,
  percent: number | undefined,
): number | null {
  if (!isValidPercent(percent) || !(currentMinor >= 0)) return null;
  return Math.round((currentMinor * 100) / (100 - percent));
}

function grouped(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// 64 -> "64", 640 -> "600+", 5234 -> "5,000+", 12800 -> "12,000+".
export function formatRatingCount(count: number): string {
  const n = Math.max(0, Math.floor(count));
  if (n < 100) return `${n}`;
  if (n < 1000) return `${Math.floor(n / 100) * 100}+`;
  return `${grouped(Math.floor(n / 1000) * 1000)}+`;
}

// { 4.5, 5234 } -> "4.5 (5,000+)".
export function formatRating(rating: NonNullable<MockVendor["rating"]>): string {
  return `${rating.value.toFixed(1)} (${formatRatingCount(rating.count)})`;
}

// Spoken form: "Rated 4.5 out of 5, more than 5,000 ratings".
export function ratingAccessibilityLabel(rating: NonNullable<MockVendor["rating"]>): string {
  const n = Math.max(0, Math.floor(rating.count));
  const count = formatRatingCount(n);
  const amount = count.endsWith("+") ? `more than ${count.slice(0, -1)}` : count;
  return `Rated ${rating.value.toFixed(1)} out of 5, ${amount} ${n === 1 ? "rating" : "ratings"}`;
}

// [15, 20] -> "15–20 min" (en dash); [20, 20] -> "20 min".
export function formatEtaSpan(range: readonly [number, number]): string {
  return range[0] === range[1] ? `${range[0]} min` : `${range[0]}–${range[1]} min`;
}

// "Delivery in 15 to 20 minutes".
export function etaSpanAccessibilityLabel(range: readonly [number, number]): string {
  return range[0] === range[1]
    ? `Delivery in about ${range[0]} minutes`
    : `Delivery in ${range[0]} to ${range[1]} minutes`;
}

export type StorefrontEstimate = {
  feeMinor: number;
  etaMins: readonly [number, number];
};

// Blueprint fare-matrix zone 2 (1.1-2.5 km) as the representative distance:
// catalog vendors have no coordinates, so quoteDelivery can't run.
const REPRESENTATIVE_KM = 2.5;

// DISPLAY ESTIMATE ONLY (the checkout quote is authoritative): fee = the
// zone-2 matrix fee (GHS 8.00); ETA = min..max of the menu's eta_mins.
// null for an empty menu.
export function storefrontDeliveryEstimate(items: readonly MockItem[]): StorefrontEstimate | null {
  if (items.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const item of items) {
    if (item.eta_mins < min) min = item.eta_mins;
    if (item.eta_mins > max) max = item.eta_mins;
  }
  return { feeMinor: deliveryFeeMinor(REPRESENTATIVE_KM) ?? 800, etaMins: [min, max] };
}

// Highest valid MOCK discount on the menu, or null (promo row hidden).
export function maxDiscountPercent(items: readonly MockItem[]): number | null {
  let best: number | null = null;
  for (const item of items) {
    if (isValidPercent(item.discountPercent) && (best == null || item.discountPercent > best)) {
      best = item.discountPercent;
    }
  }
  return best;
}

// No description field exists, so the row subtitle is honest catalog data:
// "{first category label} · {eta}", e.g. "Snacks · 15 mins".
export function itemSubtitle(item: MockItem, labelById: ReadonlyMap<string, string>): string {
  const label = item.category_ids[0] != null ? labelById.get(item.category_ids[0]) : undefined;
  const eta = formatEta(item.eta_mins);
  return label ? `${label} · ${eta}` : eta;
}
