/// <reference types="jest" />
import { CACHE_VERSION, isPersistable, qk, roundCoord } from "../queryKeys";

describe("query keys", () => {
  it("prefix every key with the app tag and cache version", () => {
    const keys = [
      qk.stores(),
      qk.store("st-a"),
      qk.products({ vendorId: "v-a" }),
      qk.product("lm-a"),
      qk.discoveryCatalog(),
      qk.deliveryQuote("v-a", 5.6, -0.18),
      qk.orders(),
      qk.order("o1"),
    ];
    for (const k of keys) {
      expect(k[0]).toBe("t3");
      expect(k[1]).toBe(CACHE_VERSION);
    }
  });

  it("builds stable shapes", () => {
    expect(qk.store("st-a")).toEqual(["t3", CACHE_VERSION, "store", "st-a"]);
    expect(qk.products()).toEqual(["t3", CACHE_VERSION, "products", { vendorId: null, categoryId: null }]);
    expect(qk.products({ categoryId: "drinks" })).toEqual([
      "t3",
      CACHE_VERSION,
      "products",
      { vendorId: null, categoryId: "drinks" },
    ]);
    // Root keys prefix the per-id keys (used for invalidation).
    expect(qk.product("x").slice(0, 3)).toEqual([...qk.productRoot()]);
    expect(qk.products({ vendorId: "v" }).slice(0, 3)).toEqual([...qk.productsRoot()]);
  });

  it("rounds quote coordinates to 4 dp", () => {
    expect(roundCoord(5.603712345)).toBe(5.6037);
    expect(qk.deliveryQuote("v", 5.60371, -0.18704)).toEqual(qk.deliveryQuote("v", 5.603714, -0.187041));
    expect(qk.deliveryQuote("v", 5.6037, -0.187)).not.toEqual(qk.deliveryQuote("v", 5.6047, -0.187));
  });

  it("persists only public catalog / store data", () => {
    expect(isPersistable(qk.stores())).toBe(true);
    expect(isPersistable(qk.store("st-a"))).toBe(true);
    expect(isPersistable(qk.products({}))).toBe(true);
    expect(isPersistable(qk.product("lm-a"))).toBe(true);
    expect(isPersistable(qk.discoveryCatalog())).toBe(true);
    expect(isPersistable(qk.orders())).toBe(false);
    expect(isPersistable(qk.order("o1"))).toBe(false);
    expect(isPersistable(qk.deliveryQuote("v", 1, 1))).toBe(false);
    expect(isPersistable(["t3", "v0", "stores"])).toBe(false);
    expect(isPersistable(["other", CACHE_VERSION, "stores"])).toBe(false);
    expect(isPersistable(["t3", CACHE_VERSION, "cart"])).toBe(false);
  });
});
