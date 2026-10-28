/// <reference types="jest" />
import {
  buildSummaryRows,
  ETA_FALLBACK,
  etaText,
  isOrderStatus,
  itemCardText,
  moreLabel,
  ORDER_PLACED_ILLUSTRATION_URL,
  ORDER_STATUSES,
  orderStatusCopy,
  parseEtaParams,
  shortOrderRef,
} from "../orderPlaced";

describe("orderStatusCopy", () => {
  test("covers every real status", () => {
    expect(ORDER_STATUSES).toHaveLength(8);
    for (const s of ORDER_STATUSES) {
      const c = orderStatusCopy(s);
      expect(c.title).toBeTruthy();
      expect(c.subtitle).toBeTruthy();
      expect(c.statusLine).toBeTruthy();
    }
  });

  test("only out_for_delivery says 'on the way'", () => {
    for (const s of ORDER_STATUSES) {
      const c = orderStatusCopy(s);
      const text = `${c.title} ${c.subtitle} ${c.statusLine}`.toLowerCase();
      expect(text.includes("on the way")).toBe(s === "out_for_delivery");
    }
  });

  test("pending is honest, accepted is confirmed", () => {
    expect(orderStatusCopy("pending").subtitle).toBe("Waiting for the restaurant to accept your order");
    expect(orderStatusCopy("accepted").subtitle).toBe("Your order is confirmed");
    expect(orderStatusCopy("preparing").subtitle).toBe("The restaurant is preparing your order");
  });

  test("rejected / cancelled use the error tone", () => {
    expect(orderStatusCopy("rejected").tone).toBe("error");
    expect(orderStatusCopy("cancelled").tone).toBe("error");
    expect(orderStatusCopy("delivered").tone).toBe("success");
  });

  test("isOrderStatus", () => {
    expect(isOrderStatus("pending")).toBe(true);
    expect(isOrderStatus("toString")).toBe(false);
    expect(isOrderStatus("shipped")).toBe(false);
    expect(isOrderStatus(undefined)).toBe(false);
  });
});

describe("shortOrderRef", () => {
  test("uses the order number when present", () => {
    expect(shortOrderRef("abc", 1042)).toBe("#1042");
  });
  test("falls back to the first 8 id chars", () => {
    expect(shortOrderRef("3f9a2b7c-1111-2222", null)).toBe("#3F9A2B7C");
  });
  test("strips the mock- prefix", () => {
    expect(shortOrderRef("mock-ab12cd34ef", null)).toBe("#AB12CD34");
  });
});

describe("parseEtaParams", () => {
  test("valid", () => {
    expect(parseEtaParams("25", "35")).toEqual([25, 35]);
    expect(parseEtaParams("30", "30")).toEqual([30, 30]);
  });
  test.each([
    [undefined, undefined],
    ["25", undefined],
    ["abc", "35"],
    ["", "35"],
    ["35", "25"],
    ["0", "10"],
    ["10", "999"],
    ["12.5", "20"],
    [["25"], "35"],
  ])("invalid %p %p -> null", (min, max) => {
    expect(parseEtaParams(min as string | string[] | undefined, max as string | undefined)).toBeNull();
  });
});

describe("etaText", () => {
  test("range and single", () => {
    expect(etaText([25, 35])).toBe("25–35 mins");
    expect(etaText([30, 30])).toBe("30 mins");
  });
  test("fallback when no real ETA", () => {
    expect(etaText(null)).toBe(ETA_FALLBACK);
    expect(ETA_FALLBACK).toBe("We'll update you soon");
  });
});

describe("moreLabel / itemCardText", () => {
  const item = (name: string, options: string[] = []) => ({
    name,
    options: options.map((label, i) => ({ id: String(i), label, priceMinor: 0 })),
  });

  test.each([
    [0, ""],
    [1, ""],
    [2, "+1 more"],
    [5, "+4 more"],
  ])("moreLabel(%i) = %p", (n, expected) => {
    expect(moreLabel(n)).toBe(expected);
  });

  test("one item", () => {
    expect(itemCardText("Kofi's Kitchen", [item("Jollof", ["Large"])], 1)).toEqual({
      title: "Kofi's Kitchen",
      itemLine: "Jollof",
      countLine: "1 item · Large",
    });
  });

  test("several items show the first and +N more", () => {
    const items = [item("Jollof"), item("Kelewele"), item("Sobolo")];
    expect(itemCardText("Kofi's Kitchen", items, 4)).toEqual({
      title: "Kofi's Kitchen",
      itemLine: "Jollof +2 more",
      countLine: "4 items",
    });
  });

  test("blank vendor falls back to the first item; empty items", () => {
    expect(itemCardText(" ", [item("Waakye")], 1).title).toBe("Waakye");
    expect(itemCardText("Shop", [], 0)).toEqual({ title: "Shop", itemLine: "", countLine: "0 items" });
  });
});

describe("buildSummaryRows", () => {
  test("with address and ETA", () => {
    expect(buildSummaryRows({ orderRef: "#12", addressLabel: "Home", eta: [20, 30] })).toEqual([
      { key: "id", label: "Order ID", value: "#12" },
      { key: "address", label: "Delivery address", value: "Home" },
      { key: "eta", label: "Estimated delivery", value: "20–30 mins" },
    ]);
  });
  test("omits a blank address, falls back on ETA, no payment row", () => {
    const rows = buildSummaryRows({ orderRef: "#12", addressLabel: "  ", eta: null });
    expect(rows.map((r) => r.key)).toEqual(["id", "eta"]);
    expect(rows[1].value).toBe(ETA_FALLBACK);
    expect(rows.some((r) => /payment/i.test(r.label))).toBe(false);
  });
});

test("illustration URL is the size=300 Icons8 link", () => {
  expect(ORDER_PLACED_ILLUSTRATION_URL).toBe(
    "https://img.icons8.com/?size=300&id=wCClDpWTvma9&format=png&color=000000",
  );
});
