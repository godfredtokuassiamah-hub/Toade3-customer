/// <reference types="jest" />
import type { MockVendor } from "../../discovery/types";
import {
  addressLine,
  directionsUrls,
  hoursRange,
  infoRowVisibility,
  mapUrls,
  openStatusTitle,
  ratingBasisText,
  serviceTypeLabels,
  telUrl,
  toMapsPlatform,
  vendorCoordinates,
} from "../vendorInfo";

const DEST = { latitude: 5.608, longitude: -0.185 };

const FULL: MockVendor = {
  vendor_id: "v-test",
  name: "Petals & Co.",
  hours: { open: "07:00", close: "22:00" },
  paused: false,
  rating: { value: 4.5, count: 7839 },
  phone: "+233 20 000 0001",
  addressLabel: "JR3F+QV Accra",
  latitude: 5.608,
  longitude: -0.185,
  serviceTypes: ["delivery", "scheduled"],
};

describe("toMapsPlatform", () => {
  test.each([
    ["ios", "ios"],
    ["android", "android"],
    ["web", "other"],
    ["windows", "other"],
  ])("%s -> %s", (os, expected) => {
    expect(toMapsPlatform(os)).toBe(expected);
  });
});

describe("directionsUrls", () => {
  it("iOS: Apple Maps driving directions, Google fallback", () => {
    expect(directionsUrls(DEST, "Medie Foods", "ios")).toEqual({
      primary: "https://maps.apple.com/?daddr=5.608,-0.185&dirflg=d",
      fallback: "https://www.google.com/maps/dir/?api=1&destination=5.608%2C-0.185",
    });
  });

  it("Android: Google Maps directions, labelled geo: fallback", () => {
    expect(directionsUrls(DEST, "Petals & Co.", "android")).toEqual({
      primary: "https://www.google.com/maps/dir/?api=1&destination=5.608%2C-0.185",
      fallback: "geo:5.608,-0.185?q=5.608,-0.185(Petals%20%26%20Co.)",
    });
  });

  it("other: Google https for both", () => {
    const urls = directionsUrls(DEST, "X", "other");
    expect(urls.primary).toBe("https://www.google.com/maps/dir/?api=1&destination=5.608%2C-0.185");
    expect(urls.fallback).toBe(urls.primary);
  });

  it("trims float noise in coordinates", () => {
    const urls = directionsUrls({ latitude: 5.6000000001, longitude: -0.1 }, "X", "ios");
    expect(urls.primary).toBe("https://maps.apple.com/?daddr=5.6,-0.1&dirflg=d");
  });
});

describe("mapUrls", () => {
  it("iOS with coordinates: labelled Apple Maps pin", () => {
    expect(mapUrls(FULL, "ios")).toEqual({
      primary: "https://maps.apple.com/?ll=5.608,-0.185&q=Petals%20%26%20Co.",
      fallback: "https://www.google.com/maps/search/?api=1&query=5.608%2C-0.185",
    });
  });

  it("Android with coordinates: Google search, geo: fallback", () => {
    expect(mapUrls(FULL, "android")).toEqual({
      primary: "https://www.google.com/maps/search/?api=1&query=5.608%2C-0.185",
      fallback: "geo:5.608,-0.185?q=5.608,-0.185(Petals%20%26%20Co.)",
    });
  });

  it("address only: encoded query", () => {
    const v = { name: "Lakeside", addressLabel: "Lakeside Estates, Accra" };
    expect(mapUrls(v, "ios")).toEqual({
      primary: "https://maps.apple.com/?q=Lakeside%20Estates%2C%20Accra",
      fallback: "https://www.google.com/maps/search/?api=1&query=Lakeside%20Estates%2C%20Accra",
    });
    expect(mapUrls(v, "android")?.primary).toBe(
      "https://www.google.com/maps/search/?api=1&query=Lakeside%20Estates%2C%20Accra",
    );
  });

  it("neither coordinates nor address: null", () => {
    expect(mapUrls({ name: "X" }, "ios")).toBeNull();
    expect(mapUrls({ name: "X", addressLabel: "   " }, "android")).toBeNull();
  });
});

