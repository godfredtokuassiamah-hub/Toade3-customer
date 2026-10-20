// The canonical discovery predicate (§05). Every count, histogram, results
// page and filtered Home module goes through these functions.
import type { MockItem, MockVendor } from "./types";

// "07:30" -> 450; "24:00" -> 1440.
export function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":");
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

// Accepting orders at `now` (UTC hours; Accra is UTC+0). Overnight hours
// (close < open) wrap past midnight.
export function vendorOpenAt(vendor: MockVendor, now: Date): boolean {
  if (vendor.paused) return false;
  const m = now.getUTCHours() * 60 + now.getUTCMinutes();
  const open = minutesOfDay(vendor.hours.open);
  const close = minutesOfDay(vendor.hours.close);
  if (open === close) return false;
  return open < close ? m >= open && m < close : m >= open || m < close;
}

// Orderable item: not disabled, stock >= 1 and a known positive weight.
// Vendor open is a separate condition.
export function isOrderable(item: MockItem): boolean {
  return !item.disabled && item.stock >= 1 && item.weight_g != null && item.weight_g > 0;
}

// Mandatory first: published and owned by a known vendor. Coverage for the
// drop-off is checked once per request by the oracle.
export function isPublished(item: MockItem, vendor: MockVendor | undefined): boolean {
  return item.published && vendor != null;
}

export function inScope(scope: string, itemScope: string): boolean {
  return scope === "all" || scope === itemScope;
}

// min <= price <= max; null bounds are unbounded.
export function inPriceRange(price: number, min: number | null, max: number | null): boolean {
  return (min == null || price >= min) && (max == null || price <= max);
}

// Category ids are ORed.
export function inAnyCategory(itemCategories: readonly string[], selected: ReadonlySet<string>): boolean {
  if (selected.size === 0) return true;
  return itemCategories.some((c) => selected.has(c));
}
