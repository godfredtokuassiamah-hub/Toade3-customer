/// <reference types="jest" />
import { mockDiscoveryCatalog } from "../../../data/mock/catalog";
import { DEFAULT_DISCOVERY_FILTERS } from "../filterState";
import { interpretQuery } from "../normalize";
import {
  isWithinMockCoverage,
  MOCK_COVERAGE,
  runDiscoveryQuery,
  runDiscoverySuggestions,
} from "../oracle";
import {
  DiscoveryError,
  type DiscoveryFilters,
  type DiscoveryItem,
  type DiscoveryQueryRequest,
} from "../types";

// 12:00 UTC: Brew Corner (06-11) is closed, Lakeside is paused, the rest open.
const NOW = new Date("2026-10-20T12:00:00Z");
const ENV = { now: NOW, covered: true };

function req(
  patch: Partial<Omit<DiscoveryQueryRequest, "filters">> & { filters?: Partial<DiscoveryFilters> } = {},
): DiscoveryQueryRequest {
  const { filters, ...rest } = patch;
  return {
    context_id: "ctx",
    context_revision: 1,
    q: "",
    scope: "all",
    sort: "best_match",
    surface: "search",
    purpose: "results",
    limit: 50,
    cursor: null,
    ...rest,
    filters: { ...DEFAULT_DISCOVERY_FILTERS, ...filters },
  };
}

const run = (patch: Parameters<typeof req>[0] = {}, catalog = mockDiscoveryCatalog) =>
  runDiscoveryQuery(catalog, req(patch), ENV);
const ids = (patch: Parameters<typeof req>[0] = {}) => (run(patch).items ?? []).map((i) => i.item_id);
// Full result set across all pages (the catalog now spans more than one 50-item page).
const allItems = (patch: Parameters<typeof req>[0] = {}): DiscoveryItem[] => {
  const out: DiscoveryItem[] = [];
  let cursor: string | null = null;
  do {
    const page = run({ ...patch, limit: 50, cursor });
    out.push(...(page.items ?? []));
    cursor = page.next_cursor;
  } while (cursor);
  return out;
};
const allIds = (patch: Parameters<typeof req>[0] = {}) => allItems(patch).map((i) => i.item_id);
const price = new Map(mockDiscoveryCatalog.items.map((i) => [i.item_id, i.price_minor]));
const cats = new Map(mockDiscoveryCatalog.items.map((i) => [i.item_id, i.category_ids]));

describe("price predicate", () => {
  test("GHS 50 boundary: max=5000 includes an item priced exactly 5000", () => {
    const r = ids({ filters: { max_price_minor: 5000 } });
    expect(r).toContain("gr-toilet-roll");
    expect(r.every((id) => (price.get(id) ?? 0) <= 5000)).toBe(true);
    expect(ids({ filters: { max_price_minor: 4999 } })).not.toContain("gr-toilet-roll");
  });

  test("null max is unbounded", () => {
    const r = ids({ filters: { min_price_minor: 12000, max_price_minor: null } });
    // Every result is priced at or above the minimum; no upper bound.
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((id) => (price.get(id) ?? 0) >= 12000)).toBe(true);
    expect(r).toEqual(expect.arrayContaining(["gr-cooking-oil", "gr-rice-bag"]));
  });

  test("min > max is a 422 field error, never swapped", () => {
    expect.assertions(3);
    try {
      run({ filters: { min_price_minor: 6000, max_price_minor: 2000 } });
    } catch (e) {
      expect(e).toBeInstanceOf(DiscoveryError);
      expect((e as DiscoveryError).status).toBe(422);
      expect((e as DiscoveryError).field_errors?.max_price_minor).toBe(
        "Maximum price must be equal to or higher than minimum price.",
      );
    }
  });
});

