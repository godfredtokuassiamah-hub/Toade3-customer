// Map carousel order: the selected store first, then the others by distance
// FROM that store (not from the drop-off). Pure (unit-tested).
import { haversineKm, type LatLng } from "./deliveryQuote";
import type { QuotedStore } from "./storeSections";

// `stores` is the already-filtered (visible) list. Equal distances keep a
// stable order by store id. An origin missing from `stores` is not added.
export function orderByProximity(
  stores: readonly QuotedStore[],
  origin: LatLng & { id: string },
): QuotedStore[] {
  return stores
    .map((item) => ({
      item,
      km: item.store.id === origin.id ? -1 : haversineKm(origin, item.store),
    }))
    .sort((a, b) => a.km - b.km || compareIds(a.item.store.id, b.item.store.id))
    .map(({ item }) => item);
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Snapped carousel page for a horizontal offset, clamped to [0, count - 1].
export function indexFromOffset(offset: number, interval: number, count: number): number {
  if (count <= 0 || interval <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(offset / interval)));
}
