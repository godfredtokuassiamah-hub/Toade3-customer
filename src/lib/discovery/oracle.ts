// Mock discovery oracle: pure functions with exactly the spec's semantics
// (§05 predicate, §06 facets, §07 search, §11/§12 contract).
//
// TODO(discovery): replaced by the Edge endpoints
//   POST /v1/customer/discovery/query
//   POST /v1/customer/discovery/suggestions
// backed by the S4 read model (S2 catalog + S3 coverage projections).
// Only src/services/discovery.ts calls this module.
import { buildPriceHistogram, categoryFacets, MAX_PRICE_BUCKETS } from "./facets";
import { canonicalFilters, fnv1a, queryFingerprint } from "./fingerprint";
import { PRICE_FORMAT_ERROR, PRICE_ORDER_ERROR } from "./money";
import { interpretQuery, normalizeText, tokenize } from "./normalize";
import {
  inAnyCategory,
  inPriceRange,
  inScope,
  isOrderable,
  isPublished,
  vendorOpenAt,
} from "./predicate";
import { compareForSort, relevanceTier, TIER_NONE, type RankFields } from "./rank";
import {
  type Category,
  type Coordinates,
  DiscoveryError,
  type DiscoveryFilters,
  type DiscoveryItem,
  type DiscoveryModule,
  type DiscoveryQueryRequest,
  type DiscoveryQueryResponse,
  type DiscoverySuggestionsRequest,
  type DiscoverySuggestionsResponse,
  type DiscoveryVendor,
  type EmptyReason,
  type FieldErrors,
  type MockCatalog,
  type MockItem,
  type MockVendor,
} from "./types";

export const MAX_QUERY_LENGTH = 120;
export const MIN_SUGGEST_LENGTH = 2;
export const MAX_PAGE_SIZE = 50;
export const MAX_SUGGESTIONS = 5;
// Bounded rails on the filtered Home.
export const HOME_RAIL_LIMIT = 10;

// Mock coverage: a radius around Accra. Outside it -> "not delivering here".
export const MOCK_COVERAGE = {
  center: { latitude: 5.6037, longitude: -0.187 },
  radiusKm: 30,
};

export function isWithinMockCoverage(
  point: Coordinates | null,
  center: Coordinates,
  radiusKm: number,
): boolean {
  // No confirmed drop-off yet: browse as covered.
  if (!point) return true;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(point.latitude - center.latitude);
  const dLng = toRad(point.longitude - center.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(center.latitude)) * Math.cos(toRad(point.latitude)) * Math.sin(dLng / 2) ** 2;
  const km = 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
  return km <= radiusKm;
}

export type OracleEnv = {
  // Captured server time for "open now".
  now: Date;
  covered: boolean;
};

// ---- Index (one per catalog snapshot) ----

type Entry = {
  item: MockItem;
  vendor: MockVendor;
  rank: RankFields;
};

type Index = {
  entries: Entry[];
  vendors: Map<string, MockVendor>;
  vocabulary: Set<string>;
};

const indexCache = new WeakMap<MockCatalog, Index>();

function getIndex(catalog: MockCatalog): Index {
  const cached = indexCache.get(catalog);
  if (cached) return cached;
  const vendors = new Map(catalog.vendors.map((v) => [v.vendor_id, v]));
  const labels = new Map(catalog.categories.map((c) => [c.id, c.label]));
  const vocabulary = new Set<string>();
  const entries: Entry[] = [];
  for (const item of catalog.items) {
    const vendor = vendors.get(item.vendor_id);
    // Mandatory first: published + known vendor.
    if (!vendor || !isPublished(item, vendor)) continue;
    const names = [item.name, ...(item.aliases ?? [])].map(normalizeText);
    const words = [
      ...names.flatMap((n) => n.split(" ")),
      ...tokenize(vendor.name),
      ...item.category_ids.flatMap((id) => tokenize(labels.get(id) ?? "")),
    ];
    for (const w of words) vocabulary.add(w);
    entries.push({ item, vendor, rank: { names, words } });
  }
  const index = { entries, vendors, vocabulary };
  indexCache.set(catalog, index);
  return index;
}

// ---- Validation ----