describe("AND / OR logic and distinct counts", () => {
  test("categories are ORed, ANDed with price and availability", () => {
    const either = run({ filters: { category_ids: ["rice-meals", "snacks"] } });
    const all = either.items ?? [];
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((i) => i.category_ids.some((c) => c === "rice-meals" || c === "snacks"))).toBe(true);
    const narrowed = run({
      filters: { category_ids: ["rice-meals", "snacks"], max_price_minor: 2000, open_now: true, in_stock_only: true },
    }).items ?? [];
    expect(narrowed.length).toBeGreaterThan(0);
    for (const i of narrowed) {
      expect(i.price_minor).toBeLessThanOrEqual(2000);
      expect(i.vendor_open && i.orderable).toBe(true);
    }
  });

  test("multi-category items are counted once", () => {
    const r = run({ filters: { category_ids: ["rice-meals", "local-dishes"] } });
    const rice = run({ filters: { category_ids: ["rice-meals"] } }).item_count;
    const local = run({ filters: { category_ids: ["local-dishes"] } }).item_count;
    // lm-jollof-chicken and cg-chicken-jollof are in both.
    expect(r.item_count).toBe(rice + local - 2);
    expect(r.item_count).toBe(new Set((r.items ?? []).map((i) => i.item_id)).size);
  });

  test("scope restricts items; unpublished items never appear", () => {
    expect((run({ scope: "groceries" }).items ?? []).every((i) => i.scope === "groceries")).toBe(true);
    expect(ids()).not.toContain("zz-draft-item");
  });
});

describe("facets", () => {
  test("category facets exclude the category filter itself", () => {
    const none = run();
    const withCat = run({ filters: { category_ids: ["rice-meals"] } });
    expect(withCat.facets.categories).toEqual(none.facets.categories);
    const snacks = withCat.facets.categories.find((c) => c.id === "snacks");
    expect(snacks?.count).toBe([...cats.values()].filter((c) => c.includes("snacks")).length);
  });

  test("category facets do apply the other filters", () => {
    const r = run({ filters: { max_price_minor: 2000 } });
    const rice = r.facets.categories.find((c) => c.id === "rice-meals");
    expect(rice?.count).toBe(0);
  });

  test("histogram ignores min/max (stable while dragging) but applies the rest", () => {
    const a = run();
    const b = run({ filters: { min_price_minor: 2000, max_price_minor: 3000 } });
    expect(b.facets.price).toEqual(a.facets.price);
    const total = a.facets.price.buckets.reduce((n, x) => n + x.count, 0);
    expect(total).toBe(a.item_count);
    const food = run({ scope: "food" });
    expect(food.facets.price.buckets.reduce((n, x) => n + x.count, 0)).toBe(food.item_count);
  });

  test("empty set histogram", () => {
    const r = run({ q: "pizza" });
    expect(r.facets.price).toEqual({ buckets: [], min: null, max: null });
  });
});

describe("availability", () => {
  test("closed and sold-out items appear, labelled, unless filtered", () => {
    // Paginate fully: the catalog now spans more than one page, and closed /
    // sold-out items rank last.
    const byId = new Map(allItems().map((i) => [i.item_id, i]));
    expect(byId.get("lm-banku-tilapia")?.status).toBe("closed");
    expect(byId.get("dr-orange-juice")?.status).toBe("sold_out");
    expect(byId.get("gr-eggs-crate")?.orderable).toBe(false);
    expect(byId.get("gr-brown-bread")?.orderable).toBe(false);
    expect(allIds({ filters: { open_now: true } })).not.toContain("lm-banku-tilapia");
    expect(allIds({ filters: { open_now: true } })).not.toContain("dr-iced-coffee");
    const inStock = allIds({ filters: { in_stock_only: true } });
    for (const id of ["dr-orange-juice", "gr-eggs-crate", "gr-brown-bread", "bk-meat-pie"]) {
      expect(inStock).not.toContain(id);
    }
    // Vendor open is a separate condition from orderable.
    expect(inStock).toContain("lm-banku-tilapia");
  });

  test("offers_only matches nothing (no sale prices exist)", () => {
    expect(run({ filters: { offers_only: true } }).item_count).toBe(0);
  });
});

