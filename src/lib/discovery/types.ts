// Discovery contract (spec ENG-TOADE3-HOME-DISCOVERY-2026-V1 §11/§12).
// The request/response shapes mirror the Edge endpoints
//   POST /v1/customer/discovery/query
//   POST /v1/customer/discovery/suggestions
// Today src/services/discovery.ts answers them with the local mock oracle
// (src/lib/discovery/oracle.ts); the real endpoints replace that one module.
// Money is always integer pesewas (minor units).
import type { ImageSourcePropType } from "react-native";

export type DiscoveryScope = "all" | "food" | "groceries";
export type CatalogScope = Exclude<DiscoveryScope, "all">;
export type DiscoverySort = "best_match" | "price_asc" | "price_desc";
export type DiscoverySurface = "home" | "search";
export type DiscoveryPurpose = "preview" | "results";

export type DiscoveryFilters = {
  category_ids: string[];
  // null = unbounded ("Any minimum" / "No limit").
  min_price_minor: number | null;
  max_price_minor: number | null;
  open_now: boolean;
  in_stock_only: boolean;
  // Capability-gated: no versioned sale prices exist yet, so the client
  // never sends true (and the oracle has no offer data to match).
  offers_only: boolean;
};

export type DiscoveryQueryRequest = {
  context_id: string;
  context_revision: number;
  q: string;
  scope: DiscoveryScope;
  sort: DiscoverySort;
  filters: DiscoveryFilters;
  surface: DiscoverySurface;
  purpose: DiscoveryPurpose;
  limit: number;
  cursor: string | null;
};

export type CategoryFacet = { id: string; label: string; count: number };
// [lower, upper) in pesewas; the last bucket also includes `upper`.
export type PriceBucket = { lower: number; upper: number; count: number };
export type PriceFacet = {
  buckets: PriceBucket[];
  min: number | null;
  max: number | null;
};
export type DiscoveryFacets = { categories: CategoryFacet[]; price: PriceFacet };

export type ItemStatus = "available" | "closed" | "sold_out";

export type DiscoveryItem = {
  item_id: string;
  name: string;
  vendor_id: string;
  vendor_name: string;
  scope: CatalogScope;
  category_ids: string[];
  price_minor: number;
  eta_mins: number;
  image?: ImageSourcePropType;
  vendor_open: boolean;
  orderable: boolean;
  status: ItemStatus;
};

export type DiscoveryVendor = {
  vendor_id: string;
  name: string;
  open: boolean;
  eta_mins: number;
};

export type DiscoveryModule =
  | {
      type: "items";
      id: string;
      title: string;
      category_id: string;
      items: DiscoveryItem[];
    }
  | { type: "vendors"; id: string; title: string; vendors: DiscoveryVendor[] };

export type QueryInterpretation = {
  // Normalized text actually searched ("" for browse).
  normalized_q: string;
  // Confident correction, shown as "Showing results for {corrected_q}."
  corrected_q: string | null;
  // Uncertain correction, offered as "Did you mean {suggested_q}?"
  suggested_q: string | null;
};

// Why a response is empty (null when item_count > 0).
export type EmptyReason =
  | "not_covered"
  | "no_query_matches"
  | "stores_closed"
  | "filters_exclude";

export type DiscoveryQueryResponse = {
  q: string;
  scope: DiscoveryScope;
  sort: DiscoverySort;
  // Canonical (sorted, de-duplicated) filters the server applied.
  filters: DiscoveryFilters;
  // COUNT(DISTINCT item_id) after all filters, before pagination.
  item_count: number;
  facets: DiscoveryFacets;
  coverage: "covered" | "not_covered";
  empty_reason: EmptyReason | null;
  query_interpretation: QueryInterpretation;
  context_revision: number;
  // Catalog snapshot revision; items, count and facets share it.
  revision: number;
  computed_at: string;
  freshness: "live" | "cached";
  // surface = "home" with purpose = "results".
  modules?: DiscoveryModule[];
  // surface = "search" with purpose = "results".
  items?: DiscoveryItem[];
  next_cursor: string | null;
};

export type DiscoverySuggestionsRequest = {
  context_id: string;
  context_revision: number;
  q: string;
  scope: DiscoveryScope;
  filters: DiscoveryFilters;
  limit: number;
};

export type DiscoverySuggestionsResponse = {
  // Submit as a query.
  queries: { text: string }[];
  // Open item detail.
  items: { item_id: string; name: string; vendor_name: string }[];
  // Open storefront; each has >= 1 eligible item under the current filters.
  stores: { vendor_id: string; name: string }[];
  context_revision: number;
  revision: number;
};

export type DiscoveryErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "CURSOR_STALE"
  | "CONTEXT_STALE"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "NETWORK";

export type FieldErrors = Partial<Record<string, string>>;

const STATUS_BY_CODE: Record<DiscoveryErrorCode, 0 | 401 | 403 | 409 | 422 | 429> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  CURSOR_STALE: 409,
  CONTEXT_STALE: 409,
  VALIDATION: 422,
  RATE_LIMITED: 429,
  NETWORK: 0,
};

export class DiscoveryError extends Error {
  readonly status: 0 | 401 | 403 | 409 | 422 | 429;
  readonly code: DiscoveryErrorCode;
  readonly field_errors?: FieldErrors;

  constructor(code: DiscoveryErrorCode, message: string, fieldErrors?: FieldErrors) {
    super(message);
    this.name = "DiscoveryError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.field_errors = fieldErrors;
  }
}

// ---- Mock catalog (the oracle's source data) ----

export type CategoryIcon =
  | "localDishes"
  | "riceMeals"
  | "snacks"
  | "drinks"
  | "produce"
  | "dairy"
  | "bakery"
  | "beverages"
  | "household"
  | "grains"
  | "gadgets"
  | "gifts"
  | "homeDiy"
  | "sports"
  | "pharmacy"
  | "flowers"
  | "healthBeauty";

export type Category = {
  id: string;
  label: string;
  scope: CatalogScope;
  icon: CategoryIcon;
};

export type MockVendor = {
  vendor_id: string;
  name: string;
  // Opening hours "HH:MM" in UTC (Accra is UTC+0). close may be "24:00".
  hours: { open: string; close: string };
  // Temporarily not accepting orders.
  paused: boolean;
};

export type MockItem = {
  item_id: string;
  name: string;
  aliases?: string[];
  vendor_id: string;
  scope: CatalogScope;
  category_ids: string[];
  price_minor: number;
  stock: number;
  disabled: boolean;
  // null = unknown weight (not orderable).
  weight_g: number | null;
  published: boolean;
  eta_mins: number;
  image?: ImageSourcePropType;
};

export type MockCatalog = {
  revision: number;
  categories: Category[];
  vendors: MockVendor[];
  items: MockItem[];
  // Popular typed searches offered as query suggestions.
  suggestion_terms: string[];
};

export type Coordinates = { latitude: number; longitude: number };
