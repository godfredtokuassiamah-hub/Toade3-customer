// Query fingerprints: the identity of "what was asked", used by the race
// guard, the Apply transaction and opaque cursors.
import { normalizeText } from "./normalize";
import type { DiscoveryFilters, DiscoveryQueryRequest } from "./types";

// Sorted, de-duplicated category ids; everything else as is.
export function canonicalFilters(f: DiscoveryFilters): DiscoveryFilters {
  return {
    category_ids: [...new Set(f.category_ids)].sort(),
    min_price_minor: f.min_price_minor,
    max_price_minor: f.max_price_minor,
    open_now: f.open_now,
    in_stock_only: f.in_stock_only,
    offers_only: f.offers_only,
  };
}

// Excludes cursor, limit and purpose: a preview and the Apply request for
// the same draft share a fingerprint.
export function queryFingerprint(
  req: Pick<
    DiscoveryQueryRequest,
    "context_id" | "q" | "scope" | "sort" | "filters" | "surface"
  >,
): string {
  const f = canonicalFilters(req.filters);
  return JSON.stringify([
    req.context_id,
    normalizeText(req.q),
    req.scope,
    req.sort,
    f.category_ids,
    f.min_price_minor,
    f.max_price_minor,
    f.open_now,
    f.in_stock_only,
    f.offers_only,
    req.surface,
  ]);
}

// 32-bit FNV-1a, hex.
export function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
