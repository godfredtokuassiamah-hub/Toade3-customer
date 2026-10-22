import { type Store, STORES } from "../../../data/mock/stores";
import { DEFAULT_DROPOFF } from "../deliveryQuote";
import {
  buildStoreSections,
  isStoreSectionId,
  quoteStores,
  storesForSection,
} from "../storeSections";

const store = (id: string, category: Store["category"], dLat: number, open = true): Store => ({
  id,
  name: id,
  category,
  latitude: DEFAULT_DROPOFF.latitude + dLat,
  longitude: DEFAULT_DROPOFF.longitude,
  prepMins: [5, 10],
  open,
});

describe("buildStoreSections", () => {
  const stores = [
    store("far-grocer", "groceries", 0.03),
    store("near-grocer", "groceries", 0.002),
    store("pharmacy", "pharmacy", 0.01),
  ];

  it("hides empty sections", () => {
    const ids = buildStoreSections(stores, DEFAULT_DROPOFF, null).map((s) => s.id);
    expect(ids).toEqual(["near-you", "fast-delivery", "groceries", "pharmacy-health"]);
  });

  it("sorts near you by distance", () => {
    const near = buildStoreSections(stores, DEFAULT_DROPOFF, null)[0];
    expect(near.stores.map((s) => s.store.id)).toEqual(["near-grocer", "pharmacy", "far-grocer"]);
  });

  it("fast delivery keeps open stores with eta max <= 30", () => {
    const fast = storesForSection(stores, DEFAULT_DROPOFF, "fast-delivery", null);
    // near-grocer: 5+15..10+15 = 20-25; pharmacy (~1.1 km): 20-35; far: 30-45.
    expect(fast.map((s) => s.store.id)).toEqual(["near-grocer"]);
  });

  it("narrows every section to the selected category", () => {
    const sections = buildStoreSections(stores, DEFAULT_DROPOFF, "pharmacy");
    expect(sections.every((s) => s.stores.every((q) => q.store.category === "pharmacy"))).toBe(true);
    expect(sections.map((s) => s.id)).not.toContain("groceries");
  });

  it("mock directory: varied zones, some too far, some closed", () => {
    const quoted = quoteStores(STORES, DEFAULT_DROPOFF);
    expect(quoted.some((q) => !q.quote.deliverable)).toBe(true);
    const fees = new Set(quoted.flatMap((q) => (q.quote.deliverable ? [q.quote.feeMinor] : [])));
    expect(fees.size).toBeGreaterThanOrEqual(3);
    expect(STORES.some((s) => !s.open)).toBe(true);
    expect(new Set(STORES.map((s) => s.id)).size).toBe(STORES.length);
  });

  it("validates section ids", () => {
    expect(isStoreSectionId("near-you")).toBe(true);
    expect(isStoreSectionId("nope")).toBe(false);
    expect(isStoreSectionId(undefined)).toBe(false);
  });
});
