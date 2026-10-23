// TODO(stores): replace with the stores read API. Mock directory for the
// Stores tab: stores (not dishes), spread around Accra so delivery
// distances, fees and times vary. No ratings: we never show fake ones.
import type { ImageSourcePropType } from "react-native";

// Ids match the Home shortcut tiles (src/data/home/categoryShortcuts.ts).
export type StoreCategory =
  | "groceries"
  | "pharmacy"
  | "electronics"
  | "bakery"
  | "flowers"
  | "gifts"
  | "home-diy"
  | "sports"
  | "health-beauty"
  | "restaurants";

export type Store = {
  id: string;
  name: string;
  category: StoreCategory;
  // Square logo; shown centred on a soft grey cover.
  logo?: ImageSourcePropType;
  // 16:9 cover photo (none supplied yet).
  cover?: ImageSourcePropType;
  latitude: number;
  longitude: number;
  // Order preparation time range, minutes.
  prepMins: readonly [number, number];
  // Ratings are deliberately absent until real reviews exist.
  rating?: never;
  open: boolean;
  // MOCK link to this store's own catalog vendor (src/data/mock/catalog.ts
  // VENDORS). The vendor mirrors the store's name, logo and open state, and
  // the storefront shows the vendor's menu. Unset → the "Storefront coming
  // soon" fallback.
  vendorId?: string;
};

export const STORE_CATEGORY_LABELS: Record<StoreCategory, string> = {
  groceries: "Groceries",
  pharmacy: "Pharmacy",
  electronics: "Electronics",
  bakery: "Bakery",
  flowers: "Flowers",
  gifts: "Gifts",
  "home-diy": "Home & DIY",
  sports: "Sports",
  "health-beauty": "Health & beauty",
  restaurants: "Restaurants",
};

export function isStoreCategory(value: unknown): value is StoreCategory {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(STORE_CATEGORY_LABELS, value);
}

// The first five reuse the Popular Places logos (design exports, read in
// place); the rest have no artwork yet and render a placeholder cover.
export const STORES: readonly Store[] = [
  {
    id: "st-medie-foods",
    vendorId: "v-medie-foods",
    name: "Medie Foods",
    category: "restaurants",
    logo: require("../../../assets/UI SCREEN/popular places/Ellipse 3.png"),
    latitude: 5.608,
    longitude: -0.185,
    prepMins: [10, 15],
    open: true,
  },
  {
    id: "st-churros",
    vendorId: "v-churros",
    name: "Churros",
    category: "bakery",
    logo: require("../../../assets/UI SCREEN/popular places/Ellipse 4.png"),
    latitude: 5.615,
    longitude: -0.18,
    prepMins: [5, 10],
    open: true,
  },
  {
    id: "st-milk",
    vendorId: "v-milk",
    name: "Milk",
    category: "groceries",
    logo: require("../../../assets/UI SCREEN/popular places/Ellipse 5.png"),
    latitude: 5.593,
    longitude: -0.195,
    prepMins: [5, 10],
    open: true,
  },
  {
    id: "st-red-rock",
    vendorId: "v-red-rock",
    name: "Red Rock",
    category: "restaurants",
    logo: require("../../../assets/UI SCREEN/popular places/Ellipse 6.png"),
    latitude: 5.63,
    longitude: -0.175,
    prepMins: [15, 20],
    open: false,
  },
  {
    id: "st-gamesa",
    vendorId: "v-gamesa",
    name: "Gamesa",
    category: "bakery",
    logo: require("../../../assets/UI SCREEN/popular places/Ellipse 7.png"),
    latitude: 5.58,
    longitude: -0.21,
    prepMins: [5, 10],
    open: true,
  },
  {
    id: "st-airport-supermart",
    vendorId: "v-airport-supermart",
    name: "Airport Supermart",
    category: "groceries",
    latitude: 5.622,
    longitude: -0.173,
    prepMins: [10, 15],
    open: true,
  },
  {
    id: "st-osu-fresh-market",
    vendorId: "v-osu-fresh-market",
    name: "Osu Fresh Market",
    category: "groceries",
    latitude: 5.565,
    longitude: -0.18,
    prepMins: [10, 15],
    open: true,
  },
  {
    id: "st-medplus-pharmacy",
    vendorId: "v-medplus-pharmacy",
    name: "MedPlus Pharmacy",
    category: "pharmacy",
    latitude: 5.6,
    longitude: -0.19,
    prepMins: [5, 10],
    open: true,
  },
  {
    id: "st-kanda-chemists",
    vendorId: "v-kanda-chemists",
    name: "Kanda Chemists",
    category: "pharmacy",
    latitude: 5.64,
    longitude: -0.17,
    prepMins: [5, 10],
    open: true,
  },
  {
    id: "st-glowup-beauty",
    vendorId: "v-glowup-beauty",
    name: "GlowUp Beauty",
    category: "health-beauty",
    latitude: 5.61,
    longitude: -0.2,
    prepMins: [5, 10],
    open: true,
  },
  {
    id: "st-circuit-hub",
    vendorId: "v-circuit-hub",
    name: "Circuit Hub Electronics",
    category: "electronics",
    latitude: 5.615,
    longitude: -0.165,
    prepMins: [10, 15],
    open: true,
  },
  {
    id: "st-gadget-corner",
    vendorId: "v-gadget-corner",
    name: "Gadget Corner",
    category: "electronics",
    latitude: 5.57,
    longitude: -0.22,
    prepMins: [10, 20],
    open: true,
  },
  {
    id: "st-petals-co",
    vendorId: "v-petals-co",
    name: "Petals & Co.",
    category: "flowers",
    latitude: 5.606,
    longitude: -0.176,
    prepMins: [15, 25],
    open: true,
  },
  {
    id: "st-gift-box",
    vendorId: "v-gift-box",
    name: "Gift Box Accra",
    category: "gifts",
    latitude: 5.625,
    longitude: -0.195,
    prepMins: [10, 20],
    open: false,
  },
  {
    id: "st-buildrite",
    vendorId: "v-buildrite",
    name: "BuildRite Home & DIY",
    category: "home-diy",
    latitude: 5.59,
    longitude: -0.225,
    prepMins: [15, 25],
    open: true,
  },
  {
    id: "st-pro-sports",
    vendorId: "v-pro-sports",
    name: "Pro Sports Arena",
    category: "sports",
    latitude: 5.65,
    longitude: -0.24,
    prepMins: [10, 15],
    open: true,
  },
];
