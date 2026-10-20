/// <reference types="jest" />
import { CATEGORIES } from "../../../data/mock/catalog";
import {
  type AppliedDiscovery,
  appliedChips,
  appliedGroupCount,
  DEFAULT_APPLIED,
  DEFAULT_DISCOVERY_FILTERS,
  type DraftAction,
  draftFromApplied,
  draftToApplied,
  type DraftState,
  isDraftDefault,
  isUpTo50Selected,
  makeDraftReducer,
  PRICE_ERROR,
  revalidateApplied,
  showItemsLabel,
  stateCopy,
} from "../filterState";
import { PRICE_FORMAT_ERROR } from "../money";

const reducer = makeDraftReducer(CATEGORIES);
const run = (state: DraftState, ...actions: DraftAction[]) => actions.reduce(reducer, state);
const base = () => draftFromApplied(DEFAULT_APPLIED);

describe("defaults and reset", () => {
  test("neutral defaults: both availability switches OFF", () => {
    expect(DEFAULT_DISCOVERY_FILTERS).toEqual({
      category_ids: [],
      min_price_minor: null,
      max_price_minor: null,
      open_now: false,
      in_stock_only: false,
      offers_only: false,
    });
    expect(DEFAULT_APPLIED).toEqual({
      q: "",
      scope: "all",
      sort: "best_match",
      filters: DEFAULT_DISCOVERY_FILTERS,
    });
    expect(isDraftDefault(base())).toBe(true);
  });

  test("reset restores every default but keeps the query", () => {
    const edited = run(
      { ...base(), q: "rice" },
      { type: "setScope", scope: "food" },
      { type: "toggleCategory", id: "rice-meals" },
      { type: "setMinText", text: "10" },
      { type: "setMaxText", text: "40" },
      { type: "toggleOpenNow" },
      { type: "setInStock", value: true },
      { type: "setSort", sort: "price_desc" },
    );
    expect(isDraftDefault(edited)).toBe(false);
    const reset = reducer(edited, { type: "reset" });
    expect(isDraftDefault(reset)).toBe(true);
    expect(reset.q).toBe("rice");
    expect(draftToApplied(reset)).toEqual({ ...DEFAULT_APPLIED, q: "rice" });
  });

  test("every edit bumps editSeq (invalidates an older Apply)", () => {
    const s = base();
    const a = reducer(s, { type: "toggleOpenNow" });
    expect(a.editSeq).toBe(s.editSeq + 1);
    expect(reducer(a, { type: "setScope", scope: "all" })).toBe(a);
  });
});

describe("Up to GHS 50 tile", () => {
  test("sets min=null, max=5000; selection is derived; tapping again clears both", () => {
    const on = run({ ...base(), minText: "10", filters: { ...base().filters, min_price_minor: 1000 } }, {
      type: "toggleUpTo50",
    });
    expect(on.filters.min_price_minor).toBeNull();
    expect(on.filters.max_price_minor).toBe(5000);
    expect(isUpTo50Selected(on)).toBe(true);
    const off = reducer(on, { type: "toggleUpTo50" });
    expect(off.filters.min_price_minor).toBeNull();
    expect(off.filters.max_price_minor).toBeNull();
    expect(isUpTo50Selected(off)).toBe(false);
  });

  test("typing exactly 50.00 selects it; any min or other max deselects it", () => {
    expect(isUpTo50Selected(run(base(), { type: "setMaxText", text: "50.00" }))).toBe(true);
    const on = run(base(), { type: "toggleUpTo50" });
    expect(isUpTo50Selected(reducer(on, { type: "setMinText", text: "5" }))).toBe(false);
    expect(isUpTo50Selected(reducer(on, { type: "setMaxText", text: "50.01" }))).toBe(false);
  });

  test("Open now tile and switch drive the same value, no hidden rule", () => {
    const on = run(base(), { type: "toggleOpenNow" });
    expect(on.filters).toEqual({ ...DEFAULT_DISCOVERY_FILTERS, open_now: true });
    expect(reducer(on, { type: "setOpenNow", value: false }).filters.open_now).toBe(false);
  });
});

describe("price fields", () => {
  test("min > max is a field error on Maximum; values are never swapped", () => {
    const s = run(base(), { type: "setMinText", text: "60" }, { type: "setMaxText", text: "20" });
    expect(s.fieldErrors).toEqual({ max: PRICE_ERROR });
    expect(s.minText).toBe("60");
    expect(s.maxText).toBe("20");
    expect(draftToApplied(s)).toBeNull();
    const fixed = reducer(s, { type: "setMaxText", text: "60" });
    expect(fixed.fieldErrors).toEqual({});
    expect(draftToApplied(fixed)?.filters).toMatchObject({ min_price_minor: 6000, max_price_minor: 6000 });
  });

  test("malformed input is a field error on that field", () => {
    const s = run(base(), { type: "setMinText", text: "45.555" });
    expect(s.fieldErrors).toEqual({ min: PRICE_FORMAT_ERROR });
    expect(draftToApplied(s)).toBeNull();
    expect(run(base(), { type: "setMaxText", text: "-1" }).fieldErrors).toEqual({ max: PRICE_FORMAT_ERROR });
  });

  test("a typed value is a finite bound; blank is unbounded", () => {
    const s = run(base(), { type: "setMaxText", text: "200" });
    expect(draftToApplied(s)?.filters.max_price_minor).toBe(20000);
    expect(draftToApplied(reducer(s, { type: "setMaxText", text: "" }))?.filters.max_price_minor).toBeNull();
  });

  test("slider range writes both values and texts; null = unbounded", () => {
    const s = run(base(), { type: "setRange", min: 1250, max: null });
    expect(s.minText).toBe("12.50");
    expect(s.maxText).toBe("");
    expect(s.filters.min_price_minor).toBe(1250);
    expect(s.filters.max_price_minor).toBeNull();
  });
});

