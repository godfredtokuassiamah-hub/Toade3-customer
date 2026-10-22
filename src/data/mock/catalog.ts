// TODO(catalog): mock discovery catalog until S2 (catalog, price, stock)
// and S4 (discovery read model) exist. Read only by the mock oracle via
// src/services/discovery.ts.
//
// Home items reuse ./home.ts ids and photos (./foodImages.ts); extra items
// render the placeholder card. Prices are integer pesewas. The data is
// shaped so facets are meaningful: a GHS 5-150 spread, items in two
// categories, opening hours, one paused vendor, sold-out / disabled items
// and one item with an unknown weight.
import type { Category, MockCatalog, MockItem, MockVendor } from "../../lib/discovery/types";
import { foodImages } from "./foodImages";

export const CATEGORIES: Category[] = [
  { id: "local-dishes", label: "Local dishes", scope: "food", icon: "localDishes" },
  { id: "rice-meals", label: "Rice meals", scope: "food", icon: "riceMeals" },
  { id: "snacks", label: "Snacks", scope: "food", icon: "snacks" },
  { id: "drinks", label: "Drinks", scope: "food", icon: "drinks" },
  { id: "fruits-vegetables", label: "Fruits & vegetables", scope: "groceries", icon: "produce" },
  { id: "eggs-dairy", label: "Eggs & dairy", scope: "groceries", icon: "dairy" },
  { id: "bread-bakery", label: "Bread & bakery", scope: "groceries", icon: "bakery" },
  { id: "rice-grains", label: "Rice & staples", scope: "groceries", icon: "grains" },
  { id: "beverages", label: "Beverages", scope: "groceries", icon: "beverages" },
  { id: "household", label: "Household", scope: "groceries", icon: "household" },
  { id: "gadgets", label: "Gadgets", scope: "groceries", icon: "gadgets" },
  // Added for the Home category-shortcut grid so no tile routes to an empty
  // category. Each has a few placeholder grocery items below.
  { id: "gifts", label: "Gifts", scope: "groceries", icon: "gifts" },
  { id: "home-diy", label: "Home & DIY", scope: "groceries", icon: "homeDiy" },
  { id: "sports", label: "Sports", scope: "groceries", icon: "sports" },
  { id: "pharmacy", label: "Pharmacy", scope: "groceries", icon: "pharmacy" },
  { id: "flowers", label: "Flowers", scope: "groceries", icon: "flowers" },
  { id: "health-beauty", label: "Health & beauty", scope: "groceries", icon: "healthBeauty" },
];

const DAY = { open: "07:00", close: "22:00" };

export const VENDORS: MockVendor[] = [
  { vendor_id: "v-campus-grill", name: "Campus Grill", hours: DAY, paused: false },
  { vendor_id: "v-green-bowl", name: "Green Bowl Kitchen", hours: { open: "08:00", close: "21:00" }, paused: false },
  { vendor_id: "v-mamas-pot", name: "Mama's Pot", hours: { open: "09:00", close: "21:00" }, paused: false },
  { vendor_id: "v-auntie-ama", name: "Auntie Ama's Waakye", hours: { open: "06:00", close: "14:00" }, paused: false },
  // Paused: never "open now", but its menu stays browsable.
  { vendor_id: "v-lakeside", name: "Lakeside Chop Bar", hours: DAY, paused: true },
  { vendor_id: "v-campus-mart", name: "Campus Mart", hours: { open: "07:00", close: "23:00" }, paused: false },
  { vendor_id: "v-sweet-sip", name: "Sweet Sip Bar", hours: { open: "10:00", close: "22:00" }, paused: false },
  { vendor_id: "v-juice-hub", name: "Juice Hub", hours: { open: "08:00", close: "20:00" }, paused: false },
  // Breakfast only.
  { vendor_id: "v-brew-corner", name: "Brew Corner", hours: { open: "06:00", close: "11:00" }, paused: false },
  { vendor_id: "v-golden-crust", name: "Golden Crust Bakery", hours: { open: "06:00", close: "19:00" }, paused: false },
  { vendor_id: "v-sweet-tooth", name: "Sweet Tooth Desserts", hours: { open: "10:00", close: "22:00" }, paused: false },
  { vendor_id: "v-le-petit", name: "Le Petit Café", hours: { open: "07:00", close: "18:00" }, paused: false },
  { vendor_id: "v-fresh-basket", name: "Fresh Basket Market", hours: { open: "06:00", close: "19:00" }, paused: false },
  // Carries the extra store categories (gifts, home & DIY, sports, pharmacy,
  // flowers, health & beauty) added for the Home category grid.
  { vendor_id: "v-city-stores", name: "City Stores", hours: { open: "08:00", close: "21:00" }, paused: false },
];

