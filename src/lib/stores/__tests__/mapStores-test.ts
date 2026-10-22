// TypeScript 6 no longer auto-includes @types/*, so pull in jest globals here.
/// <reference types="jest" />
import { STORES } from "../../../data/mock/stores";
import {
  EMPTY_MAP_FILTER,
  filterMapStores,
  isChipSelected,
  mapChips,
  mapTitle,
  markerSubtitle,
  storeCountLabel,
  storeInitials,
  toggleMapChip,
} from "../mapStores";
import type { QuotedStore } from "../storeSections";

const store = (id: string, category: QuotedStore["store"]["category"], open: boolean) => ({
  id,
  name: id,
  category,
  latitude: 0,
  longitude: 0,
  prepMins: [5, 10] as const,
  open,
});

const LIST: QuotedStore[] = [
  { store: store("a", "groceries", true), quote: { deliverable: true, distanceKm: 1, feeMinor: 500, etaMins: [15, 25] } },
  { store: store("b", "pharmacy", false), quote: { deliverable: true, distanceKm: 2, feeMinor: 800, etaMins: [20, 35] } },
  { store: store("c", "groceries", true), quote: { deliverable: false, distanceKm: 7 } },
];

const ids = (list: QuotedStore[]) => list.map((s) => s.store.id);

describe("mapChips", () => {
  test("fixed chips first, then each directory category once", () => {
    const chips = mapChips(STORES);
    expect(chips.slice(0, 2).map((c) => c.label)).toEqual(["Open now", "Delivers here"]);
    const categoryIds = chips.slice(2).map((c) => c.id);
    expect(new Set(categoryIds).size).toBe(categoryIds.length);
    expect(categoryIds[0]).toBe(`category:${STORES[0].category}`);
  });
});

describe("chip filtering", () => {
  test("no chips shows everything", () => {
    expect(ids(filterMapStores(LIST, EMPTY_MAP_FILTER))).toEqual(["a", "b", "c"]);
  });
  test("open now", () => {
    const f = toggleMapChip(EMPTY_MAP_FILTER, "open-now");
    expect(isChipSelected(f, "open-now")).toBe(true);
    expect(ids(filterMapStores(LIST, f))).toEqual(["a", "c"]);
  });
  test("delivers here", () => {
    const f = toggleMapChip(EMPTY_MAP_FILTER, "delivers-here");
    expect(ids(filterMapStores(LIST, f))).toEqual(["a", "b"]);
  });
  test("categories are OR'd, groups AND'd", () => {
    let f = toggleMapChip(EMPTY_MAP_FILTER, "category:groceries");
    f = toggleMapChip(f, "category:pharmacy");
    expect(ids(filterMapStores(LIST, f))).toEqual(["a", "b", "c"]);
    f = toggleMapChip(f, "delivers-here");
    f = toggleMapChip(f, "open-now");
    expect(ids(filterMapStores(LIST, f))).toEqual(["a"]);
  });
  test("toggling twice clears the chip", () => {
    const f = toggleMapChip(toggleMapChip(EMPTY_MAP_FILTER, "category:groceries"), "category:groceries");
    expect(isChipSelected(f, "category:groceries")).toBe(false);
    expect(f.categories).toEqual([]);
  });
});

describe("marker and title text", () => {
  test("marker subtitle: fee, Closed, Too far", () => {
    expect(markerSubtitle(LIST[0])).toBe("GHS 5.00");
    expect(markerSubtitle(LIST[1])).toBe("Closed");
    expect(markerSubtitle(LIST[2])).toBe("Too far");
  });
  test("store count", () => {
    expect(storeCountLabel(1)).toBe("1 store");
    expect(storeCountLabel(14)).toBe("14 stores");
    expect(storeCountLabel(0)).toBe("0 stores");
  });
  test("title", () => {
    expect(mapTitle("East Legon")).toBe("Stores near East Legon");
    expect(mapTitle("  ")).toBe("Stores near you");
    expect(mapTitle(null)).toBe("Stores near you");
  });
  test("initials", () => {
    expect(storeInitials("Petals & Co.")).toBe("PC");
    expect(storeInitials("Milk")).toBe("MI");
    expect(storeInitials("")).toBe("");
  });
});
