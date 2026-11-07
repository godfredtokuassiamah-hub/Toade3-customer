import type { DeliveryAddress } from "../deliveryAddress";
import { liveToAddress, type LivePlace, parsePoint, shouldOfferMove } from "../movedPrompt";

// deliveryAddress imports AsyncStorage; the native module isn't in Jest.
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// ~111 m per 0.001 deg of latitude.
const home: DeliveryAddress = {
  id: "home",
  title: "Home",
  subtitle: "Madina",
  latitude: 5.68,
  longitude: -0.17,
  plusCode: "",
};

function live(latitude: number, longitude = -0.17): LivePlace {
  return { title: "Here", subtitle: "Accra", lat: latitude, lng: longitude, shortLabel: "Here St" };
}

describe("shouldOfferMove", () => {
  test("no prompt without an address or a live position", () => {
    expect(shouldOfferMove({ active: null, live: live(5.7), dismissedAt: null })).toBe(false);
    expect(shouldOfferMove({ active: home, live: null, dismissedAt: null })).toBe(false);
  });

  test("no prompt while near the delivery address", () => {
    // ~330 m away.
    expect(shouldOfferMove({ active: home, live: live(5.683), dismissedAt: null })).toBe(false);
  });

  test("prompt once 500 m or more away", () => {
    // ~1.1 km away.
    expect(shouldOfferMove({ active: home, live: live(5.69), dismissedAt: null })).toBe(true);
  });

  test("dismissing silences it until the user moves another 500 m", () => {
    const dismissedAt = { latitude: 5.69, longitude: -0.17 };
    expect(shouldOfferMove({ active: home, live: live(5.691), dismissedAt })).toBe(false);
    expect(shouldOfferMove({ active: home, live: live(5.70), dismissedAt })).toBe(true);
  });
});

describe("liveToAddress", () => {
  test("keeps the device coordinates and adds a plus code", () => {
    const a = liveToAddress(live(5.69, -0.18));
    expect(a).toMatchObject({ title: "Here", subtitle: "Accra", latitude: 5.69, longitude: -0.18 });
    expect(a.id).toBe("5.69000,-0.18000");
    expect(a.plusCode).toMatch(/\+/);
  });
});

describe("parsePoint", () => {
  test("reads a stored point and rejects junk", () => {
    expect(parsePoint('{"latitude":1,"longitude":2}')).toEqual({ latitude: 1, longitude: 2 });
    expect(parsePoint(null)).toBeNull();
    expect(parsePoint("nope")).toBeNull();
    expect(parsePoint('{"latitude":"1","longitude":2}')).toBeNull();
  });
});
