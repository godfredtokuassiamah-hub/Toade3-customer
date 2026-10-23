// Every TanStack Query key in one place. Pure (unit-tested).
//
// Keys start with ['t3', CACHE_VERSION]; bump CACHE_VERSION whenever a DTO
// shape changes so persisted caches from older builds are discarded (it is
// also the persister's `buster`).
export const CACHE_VERSION = "v1";

const ALL = ["t3", CACHE_VERSION] as const;

export type ProductFilter = { vendorId?: string | null; categoryId?: string | null };

// Coordinates rounded to 4 dp (~11 m) so GPS jitter doesn't refetch quotes.
export function roundCoord(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

export const qk = {
  all: ALL,
  stores: () => [...ALL, "stores"] as const,
  store: (id: string) => [...ALL, "store", id] as const,
  products: (f: ProductFilter = {}) =>
    [...ALL, "products", { vendorId: f.vendorId ?? null, categoryId: f.categoryId ?? null }] as const,
  productRoot: () => [...ALL, "product"] as const,
  productsRoot: () => [...ALL, "products"] as const,
  product: (id: string) => [...ALL, "product", id] as const,
  discoveryCatalog: () => [...ALL, "discoveryCatalog"] as const,
  deliveryQuote: (vendorId: string, lat: number, lng: number) =>
    [...ALL, "deliveryQuote", vendorId, roundCoord(lat), roundCoord(lng)] as const,
  orders: () => [...ALL, "orders"] as const,
  order: (id: string) => [...ALL, "order", id] as const,
};

// Public, non-sensitive catalog data only. Orders, quotes and anything
// user-private are NEVER persisted (the cart has its own local store).
export const PERSISTED_ROOTS: readonly string[] = [
  "stores",
  "store",
  "products",
  "product",
  "discoveryCatalog",
];

export function isPersistable(key: readonly unknown[]): boolean {
  return (
    key[0] === "t3" &&
    key[1] === CACHE_VERSION &&
    typeof key[2] === "string" &&
    PERSISTED_ROOTS.includes(key[2])
  );
}
