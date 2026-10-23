/// <reference types="jest" />
import { getItemsByIds } from "../../../data/mock/catalog";
import { getOptionGroups } from "../../../data/mock/itemOptions";
import { addLine, type Cart, type CartLine, EMPTY_CART } from "../../cart/cartStore";
import { decideQuickAdd, quickAddLine } from "../quickAdd";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const FOOD = getOptionGroups("lm-jollof-chicken", ["rice-meals"]);
const DRINK = getOptionGroups("dr-sobolo", ["drinks"]);
const BAKERY = getOptionGroups("bk-croissant", ["snacks"]);
const NONE = getOptionGroups("gf-gift-hamper", ["gifts"]);

function line(vendorId: string, vendorName: string, itemId = "x-item"): CartLine {
  return {
    lineId: `l-${itemId}`,
    itemId,
    vendorId,
    vendorName,
    name: itemId,
    unitPriceMinor: 1000,
    options: [],
    note: "",
    qty: 1,
  };
}

const OTHER_CART: Cart = { lines: [line("v-other", "Other Kitchen")] };
const SAME_CART: Cart = { lines: [line("v-city-stores", "City Stores")] };

describe("decideQuickAdd", () => {
  it("disables sold-out and closed items", () => {
    for (const status of ["sold_out", "closed"] as const) {
      expect(
        decideQuickAdd({ status, groups: NONE, cart: EMPTY_CART, vendorId: "v-city-stores" }),
      ).toEqual({ kind: "disabled" });
    }
  });

  it("disabled wins over required options", () => {
    expect(
      decideQuickAdd({ status: "sold_out", groups: FOOD, cart: EMPTY_CART, vendorId: "v" }),
    ).toEqual({ kind: "disabled" });
  });

  it("opens the sheet for required food options, even with another vendor's cart", () => {
    expect(
      decideQuickAdd({ status: "available", groups: FOOD, cart: OTHER_CART, vendorId: "v-mamas-pot" }),
    ).toEqual({ kind: "open-sheet" });
  });

  it("opens the sheet for a drink (required size)", () => {
    expect(
      decideQuickAdd({ status: "available", groups: DRINK, cart: EMPTY_CART, vendorId: "v-sweet-sip" }),
    ).toEqual({ kind: "open-sheet" });
  });

  it("adds optional-only (bakery) items directly", () => {
    expect(
      decideQuickAdd({ status: "available", groups: BAKERY, cart: EMPTY_CART, vendorId: "v-le-petit" }),
    ).toEqual({ kind: "add" });
  });

  it("adds items without option groups to an empty or same-vendor cart", () => {
    expect(NONE).toEqual([]);
    expect(
      decideQuickAdd({ status: "available", groups: NONE, cart: EMPTY_CART, vendorId: "v-city-stores" }),
    ).toEqual({ kind: "add" });
    expect(
      decideQuickAdd({ status: "available", groups: NONE, cart: SAME_CART, vendorId: "v-city-stores" }),
    ).toEqual({ kind: "add" });
  });

  it("asks to replace another vendor's cart, naming that vendor", () => {
    expect(
      decideQuickAdd({ status: "available", groups: NONE, cart: OTHER_CART, vendorId: "v-city-stores" }),
    ).toEqual({ kind: "replace-cart", fromVendor: "Other Kitchen" });
  });
});

describe("quickAddLine", () => {
  const hamper = getItemsByIds(["gf-gift-hamper"])[0];

  it("builds a qty-1 line with no options and an empty note", () => {
    expect(quickAddLine(hamper, "City Stores", "id-1")).toEqual({
      lineId: "id-1",
      itemId: "gf-gift-hamper",
      vendorId: "v-city-stores",
      vendorName: "City Stores",
      name: hamper.name,
      unitPriceMinor: hamper.price_minor,
      options: [],
      note: "",
      qty: 1,
    });
  });

  it("merges into an existing line for the same item", () => {
    const first = addLine(EMPTY_CART, quickAddLine(hamper, "City Stores", "a"), false);
    const second = addLine(first, quickAddLine(hamper, "City Stores", "b"), false);
    expect(second.lines).toHaveLength(1);
    expect(second.lines[0].qty).toBe(2);
    expect(second.lines[0].lineId).toBe("a");
  });
});
