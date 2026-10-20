import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  addRecent,
  addressId,
  dedupeAddresses,
  type DeliveryAddress,
  loadDeliveryState,
  parseRecents,
  saveDeliveryState,
} from "../deliveryAddress";

// Package-provided in-memory mock (the native module isn't in Jest).
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

function make(
  title: string,
  latitude: number,
  longitude: number,
  subtitle = "Accra",
): DeliveryAddress {
  return {
    id: addressId(latitude, longitude),
    title,
    subtitle,
    latitude,
    longitude,
    plusCode: "",
  };
}

const A = make("A", 5.6, -0.18);
const B = make("B", 5.7, -0.2);
const C = make("C", 5.8, -0.22);

describe("addRecent", () => {
  it("puts the new address first", () => {
    expect(addRecent([A, B], C).map((x) => x.title)).toEqual(["C", "A", "B"]);
  });

  it("moves an existing address to the front instead of duplicating", () => {
    expect(addRecent([A, B, C], B).map((x) => x.title)).toEqual(["B", "A", "C"]);
  });

  it("dedupes by proximity (< 25 m) and keeps the newest", () => {
    const nearA = make("A renamed", 5.60005, -0.18005);
    const out = addRecent([A, B], nearA);
    expect(out.map((x) => x.title)).toEqual(["A renamed", "B"]);
  });

  it("dedupes by same title + subtitle", () => {
    const sameName = make("a", 5.9, -0.3, " accra ");
    expect(addRecent([A], sameName)).toHaveLength(1);
  });

  it("caps the list", () => {
    const list = Array.from({ length: 10 }, (_, i) => make(`P${i}`, i, i));
    const out = addRecent(list, A, 8);
    expect(out).toHaveLength(8);
    expect(out[0]).toBe(A);
  });

  it("does not mutate the input", () => {
    const list = [A, B];
    addRecent(list, C);
    expect(list).toEqual([A, B]);
  });
});

describe("dedupeAddresses", () => {
  it("keeps the first of each place", () => {
    expect(dedupeAddresses([A, B, { ...A, title: "A2" }])).toEqual([A, B]);
  });
});

describe("parseRecents", () => {
  it("drops malformed entries and bad JSON", () => {
    expect(parseRecents("not json")).toEqual([]);
    expect(parseRecents(JSON.stringify([A, { id: 1 }, null]))).toEqual([A]);
    expect(parseRecents(null)).toEqual([]);
  });
});

describe("storage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("round-trips the active address and recents", async () => {
    await saveDeliveryState(A, [A, B]);
    expect(await loadDeliveryState()).toEqual({ active: A, recents: [A, B] });
  });

  it("loads empty state", async () => {
    expect(await loadDeliveryState()).toEqual({ active: null, recents: [] });
  });
});
