import type { ImageSourcePropType } from "react-native";

// The ONLY place food photos are required. To add a photo, put the file in
// assets/ and set its entry here; undefined renders the placeholder card.
// Keys are FoodItem ids from ./home.ts.
export const foodImages: Record<string, ImageSourcePropType | undefined> = {
  // Local meals
  "lm-grilled-chicken-wedges": require("../../../assets/images/food/grilled-chicken-wedges.png"),
  "lm-beef-veggie-rice": require("../../../assets/images/food/beef-veggie-rice.png"),
  "lm-jollof-chicken": require("../../../assets/images/food/local-jollof-chicken.jpg"),
  "lm-waakye": undefined,
  "lm-banku-tilapia": undefined,
  "lm-fried-rice-chicken": require("../../../assets/images/food/local-fried-rice-chicken.jpg"),
  // Drinks
  "dr-matcha-bubble-tea": require("../../../assets/images/food/matcha-boba.png"),
  "dr-bliss-sparkling-juice": require("../../../assets/images/food/bliss-sparkling-juice.png"),
  "dr-sobolo": undefined,
  "dr-orange-juice": undefined,
  "dr-iced-coffee": undefined,
  "dr-mango-smoothie": undefined,
  // Bakery & Desserts
  "bk-sliced-bread": require("../../../assets/images/food/sliced-bread.png"),
  "bk-chocolate-cake": require("../../../assets/images/food/chocolate-cake.png"),
  "bk-meat-pie": undefined,
  "bk-croissant": undefined,
  "bk-doughnuts": undefined,
};