type Seed = Omit<MockItem, "stock" | "disabled" | "weight_g" | "published" | "image"> &
  Partial<Pick<MockItem, "stock" | "disabled" | "weight_g" | "published">>;

const SEEDS: Seed[] = [
  // Home: Local meals
  { item_id: "lm-grilled-chicken-wedges", name: "Grilled Chicken & Wedges", vendor_id: "v-campus-grill", scope: "food", category_ids: ["local-dishes"], price_minor: 4500, eta_mins: 18 },
  { item_id: "lm-beef-veggie-rice", name: "Beef & Veggie Rice", vendor_id: "v-green-bowl", scope: "food", category_ids: ["rice-meals"], price_minor: 4000, eta_mins: 18 },
  { item_id: "lm-jollof-chicken", name: "Jollof Rice & Grilled Chicken", aliases: ["Jollof"], vendor_id: "v-mamas-pot", scope: "food", category_ids: ["rice-meals", "local-dishes"], price_minor: 3800, eta_mins: 20 },
  { item_id: "lm-waakye", name: "Yam Chips & Fried Chicken", aliases: ["Yam chips"], vendor_id: "v-auntie-ama", scope: "food", category_ids: ["local-dishes"], price_minor: 3000, eta_mins: 15 },
  { item_id: "lm-banku-tilapia", name: "Banku & Okro Stew", aliases: ["Banku"], vendor_id: "v-lakeside", scope: "food", category_ids: ["local-dishes"], price_minor: 5500, eta_mins: 25 },
  { item_id: "lm-fried-rice-chicken", name: "Fried Rice & Chicken", vendor_id: "v-campus-grill", scope: "food", category_ids: ["rice-meals"], price_minor: 4200, eta_mins: 20 },
  // Home: Drinks
  { item_id: "dr-matcha-bubble-tea", name: "Raspberry Iced Tea", aliases: ["Iced tea"], vendor_id: "v-green-bowl", scope: "food", category_ids: ["drinks"], price_minor: 2800, eta_mins: 12 },
  { item_id: "dr-bliss-sparkling-juice", name: "Tropical Mango Soda", vendor_id: "v-campus-mart", scope: "groceries", category_ids: ["beverages"], price_minor: 800, eta_mins: 8 },
  { item_id: "dr-sobolo", name: "Sobolo (Hibiscus)", aliases: ["Sobolo"], vendor_id: "v-sweet-sip", scope: "food", category_ids: ["drinks"], price_minor: 1000, eta_mins: 10 },
  { item_id: "dr-orange-juice", name: "Classic Cola (Can)", vendor_id: "v-juice-hub", scope: "food", category_ids: ["drinks"], price_minor: 1500, eta_mins: 10, stock: 0 },
  { item_id: "dr-iced-coffee", name: "Iced Lemon Tea", vendor_id: "v-brew-corner", scope: "food", category_ids: ["drinks"], price_minor: 2500, eta_mins: 12 },
  { item_id: "dr-mango-smoothie", name: "Strawberry Coconut Smoothie", vendor_id: "v-sweet-sip", scope: "food", category_ids: ["drinks"], price_minor: 2200, eta_mins: 12 },
  // Home: Bakery & Desserts
  { item_id: "bk-sliced-bread", name: "Deli Sandwich Trio", vendor_id: "v-golden-crust", scope: "groceries", category_ids: ["bread-bakery"], price_minor: 2000, eta_mins: 15 },
  { item_id: "bk-chocolate-cake", name: "Strawberry Cream Roll Cake", vendor_id: "v-sweet-tooth", scope: "food", category_ids: ["snacks"], price_minor: 3500, eta_mins: 20 },
  { item_id: "bk-meat-pie", name: "Toasted Ham & Cheese Sub", vendor_id: "v-golden-crust", scope: "food", category_ids: ["snacks"], price_minor: 1200, eta_mins: 15, stock: 0 },
  { item_id: "bk-croissant", name: "Vanilla Cream Roll", vendor_id: "v-le-petit", scope: "food", category_ids: ["snacks"], price_minor: 1800, eta_mins: 15 },
  { item_id: "bk-doughnuts", name: "Strawberry Roll Slices (6 pcs)", vendor_id: "v-sweet-tooth", scope: "food", category_ids: ["snacks"], price_minor: 1600, eta_mins: 15 },
  // Extra food
  { item_id: "cg-chicken-jollof", name: "Chicken Jollof", vendor_id: "v-campus-grill", scope: "food", category_ids: ["rice-meals", "local-dishes"], price_minor: 4000, eta_mins: 20 },
  { item_id: "fd-kelewele", name: "Spicy Kelewele", vendor_id: "v-auntie-ama", scope: "food", category_ids: ["snacks", "local-dishes"], price_minor: 1500, eta_mins: 15 },
  { item_id: "fd-red-red", name: "Carrot & Cucumber Salad", vendor_id: "v-mamas-pot", scope: "food", category_ids: ["local-dishes"], price_minor: 3200, eta_mins: 20 },
  { item_id: "fd-fufu-light-soup", name: "Fufu & Light Soup", vendor_id: "v-lakeside", scope: "food", category_ids: ["local-dishes"], price_minor: 6000, eta_mins: 30 },
  { item_id: "fd-chicken-shawarma", name: "Chicken Shawarma", vendor_id: "v-campus-grill", scope: "food", category_ids: ["snacks"], price_minor: 3500, eta_mins: 15 },
  { item_id: "dr-mint-tea", name: "Fresh Mint Tea", vendor_id: "v-brew-corner", scope: "food", category_ids: ["drinks"], price_minor: 1400, eta_mins: 10 },
  // Groceries
  { item_id: "gr-eggs-crate", name: "Eggs (crate of 30)", vendor_id: "v-campus-mart", scope: "groceries", category_ids: ["eggs-dairy"], price_minor: 6500, eta_mins: 15, weight_g: null },
  { item_id: "gr-fresh-milk", name: "Fresh Milk 1L", vendor_id: "v-campus-mart", scope: "groceries", category_ids: ["eggs-dairy"], price_minor: 1800, eta_mins: 15 },
  { item_id: "gr-brown-bread", name: "Brown Bread Loaf", vendor_id: "v-golden-crust", scope: "groceries", category_ids: ["bread-bakery"], price_minor: 2200, eta_mins: 15, disabled: true },
  { item_id: "gr-tomatoes", name: "Fresh Tomatoes 1kg", vendor_id: "v-fresh-basket", scope: "groceries", category_ids: ["fruits-vegetables"], price_minor: 1500, eta_mins: 20 },
  { item_id: "gr-plantain", name: "Ripe Plantain (bunch)", vendor_id: "v-fresh-basket", scope: "groceries", category_ids: ["fruits-vegetables", "rice-grains"], price_minor: 2500, eta_mins: 20 },
  { item_id: "gr-bananas", name: "Bananas (hand)", vendor_id: "v-fresh-basket", scope: "groceries", category_ids: ["fruits-vegetables"], price_minor: 1200, eta_mins: 20, stock: 0 },
  { item_id: "gr-onions", name: "Onions 1kg", vendor_id: "v-fresh-basket", scope: "groceries", category_ids: ["fruits-vegetables"], price_minor: 500, eta_mins: 20 },
  { item_id: "gr-yam", name: "Puna Yam (tuber)", vendor_id: "v-fresh-basket", scope: "groceries", category_ids: ["fruits-vegetables", "rice-grains"], price_minor: 3000, eta_mins: 20 },
  { item_id: "gr-rice-bag", name: "Jasmine Rice Bag 5kg", vendor_id: "v-campus-mart", scope: "groceries", category_ids: ["rice-grains"], price_minor: 12000, eta_mins: 25 },
  { item_id: "gr-cooking-oil", name: "Cooking Oil 5L", vendor_id: "v-campus-mart", scope: "groceries", category_ids: ["rice-grains"], price_minor: 15000, eta_mins: 25 },
  { item_id: "gr-sardines", name: "Sardines in Tomato Sauce", vendor_id: "v-campus-mart", scope: "groceries", category_ids: ["rice-grains"], price_minor: 650, eta_mins: 15 },
  { item_id: "gr-bottled-water", name: "Bottled Water (6 pack)", vendor_id: "v-campus-mart", scope: "groceries", category_ids: ["beverages"], price_minor: 2000, eta_mins: 15 },
  { item_id: "gr-dish-soap", name: "Dishwashing Liquid", vendor_id: "v-campus-mart", scope: "groceries", category_ids: ["household"], price_minor: 1400, eta_mins: 15 },
  { item_id: "gr-toilet-roll", name: "Toilet Roll (10 pack)", vendor_id: "v-campus-mart", scope: "groceries", category_ids: ["household"], price_minor: 5000, eta_mins: 15 },
  // Extra store categories for the Home category grid (placeholder items).
  { item_id: "gf-gift-hamper", name: "Chocolate Treats Box", aliases: ["Gift hamper", "Chocolate box"], vendor_id: "v-city-stores", scope: "groceries", category_ids: ["gifts"], price_minor: 25000, eta_mins: 30, weight_g: 2000 },
  { item_id: "gf-greeting-card", name: "Stitch Pamper Gift Box", vendor_id: "v-city-stores", scope: "groceries", category_ids: ["gifts"], price_minor: 32000, eta_mins: 30, weight_g: 1500 },
  { item_id: "gf-scented-candle", name: "Stitch Plush Gift Set", vendor_id: "v-city-stores", scope: "groceries", category_ids: ["gifts"], price_minor: 38000, eta_mins: 30, weight_g: 1800 },
  { item_id: "gf-cute-blue-box", name: "Cute Blue Surprise Box", vendor_id: "v-city-stores", scope: "groceries", category_ids: ["gifts"], price_minor: 29000, eta_mins: 30, weight_g: 1500 },
  { item_id: "gf-executive-set", name: "Executive Blue Gift Set", vendor_id: "v-city-stores", scope: "groceries", category_ids: ["gifts"], price_minor: 45000, eta_mins: 30, weight_g: 1600 },
  { item_id: "gf-stationery-crate", name: "Stationery Gift Crate", vendor_id: "v-city-stores", scope: "groceries", category_ids: ["gifts"], price_minor: 18000, eta_mins: 30, weight_g: 1200 },
  { item_id: "hd-led-desk-lamp", name: "LED Desk Lamp", vendor_id: "v-city-stores", scope: "groceries", category_ids: ["home-diy"], price_minor: 9500, eta_mins: 35, weight_g: 800 },
  { item_id: "hd-screwdriver-set", name: "Screwdriver Set", vendor_id: "v-city-stores", scope: "groceries", category_ids: ["home-diy"], price_minor: 6000, eta_mins: 35, weight_g: 600 },
  { item_id: "hd-wall-hooks", name: "Adhesive Wall Hooks (6 pack)", vendor_id: "v-city-stores", scope: "groceries", category_ids: ["home-diy"], price_minor: 2200, eta_mins: 35, weight_g: 150 },
  { item_id: "sp-yoga-mat", name: "Stair Climber Machine", vendor_id: "v-city-stores", scope: "groceries", category_ids: ["sports"], price_minor: 950000, eta_mins: 60, weight_g: 7500 },
  { item_id: "sp-dumbbell-set", name: "Vinyl Kettlebell Set (4-12kg)", aliases: ["Kettlebell"], vendor_id: "v-city-stores", scope: "groceries", category_ids: ["sports"], price_minor: 45000, eta_mins: 40, weight_g: 4000 },
  { item_id: "sp-skipping-rope", name: "Basketball Backpack", vendor_id: "v-city-stores", scope: "groceries", category_ids: ["sports"], price_minor: 32000, eta_mins: 35, weight_g: 900 },
  { item_id: "sp-bottle-pouch", name: "Water Bottle Phone Pouch", vendor_id: "v-city-stores", scope: "groceries", category_ids: ["sports"], price_minor: 9500, eta_mins: 35, weight_g: 200 },
  { item_id: "sp-pocket-gimbal", name: "Pocket Gimbal Camera", vendor_id: "v-city-stores", scope: "groceries", category_ids: ["sports"], price_minor: 650000, eta_mins: 40, weight_g: 300 },
  { item_id: "ph-paracetamol", name: "Paracetamol (16 tablets)", vendor_id: "v-city-stores", scope: "groceries", category_ids: ["pharmacy"], price_minor: 1000, eta_mins: 25, weight_g: 40 },
  { item_id: "ph-hand-sanitiser", name: "Hand Sanitiser 250ml", vendor_id: "v-city-stores", scope: "groceries", category_ids: ["pharmacy"], price_minor: 1800, eta_mins: 25, weight_g: 280 },
  { item_id: "ph-plasters", name: "Adhesive Plasters (20 pack)", vendor_id: "v-city-stores", scope: "groceries", category_ids: ["pharmacy"], price_minor: 1200, eta_mins: 25, weight_g: 60 },
  { item_id: "fl-rose-bouquet", name: "Rose Bouquet", vendor_id: "v-city-stores", scope: "groceries", category_ids: ["flowers"], price_minor: 12000, eta_mins: 40, weight_g: 700 },
  { item_id: "fl-mixed-bouquet", name: "Mixed Flower Bouquet", vendor_id: "v-city-stores", scope: "groceries", category_ids: ["flowers"], price_minor: 9000, eta_mins: 40, weight_g: 700 },
  { item_id: "hb-body-lotion", name: "Body Lotion 400ml", vendor_id: "v-city-stores", scope: "groceries", category_ids: ["health-beauty"], price_minor: 3500, eta_mins: 30, weight_g: 450 },
  { item_id: "hb-lip-balm", name: "Lip Balm", vendor_id: "v-city-stores", scope: "groceries", category_ids: ["health-beauty"], price_minor: 1500, eta_mins: 30, weight_g: 30 },
  { item_id: "hb-face-wash", name: "Gentle Face Wash", vendor_id: "v-city-stores", scope: "groceries", category_ids: ["health-beauty"], price_minor: 2800, eta_mins: 30, weight_g: 200 },
  // Electronics tile maps to the existing (previously empty) gadgets
  // category; give it stocked items so the tile never lands on zero results.
  { item_id: "el-earbuds", name: "Wireless Earbuds", vendor_id: "v-city-stores", scope: "groceries", category_ids: ["gadgets"], price_minor: 16000, eta_mins: 35, weight_g: 120 },
  { item_id: "el-phone-charger", name: "Fast Phone Charger", vendor_id: "v-city-stores", scope: "groceries", category_ids: ["gadgets"], price_minor: 7000, eta_mins: 35, weight_g: 150 },
  { item_id: "el-power-bank", name: "10000mAh Power Bank", vendor_id: "v-city-stores", scope: "groceries", category_ids: ["gadgets"], price_minor: 13000, eta_mins: 35, weight_g: 300 },
  // Unpublished: must never appear anywhere.
  { item_id: "zz-draft-item", name: "Draft Menu Item", vendor_id: "v-campus-grill", scope: "food", category_ids: ["local-dishes"], price_minor: 2000, eta_mins: 15, published: false },
];

