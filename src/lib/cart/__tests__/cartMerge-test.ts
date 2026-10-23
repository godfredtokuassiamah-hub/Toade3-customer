/// <reference types="jest" />
import { mergeCarts, parseRemoteLines, toRemoteDraft } from "../cartMerge";
import { type Cart, type CartLine, EMPTY_CART, parseCartUpdatedAt } from "../cartStore";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

function line(over: Partial<CartLine> = {}): CartLine {
  return {
    lineId: "l1",
    itemId: "lm-jollof-chicken",
    vendorId: "v-mamas-pot",
    vendorName: "Mama's Pot",
    name: "Jollof",
    unitPriceMinor: 3800,
    options: [],
    note: "",
    qty: 1,
    ...over,
  };
}

const cartA: Cart = { lines: [line()] };
const cartB: Cart = { lines: [line({ lineId: "l2", itemId: "dr-sobolo", vendorId: "v-sweet-sip", vendorName: "Sweet Sip" })] };

describe("mergeCarts (last-write-wins, whole cart)", () => {
  it("pushes a local cart when the server has none", () => {
    expect(mergeCarts({ cart: cartA, updatedAt: 10 }, null).action).toBe("push-local");
    expect(mergeCarts({ cart: EMPTY_CART, updatedAt: 0 }, null).action).toBe("none");
  });

  it("applies a newer server cart", () => {
    const r = mergeCarts({ cart: cartA, updatedAt: 10 }, { lines: cartB.lines, vendorId: "v-sweet-sip", updatedAt: 20 });
    expect(r.action).toBe("apply-remote");
    expect(r.cart.lines.map((l) => l.itemId)).toEqual(["dr-sobolo"]);
    expect(r.updatedAt).toBe(20);
  });

  it("keeps and pushes a newer local cart", () => {
    const r = mergeCarts({ cart: cartA, updatedAt: 30 }, { lines: cartB.lines, vendorId: "v-sweet-sip", updatedAt: 20 });
    expect(r.action).toBe("push-local");
    expect(r.cart).toBe(cartA);
  });

  it("ties keep the local cart", () => {
    const r = mergeCarts({ cart: cartA, updatedAt: 20 }, { lines: cartB.lines, vendorId: "v-sweet-sip", updatedAt: 20 });
    expect(r.action).toBe("push-local");
    expect(r.cart).toBe(cartA);
  });

  it("never mixes vendors: the newer cart wins whole", () => {
    const r = mergeCarts({ cart: cartA, updatedAt: 1 }, { lines: cartB.lines, vendorId: "v-sweet-sip", updatedAt: 2 });
    const vendors = new Set(r.cart.lines.map((l) => l.vendorId));
    expect(vendors.size).toBe(1);
  });

  it("drops a corrupt / mixed server cart down to one vendor", () => {
    const mixed = [...cartA.lines, ...cartB.lines, { junk: true }];
    expect(parseRemoteLines(mixed).lines.map((l) => l.vendorId)).toEqual(["v-mamas-pot"]);
    expect(parseRemoteLines("nope")).toEqual(EMPTY_CART);
  });

  it("a newer empty server cart (cleared elsewhere) wins", () => {
    const r = mergeCarts({ cart: cartA, updatedAt: 1 }, { lines: [], vendorId: null, updatedAt: 5 });
    expect(r.action).toBe("apply-remote");
    expect(r.cart.lines).toHaveLength(0);
  });

  it("same content needs no write", () => {
    const r = mergeCarts({ cart: cartA, updatedAt: 1 }, { lines: cartA.lines, vendorId: "v-mamas-pot", updatedAt: 9 });
    expect(r.action).toBe("none");
  });

  it("builds the draft row", () => {
    const row = toRemoteDraft(cartA, Date.UTC(2026, 0, 1));
    expect(row.vendor_id).toBe("v-mamas-pot");
    expect(row.lines).toBe(cartA.lines);
    expect(row.updated_at).toBe("2026-01-01T00:00:00.000Z");
    expect(toRemoteDraft(EMPTY_CART, 5).vendor_id).toBeNull();
  });

  it("reads the persisted cart timestamp tolerantly", () => {
    expect(parseCartUpdatedAt(JSON.stringify({ lines: [], updatedAt: 42 }))).toBe(42);
    expect(parseCartUpdatedAt(JSON.stringify({ lines: [] }))).toBe(0);
    expect(parseCartUpdatedAt("{bad")).toBe(0);
    expect(parseCartUpdatedAt(null)).toBe(0);
  });
});
