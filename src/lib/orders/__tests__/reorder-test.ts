import type { OptionGroup } from "../../../data/mock/itemOptions";
import type { OrderDetail, OrderSummary } from "../../../services/orders";
import type { MockItem, MockVendor } from "../../discovery/types";
import { canReorder, cardMeta, dayTitle, groupByDay, splitOrders, statusBadge } from "../orderHistory";
import { blockedText, changeText, planReorder, type ReorderCatalog } from "../reorder";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const vendor = { vendor_id: "v1", name: "KFC", paused: false, hours: { open: "00:00", close: "24:00" } } as MockVendor;

function item(id: string, over: Partial<MockItem> = {}): MockItem {
  return {
    item_id: id,
    name: id.toUpperCase(),
    vendor_id: "v1",
    scope: "food",
    category_ids: [],
    price_minor: 1000,
    stock: 50,
    disabled: false,
    weight_g: 300,
    published: true,
    eta_mins: 10,
    ...over,
  };
}

const PROTEIN: OptionGroup = {
  id: "protein",
  title: "Protein",
  required: true,
  min: 1,
  max: 1,
  options: [
    { id: "chicken", label: "Chicken", priceMinor: 0 },
    { id: "beef", label: "Beef", priceMinor: 200 },
  ],
};

function order(items: OrderDetail["items"]): OrderDetail {
  return {
    orderId: "o1",
    orderNumber: 1,
    status: "delivered",
    version: 3,
    vendorId: "v1",
    vendorName: "KFC",
    totalMinor: 0,
    itemCount: items.length,
    createdAt: "2026-10-28T10:00:00Z",
    mock: false,
    itemsTotalMinor: 0,
    deliveryFeeMinor: 0,
    serviceFeeMinor: 0,
    tipMinor: 0,
    distanceKm: 1,
    dropoff: { label: "Home", latitude: 5.6, longitude: -0.2 },
    instructions: null,
    items,
  };
}

const line = (productId: string, over: Partial<OrderDetail["items"][number]> = {}) => ({
  productId,
  name: productId.toUpperCase(),
  unitPriceMinor: 1000,
  options: [],
  note: null,
  qty: 1,
  lineTotalMinor: 1000,
  ...over,
});

function catalog(items: MockItem[], over: Partial<ReorderCatalog> = {}): ReorderCatalog {
  let n = 0;
  return {
    vendor,
    vendorOpen: true,
    item: (id) => items.find((i) => i.item_id === id),
    groups: (i) => (i.item_id === "jollof" ? [PROTEIN] : []),
    newLineId: () => `l${++n}`,
    ...over,
  };
}

