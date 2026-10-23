/// <reference types="jest" />
import { isOnVendorStorefront, storeVendorId } from "../storefrontLink";

describe("storeVendorId", () => {
  it("returns the linked vendor id", () => {
    expect(storeVendorId({ vendorId: "v-campus-grill" })).toBe("v-campus-grill");
  });

  it("trims surrounding whitespace", () => {
    expect(storeVendorId({ vendorId: "  v-campus-grill " })).toBe("v-campus-grill");
  });

  it("returns undefined when missing, empty or whitespace (Alert fallback)", () => {
    expect(storeVendorId({})).toBeUndefined();
    expect(storeVendorId({ vendorId: "" })).toBeUndefined();
    expect(storeVendorId({ vendorId: "   " })).toBeUndefined();
  });
});

describe("isOnVendorStorefront", () => {
  it("is true on that vendor's storefront", () => {
    expect(isOnVendorStorefront("/storefront/v-campus-grill", "v-campus-grill")).toBe(true);
  });

  it("is false on another vendor's storefront", () => {
    expect(isOnVendorStorefront("/storefront/v-green-bowl", "v-campus-grill")).toBe(false);
  });

  it("is false off the storefront", () => {
    expect(isOnVendorStorefront("/home", "v-campus-grill")).toBe(false);
    expect(isOnVendorStorefront("/storefront", "v-campus-grill")).toBe(false);
  });

  it("is false for an empty vendor id", () => {
    expect(isOnVendorStorefront("/storefront/", "")).toBe(false);
    expect(isOnVendorStorefront("/storefront/v-campus-grill", "")).toBe(false);
  });
});
