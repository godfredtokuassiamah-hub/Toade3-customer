// Stores tab sections, built from the store directory and the drop-off.
// Pure (unit-tested): quotes every store once, then groups them.
import type { Store, StoreCategory } from "../../data/mock/stores";
import { type DeliveryQuote, type LatLng, quoteDelivery } from "./deliveryQuote";

export type QuotedStore = { store: Store; quote: DeliveryQuote };

export type StoreSectionId =
  | "near-you"
  | "fast-delivery"
  | "groceries"
  | "pharmacy-health"
  | "electronics"
  | "gifts-flowers";

export type StoreSection = {
  id: StoreSectionId;
  title: string;
  stores: QuotedStore[];
};

const FAST_MAX_MINS = 30;

type SectionDef = {
  id: StoreSectionId;
  title: string;
  include: (s: QuotedStore) => boolean;
};

const inCategories =
  (...categories: StoreCategory[]) =>
  (s: QuotedStore) =>
    categories.includes(s.store.category);

const SECTION_DEFS: readonly SectionDef[] = [
  { id: "near-you", title: "Near you", include: () => true },
  {
    id: "fast-delivery",
    title: "Fast delivery",
    include: (s) => s.store.open && s.quote.deliverable && s.quote.etaMins[1] <= FAST_MAX_MINS,
  },
  { id: "groceries", title: "Supermarkets & groceries", include: inCategories("groceries") },
  {
    id: "pharmacy-health",
    title: "Pharmacy & health",
    include: inCategories("pharmacy", "health-beauty"),
  },
  { id: "electronics", title: "Electronics & gadgets", include: inCategories("electronics") },
  { id: "gifts-flowers", title: "Gifts & flowers", include: inCategories("gifts", "flowers") },
];

const SECTION_IDS = new Set<string>(SECTION_DEFS.map((d) => d.id));

export function isStoreSectionId(value: unknown): value is StoreSectionId {
  return typeof value === "string" && SECTION_IDS.has(value);
}

export function sectionTitle(id: StoreSectionId): string {
  return SECTION_DEFS.find((d) => d.id === id)?.title ?? "Stores";
}

// Every store, nearest first (stable for equal distances).
export function quoteStores(stores: readonly Store[], dropoff: LatLng): QuotedStore[] {
  return stores
    .map((store) => ({ store, quote: quoteDelivery(store, dropoff) }))
    .sort((a, b) => a.quote.distanceKm - b.quote.distanceKm);
}

// Sections in display order, nearest first within each; empty ones are
// dropped. `category` narrows every section to that store category.
export function buildStoreSections(
  stores: readonly Store[],
  dropoff: LatLng,
  category: StoreCategory | null,
): StoreSection[] {
  const quoted = quoteStores(stores, dropoff).filter(
    (s) => category == null || s.store.category === category,
  );
  return SECTION_DEFS.map((def) => ({
    id: def.id,
    title: def.title,
    stores: quoted.filter(def.include),
  })).filter((section) => section.stores.length > 0);
}

// One section's stores (the "See all" list), or [] for an unknown id.
export function storesForSection(
  stores: readonly Store[],
  dropoff: LatLng,
  id: StoreSectionId,
  category: StoreCategory | null,
): QuotedStore[] {
  return buildStoreSections(stores, dropoff, category).find((s) => s.id === id)?.stores ?? [];
}
