// Storefront "+" quick add: pure decision + line builder (unit-tested).
// Applies the same rules as the item detail sheet's Add button:
// unavailable items can't be added, items with a required option choice
// open the sheet, and a cart from another vendor needs the "Start a new
// cart?" confirm (never a silent clear).
import type { OptionGroup } from "../../data/mock/itemOptions";
import { type Cart, type CartLine, needsNewCart } from "../cart/cartStore";
import type { ItemStatus, MockItem } from "../discovery/types";
import { firstUnsatisfiedGroup, initialSelection } from "../item/itemSelection";

export type QuickAddDecision =
  | { kind: "disabled" }
  | { kind: "open-sheet" }
  | { kind: "replace-cart"; fromVendor: string }
  | { kind: "add" };

// Order: disabled -> open-sheet -> replace-cart -> add. Options come before
// the vendor check because the sheet runs its own replace-cart check on Add,
// so the user is never asked twice.
export function decideQuickAdd(input: {
  status: ItemStatus;
  groups: readonly OptionGroup[];
  cart: Cart;
  vendorId: string;
}): QuickAddDecision {
  const { status, groups, cart, vendorId } = input;
  if (status !== "available") return { kind: "disabled" };
  if (firstUnsatisfiedGroup(groups, initialSelection(groups)) != null) {
    return { kind: "open-sheet" };
  }
  if (needsNewCart(cart, vendorId)) {
    // Same fallback string as ItemDetailSheet.
    return { kind: "replace-cart", fromVendor: cart.lines[0]?.vendorName ?? "another store" };
  }
  return { kind: "add" };
}

// Mirrors ItemDetailSheet.commit() for qty 1, no options and an empty note,
// so a "+" line merges with a sheet line that has no options/note.
export function quickAddLine(item: MockItem, vendorName: string, lineId: string): CartLine {
  return {
    lineId,
    itemId: item.item_id,
    vendorId: item.vendor_id,
    vendorName,
    name: item.name,
    unitPriceMinor: item.price_minor,
    options: [],
    note: "",
    qty: 1,
  };
}