function validateFilters(f: DiscoveryFilters, errors: FieldErrors): void {
  const bound = (v: number | null) => v == null || (Number.isInteger(v) && v >= 0);
  if (!bound(f.min_price_minor)) errors.min_price_minor = PRICE_FORMAT_ERROR;
  if (!bound(f.max_price_minor)) errors.max_price_minor = PRICE_FORMAT_ERROR;
  if (
    f.min_price_minor != null &&
    f.max_price_minor != null &&
    f.min_price_minor > f.max_price_minor &&
    !errors.min_price_minor &&
    !errors.max_price_minor
  ) {
    errors.max_price_minor = PRICE_ORDER_ERROR;
  }
}

function validateQuery(req: DiscoveryQueryRequest): void {
  const errors: FieldErrors = {};
  if (req.q.trim().length > MAX_QUERY_LENGTH) errors.q = "Search is limited to 120 characters.";
  if (!["all", "food", "groceries"].includes(req.scope)) errors.scope = "Unknown scope.";
  if (!["best_match", "price_asc", "price_desc"].includes(req.sort)) errors.sort = "Unknown sort.";
  if (!Number.isInteger(req.limit) || req.limit < 0 || req.limit > MAX_PAGE_SIZE) {
    errors.limit = "Invalid page size.";
  }
  validateFilters(req.filters, errors);
  if (Object.keys(errors).length > 0) {
    throw new DiscoveryError("VALIDATION", "Invalid discovery request.", errors);
  }
}

// ---- Cursor: opaque, bound to the fingerprint and the data revision ----

export function encodeCursor(offset: number, revision: number, fingerprint: string): string {
  return `c1.${offset.toString(36)}.${revision}.${fnv1a(fingerprint)}`;
}

function decodeCursor(cursor: string, revision: number, fingerprint: string): number {
  const parts = cursor.split(".");
  if (parts.length !== 4 || parts[0] !== "c1") {
    throw new DiscoveryError("VALIDATION", "Malformed cursor.", { cursor: "Malformed cursor." });
  }
  const offset = parseInt(parts[1], 36);
  // Revision changed, or the cursor belongs to another query: never append
  // a page from a different snapshot.
  if (Number(parts[2]) !== revision || parts[3] !== fnv1a(fingerprint) || !Number.isFinite(offset)) {
    throw new DiscoveryError("CURSOR_STALE", "Results changed since the last page.");
  }
  return offset;
}

// ---- Query ----

type Evaluated = {
  entry: Entry;
  tier: number;
  open: boolean;
  orderable: boolean;
};

type Checks = {
  category: boolean;
  price: boolean;
  open: boolean;
  stock: boolean;
  offers: boolean;
};

function checks(e: Evaluated, f: DiscoveryFilters, cats: ReadonlySet<string>): Checks {
  return {
    category: inAnyCategory(e.entry.item.category_ids, cats),
    price: inPriceRange(e.entry.item.price_minor, f.min_price_minor, f.max_price_minor),
    open: !f.open_now || e.open,
    stock: !f.in_stock_only || e.orderable,
    // No item has a versioned sale price yet: offers_only matches nothing.
    offers: !f.offers_only,
  };
}

const allPass = (c: Checks) => c.category && c.price && c.open && c.stock && c.offers;

function toItem(e: Evaluated): DiscoveryItem {
  const { item, vendor } = e.entry;
  return {
    item_id: item.item_id,
    name: item.name,
    vendor_id: vendor.vendor_id,
    vendor_name: vendor.name,
    scope: item.scope,
    category_ids: item.category_ids,
    price_minor: item.price_minor,
    eta_mins: item.eta_mins,
    image: item.image,
    vendor_open: e.open,
    orderable: e.orderable,
    status: !e.open ? "closed" : !e.orderable ? "sold_out" : "available",
  };
}

function scopedCategories(catalog: MockCatalog, scope: string): Category[] {
  return catalog.categories.filter((c) => inScope(scope, c.scope));
}