describe("telUrl", () => {
  it("strips formatting and keeps a leading +", () => {
    expect(telUrl("+233 20 000 0001")).toBe("tel:+233200000001");
    expect(telUrl("020-000-0001")).toBe("tel:0200000001");
  });

  test.each([[undefined], [""], ["   "], ["call us"]])("%p -> null", (phone) => {
    expect(telUrl(phone)).toBeNull();
  });
});

describe("openStatusTitle", () => {
  const hours = { open: "07:00", close: "22:00" };
  it("open -> Open now", () => {
    expect(openStatusTitle({ paused: false, hours }, true)).toBe("Open now");
  });
  it("paused -> Closed", () => {
    expect(openStatusTitle({ paused: true, hours }, false)).toBe("Closed");
  });
  it("closed by hours -> Opens at HH:MM", () => {
    expect(openStatusTitle({ paused: false, hours }, false)).toBe("Opens at 07:00");
  });
});

describe("hoursRange", () => {
  it("formats with an en dash", () => {
    expect(hoursRange({ open: "07:00", close: "22:00" })).toBe("07:00–22:00");
  });
  it("shows an all-day close of 24:00 as 23:59", () => {
    expect(hoursRange({ open: "00:00", close: "24:00" })).toBe("00:00–23:59");
  });
});

describe("serviceTypeLabels", () => {
  it("de-duplicates in a fixed order", () => {
    expect(serviceTypeLabels(["pickup", "delivery", "scheduled", "delivery"])).toEqual([
      "Delivery",
      "Scheduled delivery",
      "Pickup",
    ]);
  });
  it("undefined / [] -> []", () => {
    expect(serviceTypeLabels(undefined)).toEqual([]);
    expect(serviceTypeLabels([])).toEqual([]);
  });
});

describe("ratingBasisText", () => {
  test.each([
    [1, "based on 1 rating"],
    [7839, "based on 7,839 ratings"],
    [1234567, "based on 1,234,567 ratings"],
    [0, "based on 0 ratings"],
    [-5, "based on 0 ratings"],
    [12.7, "based on 12 ratings"],
    [Number.NaN, "based on 0 ratings"],
  ])("%p -> %s", (count, expected) => {
    expect(ratingBasisText(count)).toBe(expected);
  });
});

describe("vendorCoordinates", () => {
  it("returns valid coordinates", () => {
    expect(vendorCoordinates({ latitude: 5.6, longitude: -0.2 })).toEqual({
      latitude: 5.6,
      longitude: -0.2,
    });
  });
  test.each([
    [{ latitude: Number.NaN, longitude: 0 }],
    [{ latitude: 91, longitude: 0 }],
    [{ latitude: 0, longitude: -181 }],
    [{ latitude: 5.6 }],
    [{ longitude: -0.2 }],
    [{}],
  ])("%p -> null", (v) => {
    expect(vendorCoordinates(v)).toBeNull();
  });
});

describe("addressLine", () => {
  it("prefers the address label, else coordinates", () => {
    expect(addressLine(FULL)).toBe("JR3F+QV Accra");
    expect(addressLine({ name: "X", latitude: 5.6, longitude: -0.2 })).toBe("5.6, -0.2");
    expect(addressLine({ name: "X" })).toBeNull();
  });
});

describe("infoRowVisibility", () => {
  const BASE: MockVendor = {
    vendor_id: "v-base",
    name: "Base",
    hours: { open: "07:00", close: "22:00" },
    paused: false,
  };

  it("full vendor shows everything", () => {
    expect(infoRowVisibility(FULL)).toEqual({
      call: true,
      address: true,
      map: true,
      services: true,
      rating: true,
    });
  });

  it("phone only", () => {
    expect(infoRowVisibility({ ...BASE, phone: "+233 20 000 0002" })).toEqual({
      call: true,
      address: false,
      map: false,
      services: false,
      rating: false,
    });
  });

  it("address only keeps the address row but no map/directions", () => {
    expect(infoRowVisibility({ ...BASE, addressLabel: "Lakeside Estates, Accra" })).toEqual({
      call: false,
      address: true,
      map: false,
      services: false,
      rating: false,
    });
  });

  it("unrated vendor hides the rating block", () => {
    expect(infoRowVisibility({ ...FULL, rating: undefined }).rating).toBe(false);
  });
});
