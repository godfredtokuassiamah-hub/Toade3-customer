/// <reference types="jest" />
import {
  LOCATION_REFRESH_MS,
  movedEnough,
  pickLocationLabel,
  shortLabelFromParts,
  shouldRefresh,
} from "../locationLabel";

describe("shortLabelFromParts", () => {
  test("street wins", () => {
    expect(
      shortLabelFromParts({ name: "Hall 3", street: "University Avenue", district: "Legon" }),
    ).toBe("University Avenue");
  });
  test("then district, name, city, subregion", () => {
    expect(shortLabelFromParts({ name: "Hall 3", district: "Legon", city: "Accra" })).toBe("Legon");
    expect(shortLabelFromParts({ name: "Hall 3", city: "Accra" })).toBe("Hall 3");
    expect(shortLabelFromParts({ city: "Accra", subregion: "Ga East" })).toBe("Accra");
    expect(shortLabelFromParts({ subregion: "Ga East" })).toBe("Ga East");
  });
  test("blanks are skipped; nothing -> null", () => {
    expect(shortLabelFromParts({ street: "  ", district: "Legon" })).toBe("Legon");
    expect(shortLabelFromParts({ street: null, name: "" })).toBeNull();
    expect(shortLabelFromParts({})).toBeNull();
  });
});

describe("pickLocationLabel", () => {
  const base = {
    picked: "Picked",
    live: "Live",
    savedLocation: "Saved",
    permissionGranted: true,
    address: "Address",
    fallback: "Set delivery address",
  };
  test("picked address wins", () => {
    expect(pickLocationLabel(base)).toBe("Picked");
  });
  test("then live", () => {
    expect(pickLocationLabel({ ...base, picked: null })).toBe("Live");
  });
  test("saved location only while permission is granted", () => {
    expect(pickLocationLabel({ ...base, picked: null, live: null })).toBe("Saved");
    expect(
      pickLocationLabel({ ...base, picked: null, live: null, permissionGranted: false }),
    ).toBe("Address");
  });
  test("then address, then fallback", () => {
    expect(
      pickLocationLabel({ ...base, picked: null, live: null, savedLocation: null }),
    ).toBe("Address");
    expect(
      pickLocationLabel({
        ...base,
        picked: null,
        live: null,
        savedLocation: null,
        address: null,
      }),
    ).toBe("Set delivery address");
  });
  test("blank values are skipped", () => {
    expect(
      pickLocationLabel({ ...base, picked: " ", live: "", savedLocation: "  ", address: "Address" }),
    ).toBe("Address");
  });
});

describe("shouldRefresh", () => {
  test("never refreshed -> true", () => {
    expect(shouldRefresh(null, 1000, LOCATION_REFRESH_MS)).toBe(true);
  });
  test("before the interval -> false; at/after -> true", () => {
    expect(shouldRefresh(0, LOCATION_REFRESH_MS - 1, LOCATION_REFRESH_MS)).toBe(false);
    expect(shouldRefresh(0, LOCATION_REFRESH_MS, LOCATION_REFRESH_MS)).toBe(true);
  });
});

describe("movedEnough", () => {
  const a = { lat: 5.6037, lng: -0.187 };
  // ~111 m per 0.001 deg latitude.
  test("no previous point -> true", () => {
    expect(movedEnough(null, a, 100)).toBe(true);
  });
  test("~50 m -> false", () => {
    expect(movedEnough(a, { lat: a.lat + 0.00045, lng: a.lng }, 100)).toBe(false);
  });
  test("~150 m -> true", () => {
    expect(movedEnough(a, { lat: a.lat + 0.00135, lng: a.lng }, 100)).toBe(true);
  });
});
