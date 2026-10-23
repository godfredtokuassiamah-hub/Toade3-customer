/// <reference types="jest" />
import {
  addLine,
  type CartLine,
  cartCount,
  cartSubtotalMinor,
  EMPTY_CART,
  MAX_LINE_QTY,
  needsNewCart,
  parseCart,
  setLineQty,
} from "../cartStore";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

function line(over: Partial<CartLine> = {}): CartLine {
  return {
    lineId: "l1",
    itemId: "i1",
    vendorId: "v1",
    vendorName: "Vendor One",
    name: "Jollof",
    unitPriceMinor: 3800,
    options: [{ optionId: "protein-beef", label: "Beef", priceMinor: 500 }],
    note: "",
    qty: 2,
    ...over,
  };
}

describe("cart helpers", () => {
  test("adds lines and computes totals in pesewas", () => {
    const cart = addLine(EMPTY_CART, line(), false);
    expect(cart.lines).toHaveLength(1);
    expect(cartSubtotalMinor(cart)).toBe((3800 + 500) * 2);
    expect(cartCount(cart)).toBe(2);
  });

  test("identical lines merge and cap the quantity", () => {
    let cart = addLine(EMPTY_CART, line({ qty: 15 }), false);
    cart = addLine(cart, line({ lineId: "l2", qty: 10 }), false);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].qty).toBe(MAX_LINE_QTY);
    // Different options or note -> separate line.
    cart = addLine(cart, line({ lineId: "l3", note: "no onions" }), false);
    cart = addLine(cart, line({ lineId: "l4", options: [] }), false);
    expect(cart.lines).toHaveLength(3);
  });

  test("one vendor per cart", () => {
    const cart = addLine(EMPTY_CART, line(), false);
    expect(needsNewCart(EMPTY_CART, "v2")).toBe(false);
    expect(needsNewCart(cart, "v1")).toBe(false);
    expect(needsNewCart(cart, "v2")).toBe(true);
    const other = line({ lineId: "x", itemId: "i9", vendorId: "v2" });
    expect(() => addLine(cart, other, false)).toThrow();
    const replaced = addLine(cart, other, true);
    expect(replaced.lines.map((l) => l.vendorId)).toEqual(["v2"]);
  });

  test("needsNewCart is the replace-cart rule", () => {
    expect(needsNewCart(EMPTY_CART, "v1")).toBe(false);
    const cart = addLine(EMPTY_CART, line(), false);
    expect(needsNewCart(cart, "v1")).toBe(false);
    expect(needsNewCart(cart, "v9")).toBe(true);
  });

  test("setLineQty updates, caps and removes", () => {
    let cart = addLine(EMPTY_CART, line(), false);
    cart = addLine(cart, line({ lineId: "l2", itemId: "i2" }), false);
    expect(setLineQty(cart, "l1", 5).lines[0].qty).toBe(5);
    expect(setLineQty(cart, "l1", 99).lines[0].qty).toBe(MAX_LINE_QTY);
    expect(setLineQty(cart, "l1", 0).lines.map((l) => l.lineId)).toEqual(["l2"]);
    expect(setLineQty(setLineQty(cart, "l1", 0), "l2", 0)).toEqual(EMPTY_CART);
  });

  test("parse is defensive", () => {
    expect(parseCart(null)).toEqual(EMPTY_CART);
    expect(parseCart("nope")).toEqual(EMPTY_CART);
    expect(parseCart('{"lines": 3}')).toEqual(EMPTY_CART);
    const good = line();
    const raw = JSON.stringify({
      lines: [good, { ...good, qty: 0 }, { ...good, lineId: "z", vendorId: "v2" }, 5],
    });
    expect(parseCart(raw).lines).toEqual([good]);
    expect(parseCart(JSON.stringify(addLine(EMPTY_CART, good, false)))).toEqual({ lines: [good] });
  });
});