describe("coverage and empty reasons", () => {
  test("mock coverage radius around Accra", () => {
    const { center, radiusKm } = MOCK_COVERAGE;
    expect(radiusKm).toBe(30);
    expect(isWithinMockCoverage({ latitude: 5.6506, longitude: -0.1962 }, center, radiusKm)).toBe(true);
    // Kumasi
    expect(isWithinMockCoverage({ latitude: 6.6885, longitude: -1.6244 }, center, radiusKm)).toBe(false);
    expect(isWithinMockCoverage(null, center, radiusKm)).toBe(true);
  });

  test("classified empty states", () => {
    const far = runDiscoveryQuery(mockDiscoveryCatalog, req(), { now: NOW, covered: false });
    expect(far.item_count).toBe(0);
    expect(far.empty_reason).toBe("not_covered");
    expect(run({ q: "pizza" }).empty_reason).toBe("no_query_matches");
    expect(run({ q: "fufu", filters: { open_now: true } }).empty_reason).toBe("stores_closed");
    expect(run({ filters: { max_price_minor: 100 } }).empty_reason).toBe("filters_exclude");
    expect(run().empty_reason).toBeNull();
  });

  test("query length: blank browses, 121 chars is a 422", () => {
    expect(run({ q: "   " }).item_count).toBe(run().item_count);
    expect(() => run({ q: "a".repeat(121) })).toThrow(DiscoveryError);
  });
});

describe("ranking", () => {
  test("ties are stable by item_id; open/orderable first only within a tier", () => {
    const items = run().items ?? [];
    const ready = items.filter((i) => i.vendor_open && i.orderable).map((i) => i.item_id);
    const rest = items.filter((i) => !(i.vendor_open && i.orderable)).map((i) => i.item_id);
    expect(items.map((i) => i.item_id)).toEqual([...ready, ...rest]);
    expect(ready).toEqual([...ready].sort());
    expect(rest).toEqual([...rest].sort());
  });

  test("exact name beats prefix beats token, regardless of availability", () => {
    const r = ids({ q: "chicken jollof" });
    expect(r[0]).toBe("cg-chicken-jollof");
    expect(r).toContain("lm-jollof-chicken");
  });

  test("price sorts tie-break by item_id", () => {
    // Every page: the catalog no longer fits in one 50-item page.
    const asc = allItems({ sort: "price_asc" });
    for (let i = 1; i < asc.length; i++) {
      const a = asc[i - 1];
      const b = asc[i];
      expect(a.price_minor < b.price_minor || (a.price_minor === b.price_minor && a.item_id < b.item_id)).toBe(true);
    }
    const desc = allItems({ sort: "price_desc" });
    for (let i = 1; i < desc.length; i++) {
      const a = desc[i - 1];
      const b = desc[i];
      expect(a.price_minor > b.price_minor || (a.price_minor === b.price_minor && a.item_id < b.item_id)).toBe(true);
    }
    const at4000 = asc.filter((i) => i.price_minor === 4000).map((i) => i.item_id);
    expect(at4000).toEqual(["cg-chicken-jollof", "lm-beef-veggie-rice"]);
  });
});

describe("query interpretation", () => {
  test("confident correction is labelled, not silently substituted", () => {
    const r = run({ q: "jolof" });
    expect(r.query_interpretation.corrected_q).toBe("jollof");
    expect(r.query_interpretation.suggested_q).toBeNull();
    expect((r.items ?? []).map((i) => i.item_id)).toContain("lm-jollof-chicken");
    expect(run({ q: "rice" }).query_interpretation.corrected_q).toBeNull();
  });

  test("ambiguous typo: offered as a suggestion, query kept", () => {
    const r = run({ q: "milt" });
    expect(r.query_interpretation.corrected_q).toBeNull();
    expect(r.query_interpretation.suggested_q).toBe("milk");
  });

  test("normalization: NFKD, diacritics, case, whitespace", () => {
    const vocab = new Set(["jollof", "cafe"]);
    expect(interpretQuery("  JÓLLOF  ", vocab).normalized).toBe("jollof");
    expect(interpretQuery("Café", vocab).normalized).toBe("cafe");
    expect(interpretQuery("ｊｏｌｌｏｆ", vocab).normalized).toBe("jollof");
  });

  test("unique one-edit typo for words >= 4 chars", () => {
    const vocab = new Set(["chicken", "rice"]);
    expect(interpretQuery("chickn", vocab).corrected).toBe("chicken");
    expect(interpretQuery("ric", vocab).corrected).toBeNull();
    expect(interpretQuery("breax", new Set(["bread", "break"])).suggested).toBe("bread");
  });
});

