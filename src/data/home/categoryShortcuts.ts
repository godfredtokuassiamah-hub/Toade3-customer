// Home category-shortcut grid (beneath the search bar). A wrapping grid of
// 16 tiles, each a light-grey circle with 3D art (Icons8, see
// assets/icons/categories/CREDITS.md) and a label.
//
// Tapping a tile either opens the Favourites screen or sets the applied
// SEARCH filter and opens the results. A tile's `target` is how it filters;
// the grid never routes to a category that yields zero items (every
// categoryId below has stocked mock items in src/data/mock/catalog.ts).
import type { ImageSourcePropType } from "react-native";

import type { CatalogScope, DiscoveryScope } from "../../lib/discovery/types";

export type HomeShortcutTarget =
  // Opens the Favourites screen (NOT a catalog filter).
  | { kind: "favourites" }
  // Applies a scope only (e.g. Restaurants -> food, Groceries -> groceries,
  // Stores -> all vendors/items).
  | { kind: "scope"; scope: DiscoveryScope }
  // Applies a scope plus a single category id.
  | { kind: "category"; scope: CatalogScope; categoryId: string };

export type HomeShortcut = {
  id: string;
  label: string;
  icon: ImageSourcePropType;
  target: HomeShortcutTarget;
};

// Order matches the user's design (12 tiles) plus 4 more that map cleanly to
// the catalog, rounding the grid to a full 4x4.
export const HOME_SHORTCUTS: readonly HomeShortcut[] = [
  {
    id: "favourites",
    label: "Favourites",
    icon: require("../../../assets/icons/categories/favourites.png"),
    target: { kind: "favourites" },
  },
  {
    id: "restaurants",
    label: "Restaurants",
    icon: require("../../../assets/icons/categories/restaurants.png"),
    target: { kind: "scope", scope: "food" },
  },
  {
    id: "stores",
    label: "Stores",
    icon: require("../../../assets/icons/categories/stores.png"),
    // TODO(stores): no vendor directory yet. Map to all vendors/items for
    // now; open a dedicated stores directory once it exists.
    target: { kind: "scope", scope: "all" },
  },
  {
    id: "groceries",
    label: "Groceries",
    icon: require("../../../assets/icons/categories/groceries-tile.png"),
    target: { kind: "scope", scope: "groceries" },
  },
  {
    id: "gifts",
    label: "Gifts",
    icon: require("../../../assets/icons/categories/gifts.png"),
    target: { kind: "category", scope: "groceries", categoryId: "gifts" },
  },
  {
    id: "bakery",
    label: "Bakery",
    icon: require("../../../assets/icons/categories/bakery-tile.png"),
    target: { kind: "category", scope: "groceries", categoryId: "bread-bakery" },
  },
  {
    id: "home-diy",
    label: "Home & DIY",
    icon: require("../../../assets/icons/categories/home-diy.png"),
    target: { kind: "category", scope: "groceries", categoryId: "home-diy" },
  },
  {
    id: "sports",
    label: "Sports",
    icon: require("../../../assets/icons/categories/sports.png"),
    target: { kind: "category", scope: "groceries", categoryId: "sports" },
  },
  {
    id: "pharmacy",
    label: "Pharmacy",
    icon: require("../../../assets/icons/categories/pharmacy.png"),
    target: { kind: "category", scope: "groceries", categoryId: "pharmacy" },
  },
  {
    id: "flowers",
    label: "Flowers",
    icon: require("../../../assets/icons/categories/flowers.png"),
    target: { kind: "category", scope: "groceries", categoryId: "flowers" },
  },
  {
    id: "health-beauty",
    label: "Health & beauty",
    icon: require("../../../assets/icons/categories/health-beauty.png"),
    target: { kind: "category", scope: "groceries", categoryId: "health-beauty" },
  },
  {
    id: "electronics",
    label: "Electronics",
    icon: require("../../../assets/icons/categories/electronics.png"),
    target: { kind: "category", scope: "groceries", categoryId: "gadgets" },
  },
  // Four extra tiles mapped to existing catalog categories.
  {
    id: "fruits-veg",
    label: "Fruits & Veg",
    icon: require("../../../assets/icons/categories/fruits-veg-tile.png"),
    target: { kind: "category", scope: "groceries", categoryId: "fruits-vegetables" },
  },
  {
    id: "drinks",
    label: "Drinks",
    icon: require("../../../assets/icons/categories/drinks-tile.png"),
    target: { kind: "category", scope: "food", categoryId: "drinks" },
  },
  {
    id: "snacks",
    label: "Snacks",
    icon: require("../../../assets/icons/categories/snacks-tile.png"),
    target: { kind: "category", scope: "food", categoryId: "snacks" },
  },
  {
    id: "household",
    label: "Household",
    icon: require("../../../assets/icons/categories/household.png"),
    target: { kind: "category", scope: "groceries", categoryId: "household" },
  },
];
