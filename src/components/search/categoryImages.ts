// Full-colour 3D category art (Icons8, bundled at 300x300 for crisp
// rendering at ~48dp; works offline). Categories without art here keep their
// symbol icon. Icons by Icons8 (https://icons8.com): attribution or a paid
// licence is required before release.
import type { ImageSourcePropType } from "react-native";

import type { DiscoveryScope } from "../../lib/discovery/types";

// Scope options (All / Food / Groceries) in ScopeTabs (Search) and
// ScopeSegment (Filters); keyed by the SCOPES ids in filterState.ts.
export const SCOPE_IMAGES: Readonly<Record<DiscoveryScope, ImageSourcePropType>> = {
  all: require("../../../assets/icons/categories/all.png"),
  food: require("../../../assets/icons/categories/food.png"),
  groceries: require("../../../assets/icons/categories/groceries.png"),
};

export const CATEGORY_IMAGES: Readonly<Record<string, ImageSourcePropType>> = {
  "local-dishes": require("../../../assets/icons/categories/local-dishes.png"),
  "rice-meals": require("../../../assets/icons/categories/rice-meals.png"),
  snacks: require("../../../assets/icons/categories/snacks.png"),
  drinks: require("../../../assets/icons/categories/drinks.png"),
  "fruits-vegetables": require("../../../assets/icons/categories/fruits-vegetables.png"),
  gadgets: require("../../../assets/icons/categories/gadgets.png"),
  // Store categories added for the Home category-shortcut grid.
  gifts: require("../../../assets/icons/categories/gifts.png"),
  "home-diy": require("../../../assets/icons/categories/home-diy.png"),
  sports: require("../../../assets/icons/categories/sports.png"),
  pharmacy: require("../../../assets/icons/categories/pharmacy.png"),
  flowers: require("../../../assets/icons/categories/flowers.png"),
  "health-beauty": require("../../../assets/icons/categories/health-beauty.png"),
};