// Evaluates the whole request against ONE catalog snapshot, so items,
// count and facets are always consistent.
export function runDiscoveryQuery(
  catalog: MockCatalog,
  req: DiscoveryQueryRequest,
  env: OracleEnv,
): DiscoveryQueryResponse {
  validateQuery(req);
  const index = getIndex(catalog);
  const filters = canonicalFilters(req.filters);
  const fingerprint = queryFingerprint(req);
  const interpretation = interpretQuery(req.q, index.vocabulary);
  const cats = new Set(filters.category_ids);

  // Mandatory: coverage. Then scope and query.
  const queryMatched: Evaluated[] = [];
  if (env.covered) {
    for (const entry of index.entries) {
      if (!inScope(req.scope, entry.item.scope)) continue;
      const tier = relevanceTier(entry.rank, interpretation.normalized, interpretation.terms);
      if (tier === TIER_NONE) continue;
      queryMatched.push({
        entry,
        tier,
        open: vendorOpenAt(entry.vendor, env.now),
        orderable: isOrderable(entry.item),
      });
    }
  }

  const evaluated = queryMatched.map((e) => ({ e, c: checks(e, filters, cats) }));
  const final = evaluated.filter((x) => allPass(x.c)).map((x) => x.e);
  // Self-excluded facets.
  const forCategories = evaluated
    .filter(({ c }) => c.price && c.open && c.stock && c.offers)
    .map(({ e }) => e.entry.item);
  const forPrice = evaluated
    .filter(({ c }) => c.category && c.open && c.stock && c.offers)
    .map(({ e }) => e.entry.item.price_minor);

  const itemCount = new Set(final.map((e) => e.entry.item.item_id)).size;

  let emptyReason: EmptyReason | null = null;
  if (!env.covered) emptyReason = "not_covered";
  else if (itemCount === 0) {
    if (interpretation.normalized !== "" && queryMatched.length === 0) {
      emptyReason = "no_query_matches";
    } else if (
      filters.open_now &&
      evaluated.some(({ c }) => c.category && c.price && c.stock && c.offers)
    ) {
      emptyReason = "stores_closed";
    } else {
      emptyReason = "filters_exclude";
    }
  }

  const compare = compareForSort(req.sort);
  const ranked = final
    .map((e) => ({
      e,
      item_id: e.entry.item.item_id,
      price_minor: e.entry.item.price_minor,
      tier: e.tier,
      ready: e.open && e.orderable,
    }))
    .sort(compare)
    .map((r) => r.e);

  const response: DiscoveryQueryResponse = {
    q: req.q.trim(),
    scope: req.scope,
    sort: req.sort,
    filters,
    item_count: itemCount,
    facets: {
      categories: categoryFacets(scopedCategories(catalog, req.scope), forCategories),
      price: buildPriceHistogram(forPrice, MAX_PRICE_BUCKETS),
    },
    coverage: env.covered ? "covered" : "not_covered",
    empty_reason: emptyReason,
    query_interpretation: {
      normalized_q: interpretation.normalized,
      corrected_q: interpretation.corrected,
      suggested_q: interpretation.suggested,
    },
    context_revision: req.context_revision,
    revision: catalog.revision,
    computed_at: env.now.toISOString(),
    freshness: "live",
    next_cursor: null,
  };

  if (req.purpose === "preview" || req.limit === 0) return response;

  if (req.surface === "search") {
    const offset = req.cursor ? decodeCursor(req.cursor, catalog.revision, fingerprint) : 0;
    const page = ranked.slice(offset, offset + req.limit);
    const next = offset + req.limit;
    response.items = page.map((e) => toItem(e));
    response.next_cursor =
      next < ranked.length ? encodeCursor(next, catalog.revision, fingerprint) : null;
    return response;
  }

  // surface = home: bounded item rails per category (in taxonomy order)
  // and one matching-vendor rail. Banners are omitted: the mock banners
  // have no structured target to match against the filters.
  const modules: DiscoveryModule[] = [];
  for (const category of scopedCategories(catalog, req.scope)) {
    if (cats.size > 0 && !cats.has(category.id)) continue;
    const rail = ranked
      .filter((e) => e.entry.item.category_ids.includes(category.id))
      .slice(0, Math.min(req.limit, HOME_RAIL_LIMIT));
    if (rail.length === 0) continue;
    modules.push({
      type: "items",
      id: `cat-${category.id}`,
      title: category.label,
      category_id: category.id,
      items: rail.map((e) => toItem(e)),
    });
  }
  const vendors: DiscoveryVendor[] = [];
  for (const e of ranked) {
    const existing = vendors.find((v) => v.vendor_id === e.entry.vendor.vendor_id);
    if (existing) {
      existing.eta_mins = Math.min(existing.eta_mins, e.entry.item.eta_mins);
    } else if (vendors.length < HOME_RAIL_LIMIT) {
      vendors.push({
        vendor_id: e.entry.vendor.vendor_id,
        name: e.entry.vendor.name,
        open: e.open,
        eta_mins: e.entry.item.eta_mins,
      });
    }
  }
  if (vendors.length > 0) {
    modules.splice(Math.min(1, modules.length), 0, {
      type: "vendors",
      id: "vendors",
      title: "Stores with matching items",
      vendors,
    });
  }
  response.modules = modules;
  return response;
}

