/// <reference types="jest" />
import { vendorOpenAt } from "../../../lib/discovery/predicate";
import { CATEGORIES, getItemsByVendor, getVendorById } from "../catalog";
import { STORES } from "../stores";

// UTC instants across the day (Accra is UTC+0).
const TIMES = [
  Date.UTC(2026, 0, 5, 0, 0),
  Date.UTC(2026, 0, 5, 6, 0),
  Date.UTC(2026, 0, 5, 12, 0),
  Date.UTC(2026, 0, 5, 18, 0),
  Date.UTC(2026, 0, 5, 23, 59),
].map((t) => new Date(t));

const SCOPE_BY_CATEGORY = new Map(CATEGORIES.map((c) => [c.id, c.scope]));

describe("STORES → catalog vendor link", () => {
  it("keeps store ids unique", () => {
    const ids = STORES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every store a vendorId that resolves to a vendor", () => {
    for (const store of STORES) {
      expect(store.vendorId?.trim()).toBeTruthy();
      expect(getVendorById(store.vendorId!)).toBeDefined();
    }
  });

  it("links each store to its own vendor", () => {
    const ids = STORES.map((s) => s.vendorId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("names the vendor exactly like the store", () => {
    for (const store of STORES) {
      expect(getVendorById(store.vendorId!)?.name).toBe(store.name);
    }
  });

  it("keeps the vendor's open state consistent with the store at every hour", () => {
    for (const store of STORES) {
      const vendor = getVendorById(store.vendorId!)!;
      for (const t of TIMES) {
        expect({ store: store.id, t: t.toISOString(), open: vendorOpenAt(vendor, t) }).toEqual({
          store: store.id,
          t: t.toISOString(),
          open: store.open,
        });
      }
    }
  });

  it("carries the store's coordinates and a short plus-code address on the vendor", () => {
    for (const store of STORES) {
      const vendor = getVendorById(store.vendorId!)!;
      expect(vendor.latitude).toBe(store.latitude);
      expect(vendor.longitude).toBe(store.longitude);
      expect(vendor.addressLabel).toMatch(
        /^[23456789CFGHJMPQRVWX]{4}\+[23456789CFGHJMPQRVWX]{2} Accra$/,
      );
    }
  });

  it("carries the store's logo on the vendor", () => {
    for (const store of STORES) {
      if (!store.logo) continue;
      expect(getVendorById(store.vendorId!)?.logo).toBe(store.logo);
    }
  });

  it("gives every linked vendor a non-empty menu in matching scopes", () => {
    for (const store of STORES) {
      const items = getItemsByVendor(store.vendorId!);
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        for (const id of item.category_ids) {
          expect({ item: item.item_id, scope: SCOPE_BY_CATEGORY.get(id) }).toEqual({
            item: item.item_id,
            scope: item.scope,
          });
        }
      }
    }
  });
});
