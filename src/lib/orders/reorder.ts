// Reorder (Uber Eats / Bolt Food "Order again"): rebuilds the cart from a
// past order against TODAY's catalog. Pure, no RN imports (unit-tested).
//
// Rules:
// - The store must be listed and open; otherwise nothing is added.
// - Items that no longer exist, are hidden or sold out are skipped.
// - Options are re-resolved by id in the item's current option groups.
//   Options that disappeared are dropped. If a REQUIRED choice can't be
//   rebuilt, the line is skipped ("pick again from the menu"), never guessed.
// - Prices are today's prices; a changed unit price is reported.
// - Quantity is capped at today's stock and the cart line limit.
// The server re-prices everything again at checkout (place_order), so a
// reorder can never be charged at old prices.
import type { OptionGroup } from "../../data/mock/itemOptions";
import type { OrderDetail } from "../../services/orders";
import { type CartLine, MAX_LINE_QTY } from "../cart/cartStore";
import type { MockItem, MockVendor } from "../discovery/types";
import { firstUnsatisfiedGroup, selectedOptions, type Selection } from "../item/itemSelection";

export type ReorderChange =
  | { kind: "unavailable"; name: string }
  | { kind: "needs-choice"; name: string }
  | { kind: "option-removed"; name: string; option: string }
  | { kind: "price"; name: string; fromMinor: number; toMinor: number }
  | { kind: "qty-capped"; name: string; from: number; to: number };

export type ReorderPlan =
  | { kind: "blocked"; reason: "store-unavailable" | "store-closed" | "nothing-available"; vendorName: string; changes: ReorderChange[] }
  | { kind: "ready"; vendorId: string; vendorName: string; lines: CartLine[]; changes: ReorderChange[] };

export type ReorderCatalog = {
  vendor: MockVendor | undefined;
  vendorOpen: boolean;
  item: (id: string) => MockItem | undefined;
  groups: (item: MockItem) => OptionGroup[];
  newLineId: () => string;
};

function orderable(item: MockItem): boolean {
  return item.published && !item.disabled && item.stock >= 1 && item.weight_g != null && item.weight_g > 0;
}

export function planReorder(order: OrderDetail, catalog: ReorderCatalog): ReorderPlan {
  const vendorName = order.vendorName || catalog.vendor?.name || "This store";
  if (!catalog.vendor) return { kind: "blocked", reason: "store-unavailable", vendorName, changes: [] };
  if (catalog.vendor.paused || !catalog.vendorOpen) {
    return { kind: "blocked", reason: "store-closed", vendorName, changes: [] };
  }

  const lines: CartLine[] = [];
  const changes: ReorderChange[] = [];
  for (const old of order.items) {
    const item = old.productId ? catalog.item(old.productId) : undefined;
    if (!item || item.vendor_id !== order.vendorId || !orderable(item)) {
      changes.push({ kind: "unavailable", name: old.name });
      continue;
    }
    // Rebuild the selection from the old option ids.
    const groups = catalog.groups(item);
    const wanted = new Set(old.options.map((o) => o.id));
    const selection: Record<string, string[]> = {};
    for (const g of groups) {
      selection[g.id] = g.options.filter((o) => wanted.has(o.id)).map((o) => o.id).slice(0, g.max);
    }
    const kept = new Set(Object.values(selection).flat());
    for (const o of old.options) {
      if (!kept.has(o.id)) changes.push({ kind: "option-removed", name: item.name, option: o.label });
    }
    if (firstUnsatisfiedGroup(groups, selection as Selection) != null) {
      changes.push({ kind: "needs-choice", name: item.name });
      continue;
    }
    const options = selectedOptions(groups, selection as Selection).map((o) => ({
      optionId: o.optionId,
      label: o.label,
      priceMinor: o.priceMinor,
    }));

    const oldUnit = old.unitPriceMinor + old.options.reduce((s, o) => s + o.priceMinor, 0);
    const newUnit = item.price_minor + options.reduce((s, o) => s + o.priceMinor, 0);
    if (oldUnit !== newUnit) changes.push({ kind: "price", name: item.name, fromMinor: oldUnit, toMinor: newUnit });

    const qty = Math.max(1, Math.min(old.qty, item.stock, MAX_LINE_QTY));
    if (qty !== old.qty) changes.push({ kind: "qty-capped", name: item.name, from: old.qty, to: qty });

    lines.push({
      lineId: catalog.newLineId(),
      itemId: item.item_id,
      vendorId: item.vendor_id,
      vendorName,
      name: item.name,
      unitPriceMinor: item.price_minor,
      options,
      note: old.note ?? "",
      qty,
    });
  }

  if (lines.length === 0) return { kind: "blocked", reason: "nothing-available", vendorName, changes };
  return { kind: "ready", vendorId: order.vendorId, vendorName, lines, changes };
}

// One short line per change, for the review sheet.
export function changeText(c: ReorderChange, fmt: (minor: number) => string): string {
  switch (c.kind) {
    case "unavailable":
      return `${c.name} isn't available right now`;
    case "needs-choice":
      return `${c.name} has new options: add it from the menu`;
    case "option-removed":
      return `${c.name}: "${c.option}" is no longer offered`;
    case "price":
      return `${c.name} is now ${fmt(c.toMinor)} (was ${fmt(c.fromMinor)})`;
    case "qty-capped":
      return `${c.name}: only ${c.to} left (you had ${c.from})`;
  }
}

export function blockedText(reason: Extract<ReorderPlan, { kind: "blocked" }>["reason"], vendorName: string): string {
  switch (reason) {
    case "store-unavailable":
      return `${vendorName} isn't on Toade3 right now.`;
    case "store-closed":
      return `${vendorName} is closed right now. Try again when they open.`;
    case "nothing-available":
      return `None of the items from this order are available at ${vendorName} right now.`;
  }
}
