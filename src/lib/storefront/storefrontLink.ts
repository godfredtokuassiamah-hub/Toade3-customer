// Pure helpers for linking into the vendor storefront route
// (src/app/storefront/[vendorId].tsx). No imports, so they unit-test cleanly.

// The catalog vendor a Stores-tab store opens, or undefined when it has none
// (the caller keeps the "Storefront coming soon" fallback).
export function storeVendorId(store: { vendorId?: string }): string | undefined {
  return store.vendorId?.trim() || undefined;
}

// True when `pathname` (expo-router usePathname(), params resolved) is this
// vendor's storefront, so a link to it should just close instead of pushing
// a duplicate screen.
export function isOnVendorStorefront(pathname: string, vendorId: string): boolean {
  return vendorId !== "" && pathname === `/storefront/${vendorId}`;
}
