/// <reference types="jest" />
import {
  getItemsByVendor,
  getVendorById,
  getVendorIdForItem,
  ITEMS,
  VENDORS,
} from "../catalog";
import { getVendorLocation } from "../vendorLocations";

describe("mock storefront demo data (rating / promo placeholders)", () => {
  it("every discountPercent is an integer in 1-90", () => {
    const discounted = ITEMS.filter((i) => i.discountPercent != null);
    expect(discounted.length).toBeGreaterThan(0);
    for (const item of discounted) {
      expect(Number.isInteger(item.discountPercent)).toBe(true);
      expect(item.discountPercent).toBeGreaterThanOrEqual(1);
      expect(item.discountPercent).toBeLessThanOrEqual(90);
    }
  });

  it("only the three mock-order vendors carry a rating, each in range", () => {
    const rated = VENDORS.filter((v) => v.rating != null);
    expect(rated.map((v) => v.vendor_id).sort()).toEqual([
      "v-auntie-ama",
      "v-campus-grill",
      "v-sweet-sip",
    ]);
    for (const v of rated) {
      expect(v.rating!.value).toBeGreaterThanOrEqual(0);
      expect(v.rating!.value).toBeLessThanOrEqual(5);
      expect(v.rating!.count).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("mock vendor contact data (More info sheet)", () => {
  it("uses only obvious, unique placeholder phone numbers", () => {
    const phones = VENDORS.flatMap((v) => (v.phone != null ? [v.phone] : []));
    expect(phones.length).toBeGreaterThan(0);
    for (const phone of phones) expect(phone).toMatch(/^\+233 20 000 \d{4}$/);
    expect(new Set(phones).size).toBe(phones.length);
  });

  it("gives Lakeside an address only (no phone, no coordinates)", () => {
    const v = getVendorById("v-lakeside")!;
    expect(v.addressLabel?.trim()).toBeTruthy();
    expect(v.phone).toBeUndefined();
    expect(v.latitude).toBeUndefined();
    expect(v.longitude).toBeUndefined();
  });

  it.each(["v-campus-grill", "v-auntie-ama", "v-golden-crust"])(
    "%s uses its checkout pickup point as its map location",
    (id) => {
      const v = getVendorById(id)!;
      const loc = getVendorLocation(id);
      expect([v.latitude, v.longitude]).toEqual([loc.latitude, loc.longitude]);
      expect(v.addressLabel).toMatch(/\+.* Accra$/);
    },
  );

  it("keeps any coordinates in range", () => {
    for (const v of VENDORS) {
      if (v.latitude == null && v.longitude == null) continue;
      expect(Math.abs(v.latitude!)).toBeLessThanOrEqual(90);
      expect(Math.abs(v.longitude!)).toBeLessThanOrEqual(180);
    }
  });
});

describe("getVendorById", () => {
  it("returns the vendor for a known id", () => {
    expect(getVendorById("v-campus-grill")?.name).toBe("Campus Grill");
  });

  it("returns undefined for an unknown id", () => {
    expect(getVendorById("v-does-not-exist")).toBeUndefined();
  });
});

describe("getItemsByVendor", () => {
  it("keeps sold-out (stock: 0) items visible", () => {
    const ids = getItemsByVendor("v-fresh-basket").map((i) => i.item_id);
    expect(ids).toContain("gr-bananas"); // stock: 0
  });

  it("excludes unpublished items", () => {
    const ids = getItemsByVendor("v-campus-grill").map((i) => i.item_id);
    expect(ids).not.toContain("zz-draft-item"); // published: false
  });

  it("excludes disabled items", () => {
    const ids = getItemsByVendor("v-golden-crust").map((i) => i.item_id);
    expect(ids).not.toContain("gr-brown-bread"); // disabled: true
  });

  it("returns only that vendor's items", () => {
    const items = getItemsByVendor("v-fresh-basket");
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.vendor_id === "v-fresh-basket")).toBe(true);
  });

  it("returns [] for an unknown vendor", () => {
    expect(getItemsByVendor("v-does-not-exist")).toEqual([]);
  });
});

describe("getVendorIdForItem", () => {
  it("returns the owning vendor id for a catalog item", () => {
    expect(getVendorIdForItem("lm-grilled-chicken-wedges")).toBe("v-campus-grill");
  });

  it("returns undefined for an unknown item id", () => {
    expect(getVendorIdForItem("does-not-exist")).toBeUndefined();
  });
});