export const ITEMS: MockItem[] = SEEDS.map((s) => ({
  stock: 20,
  disabled: false,
  weight_g: 500,
  published: true,
  ...s,
  image: foodImages[s.item_id],
}));

// Resolves favourite item ids against the catalog, preserving the input
// order (most-recent-first) and dropping ids that no longer exist or are
// unpublished. Used by the Favourites screen.
export function getItemsByIds(ids: readonly string[]): MockItem[] {
  const byId = new Map(ITEMS.filter((i) => i.published).map((i) => [i.item_id, i]));
  const out: MockItem[] = [];
  for (const id of ids) {
    const item = byId.get(id);
    if (item) out.push(item);
  }
  return out;
}

// Vendor lookup for the storefront screen. undefined for an unknown id.
const VENDORS_BY_ID = new Map(VENDORS.map((v) => [v.vendor_id, v]));

export function getVendorById(vendorId: string): MockVendor | undefined {
  return VENDORS_BY_ID.get(vendorId);
}

// A vendor's menu for the storefront: published, non-disabled items in
// catalog (ITEMS) order. Sold-out (stock: 0) items stay INCLUDED — the
// screen keeps them visible and marked, matching the cards elsewhere.
export function getItemsByVendor(vendorId: string): MockItem[] {
  return ITEMS.filter((i) => i.vendor_id === vendorId && i.published && !i.disabled);
}

// Owning vendor id for a catalog item id. Used by home.ts to backfill the
// static Home items' vendorId so a tap opens the right storefront.
const VENDOR_ID_BY_ITEM = new Map(ITEMS.map((i) => [i.item_id, i.vendor_id]));

export function getVendorIdForItem(itemId: string): string | undefined {
  return VENDOR_ID_BY_ITEM.get(itemId);
}

// Popular typed searches offered as query suggestions.
export const SUGGESTION_TERMS = [
  "Jollof rice",
  "Fried rice",
  "Waakye",
  "Banku",
  "Kelewele",
  "Grilled chicken",
  "Chicken",
  "Shawarma",
  "Sobolo",
  "Bubble tea",
  "Smoothie",
  "Coffee",
  "Meat pie",
  "Cake",
  "Croissant",
  "Doughnuts",
  "Bread",
  "Eggs",
  "Milk",
  "Tomatoes",
  "Plantain",
  "Rice bag",
  "Water",
  "Juice",
];

export const mockDiscoveryCatalog: MockCatalog = {
  revision: 1,
  categories: CATEGORIES,
  vendors: VENDORS,
  items: ITEMS,
  suggestion_terms: SUGGESTION_TERMS,
};
