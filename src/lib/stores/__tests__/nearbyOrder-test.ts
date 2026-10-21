import type { Store } from "../../../data/mock/stores";
import { DEFAULT_DROPOFF } from "../deliveryQuote";
import { EMPTY_MAP_FILTER, filterMapStores } from "../mapStores";
import { indexFromOffset, orderByProximity } from "../nearbyOrder";
import { quoteStores } from "../storeSections";

const store = (id: string, dLat: number, dLng = 0, open = true): Store => ({
  id,
  name: id,
  category: "groceries",
  latitude: DEFAULT_DROPOFF.latitude + dLat,
  longitude: DEFAULT_DROPOFF.longitude + dLng,
  prepMins: [5, 10],
  open,
});

const ids = (list: { store: Store }[]) => list.map((s) => s.store.id);

describe("orderByProximity", () => {
  const stores = [
    store("a", 0),
    store("b", 0.01),
    store("c", 0.02),
    store("d", 0.035),
    store("e", -0.005),
  ];
  const quoted = quoteStores(stores, DEFAULT_DROPOFF);

  it("puts the selected store first, then ascending distance from it", () => {
    expect(ids(orderByProximity(quoted, stores[2]))).toEqual(["c", "b", "d", "a", "e"]);
  });

  it("measures from the selected store, not the drop-off", () => {
    expect(ids(orderByProximity(quoted, stores[3]))[1]).toBe("c");
  });

  it("breaks equal distances by store id", () => {
    const tied = quoteStores(
      [store("origin", 0), store("z-east", 0, 0.01), store("m-west", 0, -0.01), store("k-north", 0.01)],
      DEFAULT_DROPOFF,
    );
    const order = ids(orderByProximity(tied, tied.find((s) => s.store.id === "origin")!.store));
    expect(order[0]).toBe("origin");
    // East and west are exactly equidistant from the origin.
    expect(order.indexOf("m-west")).toBeLessThan(order.indexOf("z-east"));
  });

  it("orders only the filtered input", () => {
    const mixed = quoteStores([store("a", 0), store("closed", 0.001, 0, false), store("b", 0.01)], DEFAULT_DROPOFF);
    const visible = filterMapStores(mixed, { ...EMPTY_MAP_FILTER, openNow: true });
    expect(ids(orderByProximity(visible, visible[1].store))).toEqual(["b", "a"]);
  });

  it("does not add an origin missing from the list", () => {
    expect(ids(orderByProximity(quoted, store("x", 0.024)))).toEqual(["c", "d", "b", "a", "e"]);
  });
});

describe("indexFromOffset", () => {
  it("rounds to the nearest page and clamps", () => {
    expect(indexFromOffset(0, 300, 5)).toBe(0);
    expect(indexFromOffset(310, 300, 5)).toBe(1);
    expect(indexFromOffset(449, 300, 5)).toBe(1);
    expect(indexFromOffset(451, 300, 5)).toBe(2);
    expect(indexFromOffset(-40, 300, 5)).toBe(0);
    expect(indexFromOffset(9999, 300, 5)).toBe(4);
  });

  it("is 0 for an empty list or zero interval", () => {
    expect(indexFromOffset(500, 300, 0)).toBe(0);
    expect(indexFromOffset(500, 0, 3)).toBe(0);
  });
});
