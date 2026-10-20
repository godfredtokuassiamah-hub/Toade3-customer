/// <reference types="jest" />
import { CATEGORIES, ITEMS, VENDORS } from "../../mock/catalog";
import { HOME_SHORTCUTS } from "../categoryShortcuts";

const categoryIds = new Set(CATEGORIES.map((c) => c.id));
const categoryById = new Map(CATEGORIES.map((c) => [c.id, c]));
const vendorById = new Map(VENDORS.map((v) => [v.vendor_id, v]));

// An item the grid can actually show: published, owned by a known vendor,
// in stock, enabled and with a known positive weight (orderable).
function hasShowableItem(categoryId: string): boolean {
  return ITEMS.some(
    (i) =>
      i.category_ids.includes(categoryId) &&
      i.published &&
      vendorById.has(i.vendor_id) &&
      !i.disabled &&
      i.stock >= 1 &&
      i.weight_g != null &&
      i.weight_g > 0,
  );
}

describe("home category shortcuts", () => {
  test("16 tiles, unique ids, first is Favourites", () => {
    expect(HOME_SHORTCUTS).toHaveLength(16);
    expect(HOME_SHORTCUTS[0].target).toEqual({ kind: "favourites" });
    expect(new Set(HOME_SHORTCUTS.map((s) => s.id)).size).toBe(16);
  });

  test("every category target maps to a real, non-empty category", () => {
    for (const shortcut of HOME_SHORTCUTS) {
      if (shortcut.target.kind !== "category") continue;
      const { categoryId, scope } = shortcut.target;
      expect(categoryIds.has(categoryId)).toBe(true);
      // Scope must match the category's scope so the filter isn't dropped.
      expect(categoryById.get(categoryId)?.scope).toBe(scope);
      // The grid must never route to a category that yields zero items.
      expect(hasShowableItem(categoryId)).toBe(true);
    }
  });

  test("every tile has a label and an icon", () => {
    for (const shortcut of HOME_SHORTCUTS) {
      expect(shortcut.label.length).toBeGreaterThan(0);
      expect(shortcut.icon).toBeDefined();
    }
  });
});
