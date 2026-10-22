/// <reference types="jest" />
import {
  getItemsByVendor,
  getVendorById,
  getVendorIdForItem,
} from "../catalog";

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
