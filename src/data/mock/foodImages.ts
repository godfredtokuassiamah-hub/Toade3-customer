import type { ImageSourcePropType } from "react-native";

// The ONLY place food photos are set. Keys are FoodItem / catalog item ids.
// undefined renders the placeholder card.
//
// DUMMY IMAGES (dev only): these are remote Pinterest images the user chose
// as placeholders. They are not ours to ship. Replace every one with owned or
// licensed photos (or the catalog's storage URLs) before any release.
const pin = (path: string): ImageSourcePropType => ({ uri: `https://i.pinimg.com/${path}` });

export const foodImages: Record<string, ImageSourcePropType | undefined> = {
  // Local meals
  "lm-grilled-chicken-wedges": pin("1200x/4b/8f/99/4b8f99c59deddf301242abacbfc1d34f.jpg"),
  "lm-beef-veggie-rice": pin("736x/9b/c1/c0/9bc1c0e0ed233bd3e9955dc029d53cf8.jpg"),
  "lm-jollof-chicken": undefined,
  "lm-waakye": pin("736x/40/6c/ac/406cac6b50c211278a119cc248b015ba.jpg"),
  "lm-banku-tilapia": pin("1200x/f3/53/35/f35335c6e9469387f4a69c4591f2c9b1.jpg"),
  "lm-fried-rice-chicken": pin("736x/02/e7/51/02e75135036abb41a7ad13bfcf9bf3f8.jpg"),
  // Extra food (search results)
  "fd-red-red": pin("736x/75/8d/8d/758d8d86824fcddbb39027d8c8fb72be.jpg"),
  // Drinks
  "dr-matcha-bubble-tea": pin("736x/b0/30/96/b030960d34514b5b3b285c9a3c86167a.jpg"),
  "dr-bliss-sparkling-juice": pin("236x/10/14/a3/1014a38f43290f034beb0fdfa1af3ca6.jpg"),
  "dr-sobolo": undefined,
  "dr-orange-juice": pin("736x/32/29/eb/3229eb066f1c9a51f9437510b334e911.jpg"),
  "dr-iced-coffee": pin("1200x/75/63/5a/75635a3a419595e3d07e371688915d9d.jpg"),
  "dr-mango-smoothie": pin("736x/5d/7b/dc/5d7bdcebb2c70a5aa7cf6ab53af08ce2.jpg"),
  // Gifts (search results / Gifts tile)
  "gf-gift-hamper": pin("736x/62/cc/df/62ccdfb089aac98a4f03ac98badbbad8.jpg"),
  "gf-greeting-card": pin("736x/c4/b8/16/c4b81602bf256b1dda85de99ad1ba116.jpg"),
  "gf-scented-candle": pin("1200x/44/99/93/449993fbb1a6dfa0a1b1e4c32eb2bc2f.jpg"),
  "gf-cute-blue-box": pin("736x/0d/0e/35/0d0e358cee854dfbd6257ab27e7fe093.jpg"),
  "gf-executive-set": pin("736x/b9/bf/5b/b9bf5b60916905e35210d944f1ca3f23.jpg"),
  "gf-stationery-crate": pin("736x/96/fe/9f/96fe9f1fae4765ff89ccb54aa331cb99.jpg"),
  // Bakery & Desserts
  "bk-sliced-bread": undefined,
  "bk-chocolate-cake": pin("1200x/84/ef/07/84ef07c27787b67c071753e24ee2b4ef.jpg"),
  // Snacks (category "snacks" in the catalog). Swap any mapping as needed.
  "bk-meat-pie": pin("1200x/d6/90/d5/d690d5a9088ea97992459ae86d237425.jpg"),
  "bk-croissant": pin("736x/54/4b/c1/544bc1a9d92fd8b0d1ac395855279f4b.jpg"),
  "bk-doughnuts": pin("736x/5f/6a/7c/5f6a7c0f0cafb625f98dc6d6f318cc62.jpg"),
  "fd-kelewele": pin("1200x/32/94/cf/3294cfebf7ed7b9b8d26139f337650d2.jpg"),
  "fd-chicken-shawarma": pin("736x/f8/63/f6/f863f603687d5cd0178e3dfa1c26ea5e.jpg"),
  // Sports (search results / Sports tile)
  "sp-yoga-mat": pin("736x/fb/4c/f1/fb4cf1aab9141d7849b0c0d3ec17fca8.jpg"),
  "sp-dumbbell-set": pin("1200x/bf/1e/28/bf1e283957b423f080b68ad862a660a5.jpg"),
  "sp-skipping-rope": pin("1200x/fa/cc/5c/facc5c00aaaf70a6eead1ee6ae5ecd79.jpg"),
  "sp-bottle-pouch": pin("1200x/53/71/68/537168bd58354d73acc745243f7f464f.jpg"),
  "sp-pocket-gimbal": pin("736x/21/90/ef/2190ef3d411379e4c370cfea01fb3e97.jpg"),
  // Store storefronts (reused photos)
  "mf-assorted-fried-rice": pin("736x/02/e7/51/02e75135036abb41a7ad13bfcf9bf3f8.jpg"),
};