describe("scope switch", () => {
  test("removes incompatible categories, keeps budget/availability/sort, announces", () => {
    const s = run(
      base(),
      { type: "toggleCategory", id: "rice-meals" },
      { type: "toggleCategory", id: "eggs-dairy" },
      { type: "setMaxText", text: "50" },
      { type: "toggleOpenNow" },
      { type: "setInStock", value: true },
      { type: "setSort", sort: "price_asc" },
      { type: "setScope", scope: "groceries" },
    );
    expect(s.scope).toBe("groceries");
    expect(s.filters.category_ids).toEqual(["eggs-dairy"]);
    expect(s.filters.max_price_minor).toBe(5000);
    expect(s.filters.open_now).toBe(true);
    expect(s.filters.in_stock_only).toBe(true);
    expect(s.sort).toBe("price_asc");
    expect(s.notice?.text).toBe("Categories updated for Groceries.");
    const food = reducer(s, { type: "setScope", scope: "food" });
    expect(food.notice?.text).toBe("Categories updated for Food.");
  });

  test("no notice when nothing was removed", () => {
    expect(run(base(), { type: "setScope", scope: "food" }).notice).toBeNull();
  });
});

describe("applied group counting and chips", () => {
  const applied: AppliedDiscovery = {
    q: "rice",
    scope: "food",
    sort: "price_desc",
    filters: {
      category_ids: ["rice-meals", "local-dishes"],
      min_price_minor: 1000,
      max_price_minor: 5000,
      open_now: true,
      in_stock_only: true,
      offers_only: false,
    },
  };

  test("price is one group, categories one group, scope counts, sort does not", () => {
    expect(appliedGroupCount(applied)).toBe(5);
    expect(appliedGroupCount({ ...applied, sort: "best_match" })).toBe(5);
    expect(appliedGroupCount({ ...applied, scope: "all" })).toBe(4);
    expect(appliedGroupCount(DEFAULT_APPLIED)).toBe(0);
    expect(appliedGroupCount({ ...DEFAULT_APPLIED, sort: "price_asc" })).toBe(0);
    expect(
      appliedGroupCount({ ...DEFAULT_APPLIED, filters: { ...DEFAULT_DISCOVERY_FILTERS, max_price_minor: 5000 } }),
    ).toBe(1);
  });

  test("chips: one per group, sort separate, removal keeps the rest", () => {
    const { groups, sort } = appliedChips(applied, (id) => id);
    expect(groups.map((g) => g.label)).toEqual([
      "Food",
      "rice-meals +1",
      "GHS 10 – GHS 50",
      "Open now",
      "Available items only",
    ]);
    expect(sort?.label).toBe("Sort: Price: high to low");
    const noPrice = groups[2].remove(applied);
    expect(noPrice.filters.min_price_minor).toBeNull();
    expect(noPrice.filters.max_price_minor).toBeNull();
    expect(noPrice.q).toBe("rice");
    expect(appliedChips({ ...applied, sort: "best_match" }, (id) => id).sort).toBeNull();
  });

  test("revalidation drops category ids outside the scope", () => {
    const r = revalidateApplied({ ...applied, filters: { ...applied.filters, category_ids: ["rice-meals", "eggs-dairy", "gone"] } }, CATEGORIES);
    expect(r.filters.category_ids).toEqual(["rice-meals"]);
  });
});

describe("copy", () => {
  test("footer grammar and exact failure copy", () => {
    expect(showItemsLabel(0)).toBe("Show 0 items");
    expect(showItemsLabel(1)).toBe("Show 1 item");
    expect(showItemsLabel(12)).toBe("Show 12 items");
    expect(stateCopy("no_query_matches", " pizza ").message).toBe(
      'No matches for "pizza". Try another name or browse a category.',
    );
    expect(stateCopy("no_query_matches", "x").actions.map((a) => a.label)).toEqual([
      "Clear search",
      "Browse categories",
    ]);
    expect(stateCopy("filters_exclude", "").message).toBe(
      "Nothing matches these filters. Try a wider price range or remove a filter.",
    );
    expect(stateCopy("stores_closed", "").message).toBe(
      "Stores nearby are closed. Browse their menus or turn off Open now.",
    );
    expect(stateCopy("not_covered", "").message).toBe(
      "We are not delivering here yet. Choose another supported drop-off point.",
    );
    expect(stateCopy("offline", "").message).toBe(
      "Results could not load. Check your connection and try again.",
    );
  });
});