describe("cursor pagination", () => {
  test("pages cover every item exactly once", () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let total = 0;
    do {
      const r = run({ limit: 7, cursor });
      total = r.item_count;
      seen.push(...(r.items ?? []).map((i) => i.item_id));
      cursor = r.next_cursor;
    } while (cursor);
    expect(seen.length).toBe(total);
    expect(new Set(seen).size).toBe(total);
  });

  test("stale cursor after a data revision change -> CURSOR_STALE (409)", () => {
    const first = run({ limit: 5 });
    expect(first.next_cursor).toMatch(/^c1\./);
    const changed = { ...mockDiscoveryCatalog, revision: mockDiscoveryCatalog.revision + 1 };
    expect.assertions(4);
    try {
      run({ limit: 5, cursor: first.next_cursor }, changed);
    } catch (e) {
      expect((e as DiscoveryError).code).toBe("CURSOR_STALE");
      expect((e as DiscoveryError).status).toBe(409);
    }
    // A cursor from another query is stale too: never mix pages.
    expect(() => run({ limit: 5, cursor: first.next_cursor, sort: "price_asc" })).toThrow(DiscoveryError);
  });

  test("preview returns count and facets, no items", () => {
    const r = run({ purpose: "preview", limit: 0 });
    expect(r.items).toBeUndefined();
    expect(r.item_count).toBeGreaterThan(0);
    expect(r.revision).toBe(mockDiscoveryCatalog.revision);
    expect(r.computed_at).toBe(NOW.toISOString());
    expect(r.freshness).toBe("live");
  });
});

describe("home surface", () => {
  test("bounded rails, a vendor rail, distinct count once", () => {
    const filters = { category_ids: ["rice-meals", "local-dishes"] };
    const r = run({ surface: "home", limit: 10, filters });
    const itemModules = (r.modules ?? []).filter((m) => m.type === "items");
    expect(itemModules.map((m) => m.id)).toEqual(["cat-local-dishes", "cat-rice-meals"]);
    for (const m of itemModules) if (m.type === "items") expect(m.items.length).toBeLessThanOrEqual(10);
    expect((r.modules ?? []).some((m) => m.type === "vendors")).toBe(true);
    const appearances = itemModules.flatMap((m) => (m.type === "items" ? m.items.map((i) => i.item_id) : []));
    expect(appearances.filter((id) => id === "lm-jollof-chicken").length).toBe(2);
    // Distinct count over every match, not over the (truncated) rails: an
    // item in both categories counts once.
    const matched = allIds({ filters });
    expect(new Set(matched).size).toBe(matched.length);
    expect(r.item_count).toBe(matched.length);
    expect(matched).toEqual(expect.arrayContaining([...new Set(appearances)]));
  });
});

describe("suggestions", () => {
  const sreq = (q: string, filters: Partial<DiscoveryFilters> = {}, scope: "all" | "food" | "groceries" = "all") =>
    runDiscoverySuggestions(
      mockDiscoveryCatalog,
      { context_id: "ctx", context_revision: 1, q, scope, filters: { ...DEFAULT_DISCOVERY_FILTERS, ...filters }, limit: 3 },
      ENV,
    );

  test("start at 2 characters, bounded groups", () => {
    expect(sreq("c")).toMatchObject({ queries: [], items: [], stores: [] });
    const s = sreq("ch");
    expect(s.queries.length).toBeLessThanOrEqual(3);
    expect(s.items.length).toBeLessThanOrEqual(3);
    expect(s.stores.length).toBeLessThanOrEqual(3);
    expect(sreq("jol").queries.map((x) => x.text)).toContain("Jollof rice");
  });

  test("stores need >= 1 matching eligible item under the current filters", () => {
    expect(sreq("lakeside").stores.map((x) => x.name)).toEqual(["Lakeside Chop Bar"]);
    expect(sreq("lakeside", { open_now: true }).stores).toEqual([]);
    expect(sreq("campus", {}, "groceries").stores.map((x) => x.name)).toEqual(["Campus Mart"]);
  });
});
