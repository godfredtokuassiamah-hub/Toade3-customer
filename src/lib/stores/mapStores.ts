// Map tab helpers: chip filtering, marker and title text. Pure (unit-tested).
import { formatMinorFixed } from "../discovery/money";
import {
  STORE_CATEGORY_LABELS,
  type Store,
  type StoreCategory,
} from "../../data/mock/stores";
import type { QuotedStore } from "./storeSections";

// Toggle chips: "Open now", "Delivers here" and multi-select categories.
// Groups combine with AND; categories combine with OR.
export type MapFilter = {
  openNow: boolean;
  deliversHere: boolean;
  categories: readonly StoreCategory[];
};

export type MapChipId = "open-now" | "delivers-here" | `category:${StoreCategory}`;

export type MapChip = { id: MapChipId; label: string };

export const EMPTY_MAP_FILTER: MapFilter = {
  openNow: false,
  deliversHere: false,
  categories: [],
};

// "Petals & Co." -> "PC", "Milk" -> "MI".
export function storeInitials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w));
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Fixed chips first, then each category present in the directory, in
// directory order.
export function mapChips(stores: readonly Store[]): MapChip[] {
  const seen: StoreCategory[] = [];
  for (const s of stores) if (!seen.includes(s.category)) seen.push(s.category);
  return [
    { id: "open-now", label: "Open now" },
    { id: "delivers-here", label: "Delivers here" },
    ...seen.map((c) => ({ id: `category:${c}` as const, label: STORE_CATEGORY_LABELS[c] })),
  ];
}

function chipCategory(id: MapChipId): StoreCategory | null {
  return id.startsWith("category:") ? (id.slice("category:".length) as StoreCategory) : null;
}

export function isChipSelected(filter: MapFilter, id: MapChipId): boolean {
  if (id === "open-now") return filter.openNow;
  if (id === "delivers-here") return filter.deliversHere;
  const category = chipCategory(id);
  return category != null && filter.categories.includes(category);
}

export function toggleMapChip(filter: MapFilter, id: MapChipId): MapFilter {
  if (id === "open-now") return { ...filter, openNow: !filter.openNow };
  if (id === "delivers-here") return { ...filter, deliversHere: !filter.deliversHere };
  const category = chipCategory(id);
  if (category == null) return filter;
  const categories = filter.categories.includes(category)
    ? filter.categories.filter((c) => c !== category)
    : [...filter.categories, category];
  return { ...filter, categories };
}

// "Delivers here" = within the 5 km delivery radius of the drop-off.
export function filterMapStores(
  stores: readonly QuotedStore[],
  filter: MapFilter,
): QuotedStore[] {
  return stores.filter(
    ({ store, quote }) =>
      (!filter.openNow || store.open) &&
      (!filter.deliversHere || quote.deliverable) &&
      (filter.categories.length === 0 || filter.categories.includes(store.category)),
  );
}

// Marker second line: fee, or why the store can't take an order.
export function markerSubtitle({ store, quote }: QuotedStore): string {
  if (!store.open) return "Closed";
  if (!quote.deliverable) return "Too far";
  return formatMinorFixed(quote.feeMinor);
}

export function isStoreAvailable({ store, quote }: QuotedStore): boolean {
  return store.open && quote.deliverable;
}

export function storeCountLabel(count: number): string {
  return count === 1 ? "1 store" : `${count} stores`;
}

export function mapTitle(place: string | null | undefined): string {
  const trimmed = place?.trim();
  return trimmed ? `Stores near ${trimmed}` : "Stores near you";
}