// ---- Suggestions ----

export function runDiscoverySuggestions(
  catalog: MockCatalog,
  req: DiscoverySuggestionsRequest,
  env: OracleEnv,
): DiscoverySuggestionsResponse {
  const empty: DiscoverySuggestionsResponse = {
    queries: [],
    items: [],
    stores: [],
    context_revision: req.context_revision,
    revision: catalog.revision,
  };
  const trimmed = req.q.trim();
  if (trimmed.length > MAX_QUERY_LENGTH) {
    throw new DiscoveryError("VALIDATION", "Invalid suggestions request.", {
      q: "Search is limited to 120 characters.",
    });
  }
  const index = getIndex(catalog);
  const interpretation = interpretQuery(trimmed, index.vocabulary);
  if (interpretation.normalized.length < MIN_SUGGEST_LENGTH || !env.covered) return empty;
  const limit = Math.max(1, Math.min(MAX_SUGGESTIONS, req.limit));
  const filters = canonicalFilters(req.filters);
  const cats = new Set(filters.category_ids);

  // Items in scope that pass every filter (ignoring the query).
  const eligible: Evaluated[] = [];
  for (const entry of index.entries) {
    if (!inScope(req.scope, entry.item.scope)) continue;
    const e: Evaluated = {
      entry,
      tier: 0,
      open: vendorOpenAt(entry.vendor, env.now),
      orderable: isOrderable(entry.item),
    };
    if (allPass(checks(e, filters, cats))) eligible.push(e);
  }

  const terms = interpretation.terms;
  const prefixMatch = (words: string[]) => terms.every((t) => words.some((w) => w.startsWith(t)));

  const items = eligible
    .map((e) => ({ e, tier: relevanceTier(e.entry.rank, interpretation.normalized, terms) }))
    .filter((x) => x.tier > TIER_NONE)
    .map((x) => ({
      e: x.e,
      item_id: x.e.entry.item.item_id,
      price_minor: x.e.entry.item.price_minor,
      tier: x.tier,
      ready: x.e.open && x.e.orderable,
    }))
    .sort(compareForSort("best_match"))
    .slice(0, limit)
    .map((r) => ({
      item_id: r.item_id,
      name: r.e.entry.item.name,
      vendor_name: r.e.entry.vendor.name,
    }));

  // Only terms that would return >= 1 eligible item.
  const queries = catalog.suggestion_terms
    .filter((term) => {
      const words = tokenize(term);
      if (!prefixMatch(words)) return false;
      const n = normalizeText(term);
      return eligible.some(
        (e) => relevanceTier(e.entry.rank, n, words) > TIER_NONE,
      );
    })
    .slice(0, limit)
    .map((text) => ({ text }));

  // Store name matches AND it has >= 1 eligible item under the filters.
  const eligibleVendors = new Set(eligible.map((e) => e.entry.vendor.vendor_id));
  const stores = catalog.vendors
    .filter((v) => eligibleVendors.has(v.vendor_id) && prefixMatch(tokenize(v.name)))
    .slice(0, limit)
    .map((v) => ({ vendor_id: v.vendor_id, name: v.name }));

  return { ...empty, queries, items, stores };
}
