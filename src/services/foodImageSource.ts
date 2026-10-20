import type { ImageSourcePropType } from "react-native";

import { foodImages } from "../data/mock/foodImages";
import { BUCKETS, getPublicImageUrl } from "./storage";

// Image-source seam for food cards. TODAY it returns the LOCAL bundled asset.
// When the catalog API ships, flip USE_REMOTE_IMAGES to true and give each
// FoodItem an `imagePath` (the object path inside the food-images bucket); the
// UI stays unchanged. Keeping both paths here means the switch is one flag.
export const USE_REMOTE_IMAGES = false;

export function resolveFoodImage(
  id: string,
  imagePath?: string,
): ImageSourcePropType | undefined {
  if (USE_REMOTE_IMAGES && imagePath) {
    return { uri: getPublicImageUrl(BUCKETS.food, imagePath) };
  }
  return foodImages[id];
}