describe("planReorder", () => {
  test("rebuilds lines at today's price, keeps notes and options", () => {
    const plan = planReorder(
      order([line("jollof", { options: [{ id: "beef", label: "Beef", priceMinor: 200 }], unitPriceMinor: 1000, note: "spicy", qty: 2 })]),
      catalog([item("jollof", { price_minor: 1100 })]),
    );
    expect(plan.kind).toBe("ready");
    if (plan.kind !== "ready") return;
    expect(plan.lines).toEqual([
      expect.objectContaining({ itemId: "jollof", unitPriceMinor: 1100, note: "spicy", qty: 2, options: [{ optionId: "beef", label: "Beef", priceMinor: 200 }] }),
    ]);
    expect(plan.changes).toEqual([{ kind: "price", name: "JOLLOF", fromMinor: 1200, toMinor: 1300 }]);
  });

  test("skips sold-out and missing items but keeps the rest", () => {
    const plan = planReorder(
      order([line("fries"), line("gone"), line("cola")]),
      catalog([item("fries", { stock: 0 }), item("cola")]),
    );
    expect(plan.kind).toBe("ready");
    if (plan.kind !== "ready") return;
    expect(plan.lines.map((l) => l.itemId)).toEqual(["cola"]);
    expect(plan.changes.map((c) => c.kind)).toEqual(["unavailable", "unavailable"]);
  });

  test("a required choice that no longer exists is not guessed", () => {
    const plan = planReorder(
      order([line("jollof", { options: [{ id: "goat", label: "Goat", priceMinor: 0 }] }), line("cola")]),
      catalog([item("jollof"), item("cola")]),
    );
    if (plan.kind !== "ready") throw new Error("expected ready");
    expect(plan.lines.map((l) => l.itemId)).toEqual(["cola"]);
    expect(plan.changes.map((c) => c.kind)).toEqual(["option-removed", "needs-choice"]);
  });

  test("caps the quantity at today's stock", () => {
    const plan = planReorder(order([line("cola", { qty: 5 })]), catalog([item("cola", { stock: 2 })]));
    if (plan.kind !== "ready") throw new Error("expected ready");
    expect(plan.lines[0].qty).toBe(2);
    expect(plan.changes).toEqual([{ kind: "qty-capped", name: "COLA", from: 5, to: 2 }]);
  });

  test("blocked when the store is closed, paused, gone or nothing is left", () => {
    expect(planReorder(order([line("cola")]), catalog([item("cola")], { vendorOpen: false })).kind).toBe("blocked");
    expect(planReorder(order([line("cola")]), catalog([item("cola")], { vendor: { ...vendor, paused: true } }))).toMatchObject({ reason: "store-closed" });
    expect(planReorder(order([line("cola")]), catalog([item("cola")], { vendor: undefined }))).toMatchObject({ reason: "store-unavailable" });
    expect(planReorder(order([line("cola")]), catalog([]))).toMatchObject({ reason: "nothing-available" });
  });

  test("copy", () => {
    expect(changeText({ kind: "price", name: "Cola", fromMinor: 500, toMinor: 600 }, (m) => `GH${m / 100}`)).toBe("Cola is now GH6 (was GH5)");
    expect(blockedText("store-closed", "KFC")).toMatch(/closed/);
  });
});

describe("orderHistory", () => {
  const summary = (id: string, status: OrderSummary["status"], createdAt: string): OrderSummary => ({
    orderId: id,
    orderNumber: null,
    status,
    version: 1,
    vendorId: "v1",
    vendorName: "KFC",
    totalMinor: 1000,
    itemCount: 1,
    createdAt,
    mock: false,
  });

  test("in-progress on top, past newest first", () => {
    const { active, past } = splitOrders([
      summary("a", "delivered", "2026-10-01T10:00:00Z"),
      summary("b", "preparing", "2026-10-02T10:00:00Z"),
      summary("c", "cancelled", "2026-10-03T10:00:00Z"),
    ]);
    expect(active.map((o) => o.orderId)).toEqual(["b"]);
    expect(past.map((o) => o.orderId)).toEqual(["c", "a"]);
  });

  test("day sections", () => {
    const now = new Date(2026, 9, 28, 12, 0);
    const at = (d: number, h = 10) => new Date(2026, 9, d, h).toISOString();
    const sections = groupByDay(
      [summary("a", "delivered", at(28, 11)), summary("b", "delivered", at(28, 9)), summary("c", "delivered", at(27)), summary("d", "delivered", at(12))],
      now,
    );
    expect(sections.map((s) => [s.title, s.orders.length])).toEqual([
      ["Today", 2],
      ["Yesterday", 1],
      ["Mon, 12 Oct", 1],
    ]);
    expect(dayTitle(new Date(2025, 0, 5), now)).toBe("5 Jan 2025");
  });

  test("badges, meta and reorder rule", () => {
    expect(statusBadge("rejected")).toEqual({ label: "Declined", tone: "error" });
    expect(statusBadge("out_for_delivery").tone).toBe("active");
    expect(cardMeta({ itemCount: 2, createdAt: new Date(2026, 9, 28, 15, 15).toISOString() })).toBe("2 items \u00b7 3:15 PM");
    expect(canReorder("delivered")).toBe(true);
    expect(canReorder("cancelled")).toBe(true);
    expect(canReorder("preparing")).toBe(false);
  });
});
