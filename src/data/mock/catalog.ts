// TODO(catalog): mock discovery catalog until S2 (catalog, price, stock)
// and S4 (discovery read model) exist. Read only by the mock oracle via
// src/services/discovery.ts.
//
// Home items reuse ./home.ts ids and photos (./foodImages.ts); extra items
// render the placeholder card. Prices are integer pesewas. The data is
// shaped so facets are meaningful: a GHS 5-150 spread, items in two
// categories, opening hours, one paused vendor, sold-out / disabled items
// and one item with an unknown weight.
import type {
  Category,
  MockCatalog,
  MockItem,
  MockVendor,
  ServiceType,
} from "../../lib/discovery/types";
import { encode, shortenCode } from "../../lib/location/plusCode";
import { foodImages } from "./foodImages";
import { STORES } from "./stores";
import { getVendorLocation } from "./vendorLocations";

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
// Store-linked vendors mirror the Stores-tab card's static `open` flag:
// open stores are open at every hour, closed ones are paused.
const ALL_DAY = { open: "00:00", close: "24:00" };

// Same modules as src/data/mock/stores.ts, so vendor.logo === store.logo.
const STORE_LOGOS = {
  medieFoods: require("../../../assets/UI SCREEN/popular places/Ellipse 3.png"),
  churros: require("../../../assets/UI SCREEN/popular places/Ellipse 4.png"),
  milk: require("../../../assets/UI SCREEN/popular places/Ellipse 5.png"),
  redRock: require("../../../assets/UI SCREEN/popular places/Ellipse 6.png"),
  gamesa: require("../../../assets/UI SCREEN/popular places/Ellipse 7.png"),
};

// MOCK demo placeholder ratings for the storefront stats row — replace with
// real review data (S7) before release. Only the three vendors that appear in
// the mock orders have one; every other vendor shows no rating at all.
const MOCK_RATINGS = {
  campusGrill: { value: 4.5, count: 5234 },
  auntieAma: { value: 4.7, count: 1280 },
  sweetSip: { value: 4.3, count: 640 },
} satisfies Record<string, NonNullable<MockVendor["rating"]>>;

// MOCK location for a store-linked vendor, read from its Stores-tab entry
// (src/data/mock/stores.ts) so no coordinates are copied here. The address
// line is the short plus code (e.g. "JR3F+QV Accra"). {} for an unknown id.
const STORE_BY_VENDOR = new Map(
  STORES.flatMap((s) => (s.vendorId ? [[s.vendorId, s] as const] : [])),
);

type VendorPlaceFields = Pick<MockVendor, "latitude" | "longitude" | "addressLabel">;

function placeAt(latitude: number, longitude: number): VendorPlaceFields {
  return {
    latitude,
    longitude,
    addressLabel: `${shortenCode(encode(latitude, longitude, 10))} Accra`,
  };
}

function storeLocation(vendorId: string): VendorPlaceFields {
  const store = STORE_BY_VENDOR.get(vendorId);
  return store ? placeAt(store.latitude, store.longitude) : {};
}

// Catalog-only vendors: the same MOCK pickup point the checkout estimate
// uses (./vendorLocations.ts), so the map and the quote agree.
function catalogLocation(vendorId: string): VendorPlaceFields {
  const { latitude, longitude } = getVendorLocation(vendorId);
  return placeAt(latitude, longitude);
}

// MOCK "More info" service types (display only).
const STORE_SERVICES: ServiceType[] = ["delivery", "scheduled"];

// MOCK placeholder numbers (+233 20 000 NNNN), not real lines. Sequential so
// they are obviously fake.
export const VENDORS: MockVendor[] = [
  { vendor_id: "v-campus-grill", name: "Campus Grill", hours: DAY, paused: false, rating: MOCK_RATINGS.campusGrill, phone: "+233 20 000 0001", ...catalogLocation("v-campus-grill"), serviceTypes: ["delivery", "scheduled", "pickup"] },
  { vendor_id: "v-green-bowl", name: "Green Bowl Kitchen", hours: { open: "08:00", close: "21:00" }, paused: false },
  { vendor_id: "v-mamas-pot", name: "Mama's Pot", hours: { open: "09:00", close: "21:00" }, paused: false },
  { vendor_id: "v-auntie-ama", name: "Auntie Ama's Waakye", hours: { open: "06:00", close: "14:00" }, paused: false, rating: MOCK_RATINGS.auntieAma, phone: "+233 20 000 0002", ...catalogLocation("v-auntie-ama"), serviceTypes: ["delivery"] },
  // Paused: never "open now", but its menu stays browsable. Address only (no
  // phone, no coordinates): exercises the hidden Call / map rows.
  { vendor_id: "v-lakeside", name: "Lakeside Chop Bar", hours: DAY, paused: true, addressLabel: "Lakeside Estates, Accra" },
  { vendor_id: "v-campus-mart", name: "Campus Mart", hours: { open: "07:00", close: "23:00" }, paused: false },
  { vendor_id: "v-sweet-sip", name: "Sweet Sip Bar", hours: { open: "10:00", close: "22:00" }, paused: false, rating: MOCK_RATINGS.sweetSip },
  { vendor_id: "v-juice-hub", name: "Juice Hub", hours: { open: "08:00", close: "20:00" }, paused: false },
  // Breakfast only.
  { vendor_id: "v-brew-corner", name: "Brew Corner", hours: { open: "06:00", close: "11:00" }, paused: false },
  { vendor_id: "v-golden-crust", name: "Golden Crust Bakery", hours: { open: "06:00", close: "19:00" }, paused: false, phone: "+233 20 000 0003", ...catalogLocation("v-golden-crust"), serviceTypes: ["delivery", "pickup"] },
  { vendor_id: "v-sweet-tooth", name: "Sweet Tooth Desserts", hours: { open: "10:00", close: "22:00" }, paused: false },
  { vendor_id: "v-le-petit", name: "Le Petit Café", hours: { open: "07:00", close: "18:00" }, paused: false },
  { vendor_id: "v-fresh-basket", name: "Fresh Basket Market", hours: { open: "06:00", close: "19:00" }, paused: false },
  // Carries the extra store categories (gifts, home & DIY, sports, pharmacy,
  // flowers, health & beauty) added for the Home category grid.
  { vendor_id: "v-city-stores", name: "City Stores", hours: { open: "08:00", close: "21:00" }, paused: false },
  // One vendor per Stores-tab store (src/data/mock/stores.ts); name/open state/logo mirror the card.
  // Location (coordinates + plus-code address) comes from the store entry.
  { vendor_id: "v-medie-foods", name: "Medie Foods", hours: ALL_DAY, paused: false, logo: STORE_LOGOS.medieFoods, phone: "+233 20 000 0004", ...storeLocation("v-medie-foods"), serviceTypes: STORE_SERVICES },
  { vendor_id: "v-churros", name: "Churros", hours: ALL_DAY, paused: false, logo: STORE_LOGOS.churros, phone: "+233 20 000 0005", ...storeLocation("v-churros"), serviceTypes: STORE_SERVICES },
  { vendor_id: "v-milk", name: "Milk", hours: ALL_DAY, paused: false, logo: STORE_LOGOS.milk, phone: "+233 20 000 0006", ...storeLocation("v-milk"), serviceTypes: STORE_SERVICES },
  { vendor_id: "v-red-rock", name: "Red Rock", hours: { open: "07:00", close: "22:00" }, paused: true, logo: STORE_LOGOS.redRock, phone: "+233 20 000 0007", ...storeLocation("v-red-rock"), serviceTypes: STORE_SERVICES },
  { vendor_id: "v-gamesa", name: "Gamesa", hours: ALL_DAY, paused: false, logo: STORE_LOGOS.gamesa, phone: "+233 20 000 0008", ...storeLocation("v-gamesa"), serviceTypes: STORE_SERVICES },
  { vendor_id: "v-airport-supermart", name: "Airport Supermart", hours: ALL_DAY, paused: false, phone: "+233 20 000 0009", ...storeLocation("v-airport-supermart"), serviceTypes: STORE_SERVICES },
  { vendor_id: "v-osu-fresh-market", name: "Osu Fresh Market", hours: ALL_DAY, paused: false, phone: "+233 20 000 0010", ...storeLocation("v-osu-fresh-market"), serviceTypes: STORE_SERVICES },
  { vendor_id: "v-medplus-pharmacy", name: "MedPlus Pharmacy", hours: ALL_DAY, paused: false, phone: "+233 20 000 0011", ...storeLocation("v-medplus-pharmacy"), serviceTypes: STORE_SERVICES },
  { vendor_id: "v-kanda-chemists", name: "Kanda Chemists", hours: ALL_DAY, paused: false, phone: "+233 20 000 0012", ...storeLocation("v-kanda-chemists"), serviceTypes: STORE_SERVICES },
  { vendor_id: "v-glowup-beauty", name: "GlowUp Beauty", hours: ALL_DAY, paused: false, phone: "+233 20 000 0013", ...storeLocation("v-glowup-beauty"), serviceTypes: STORE_SERVICES },
  { vendor_id: "v-circuit-hub", name: "Circuit Hub Electronics", hours: ALL_DAY, paused: false, phone: "+233 20 000 0014", ...storeLocation("v-circuit-hub"), serviceTypes: STORE_SERVICES },
  { vendor_id: "v-gadget-corner", name: "Gadget Corner", hours: ALL_DAY, paused: false, phone: "+233 20 000 0015", ...storeLocation("v-gadget-corner"), serviceTypes: STORE_SERVICES },
  { vendor_id: "v-petals-co", name: "Petals & Co.", hours: ALL_DAY, paused: false, phone: "+233 20 000 0016", ...storeLocation("v-petals-co"), serviceTypes: STORE_SERVICES },
  { vendor_id: "v-gift-box", name: "Gift Box Accra", hours: { open: "09:00", close: "20:00" }, paused: true, phone: "+233 20 000 0017", ...storeLocation("v-gift-box"), serviceTypes: STORE_SERVICES },
  { vendor_id: "v-buildrite", name: "BuildRite Home & DIY", hours: ALL_DAY, paused: false, phone: "+233 20 000 0018", ...storeLocation("v-buildrite"), serviceTypes: STORE_SERVICES },
  { vendor_id: "v-pro-sports", name: "Pro Sports Arena", hours: ALL_DAY, paused: false, phone: "+233 20 000 0019", ...storeLocation("v-pro-sports"), serviceTypes: STORE_SERVICES },
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
  // Medie Foods
  { item_id: "mf-waakye-special", name: "Waakye Special", vendor_id: "v-medie-foods", scope: "food", category_ids: ["local-dishes"], price_minor: 3500, eta_mins: 20 },
  { item_id: "mf-banku-tilapia", name: "Banku & Grilled Tilapia", vendor_id: "v-medie-foods", scope: "food", category_ids: ["local-dishes"], price_minor: 6500, eta_mins: 25 },
  { item_id: "mf-assorted-fried-rice", name: "Assorted Fried Rice", vendor_id: "v-medie-foods", scope: "food", category_ids: ["rice-meals"], price_minor: 4500, eta_mins: 20 },
  { item_id: "mf-rice-chicken-stew", name: "Plain Rice & Chicken Stew", vendor_id: "v-medie-foods", scope: "food", category_ids: ["rice-meals"], price_minor: 3200, eta_mins: 18 },
  { item_id: "mf-kenkey-fish", name: "Kenkey & Fried Fish", vendor_id: "v-medie-foods", scope: "food", category_ids: ["local-dishes"], price_minor: 3000, eta_mins: 20 },
  { item_id: "mf-bissap", name: "Fresh Bissap Drink", vendor_id: "v-medie-foods", scope: "food", category_ids: ["drinks"], price_minor: 1000, eta_mins: 8 },
  // Churros
  { item_id: "cr-classic-churros", name: "Classic Churros (6 pcs)", vendor_id: "v-churros", scope: "food", category_ids: ["snacks"], price_minor: 2500, eta_mins: 12 },
  { item_id: "cr-chocolate-dip", name: "Churros with Chocolate Dip", vendor_id: "v-churros", scope: "food", category_ids: ["snacks"], price_minor: 3200, eta_mins: 12 },
  { item_id: "cr-cinnamon-bites", name: "Cinnamon Sugar Bites", vendor_id: "v-churros", scope: "food", category_ids: ["snacks"], price_minor: 1800, eta_mins: 10 },
  { item_id: "cr-caramel-churros", name: "Caramel-Filled Churros", vendor_id: "v-churros", scope: "food", category_ids: ["snacks"], price_minor: 3000, eta_mins: 15 },
  { item_id: "cr-hot-chocolate", name: "Hot Chocolate", vendor_id: "v-churros", scope: "food", category_ids: ["drinks"], price_minor: 2000, eta_mins: 8 },
  // Milk
  { item_id: "mk-whole-milk", name: "Fresh Whole Milk 1L", vendor_id: "v-milk", scope: "groceries", category_ids: ["eggs-dairy"], price_minor: 1900, eta_mins: 12, weight_g: 1050 },
  { item_id: "mk-low-fat-milk", name: "Low-Fat Milk 1L", vendor_id: "v-milk", scope: "groceries", category_ids: ["eggs-dairy"], price_minor: 1900, eta_mins: 12, weight_g: 1050 },
  { item_id: "mk-yoghurt", name: "Natural Yoghurt 500g", vendor_id: "v-milk", scope: "groceries", category_ids: ["eggs-dairy"], price_minor: 2200, eta_mins: 12 },
  { item_id: "mk-cheddar", name: "Cheddar Cheese 200g", vendor_id: "v-milk", scope: "groceries", category_ids: ["eggs-dairy"], price_minor: 3500, eta_mins: 12, weight_g: 220 },
  { item_id: "mk-butter", name: "Salted Butter 250g", vendor_id: "v-milk", scope: "groceries", category_ids: ["eggs-dairy"], price_minor: 3000, eta_mins: 12, weight_g: 260 },
  { item_id: "mk-chocolate-milk", name: "Chocolate Milk 500ml", vendor_id: "v-milk", scope: "groceries", category_ids: ["beverages"], price_minor: 1200, eta_mins: 10, weight_g: 530 },
  // Red Rock (paused)
  { item_id: "rr-goat-kebab", name: "Grilled Goat Kebab", vendor_id: "v-red-rock", scope: "food", category_ids: ["local-dishes"], price_minor: 3800, eta_mins: 20 },
  { item_id: "rr-red-red", name: "Red Red & Fried Plantain", vendor_id: "v-red-rock", scope: "food", category_ids: ["local-dishes"], price_minor: 3000, eta_mins: 20 },
  { item_id: "rr-coconut-rice", name: "Coconut Rice & Chicken", vendor_id: "v-red-rock", scope: "food", category_ids: ["rice-meals"], price_minor: 4800, eta_mins: 25 },
  { item_id: "rr-tuo-zaafi", name: "Tuo Zaafi & Ayoyo Soup", vendor_id: "v-red-rock", scope: "food", category_ids: ["local-dishes"], price_minor: 3500, eta_mins: 25 },
  { item_id: "rr-pineapple-ginger", name: "Pineapple Ginger Juice", vendor_id: "v-red-rock", scope: "food", category_ids: ["drinks"], price_minor: 1200, eta_mins: 8 },
  // Gamesa
  { item_id: "gm-butter-cookies", name: "Butter Cookies Tin", vendor_id: "v-gamesa", scope: "groceries", category_ids: ["bread-bakery"], price_minor: 3500, eta_mins: 12, weight_g: 450 },
  { item_id: "gm-sugar-bread", name: "Sugar Bread Loaf", vendor_id: "v-gamesa", scope: "groceries", category_ids: ["bread-bakery"], price_minor: 1500, eta_mins: 12 },
  { item_id: "gm-oatmeal-cookies", name: "Oatmeal Raisin Cookies (6 pcs)", vendor_id: "v-gamesa", scope: "food", category_ids: ["snacks"], price_minor: 1800, eta_mins: 10 },
  { item_id: "gm-choc-chip-cookies", name: "Chocolate Chip Cookies (6 pcs)", vendor_id: "v-gamesa", scope: "food", category_ids: ["snacks"], price_minor: 2000, eta_mins: 10 },
  { item_id: "gm-coconut-biscuits", name: "Coconut Biscuits", vendor_id: "v-gamesa", scope: "food", category_ids: ["snacks"], price_minor: 1200, eta_mins: 10 },
  { item_id: "gm-beef-pie", name: "Beef Meat Pie", vendor_id: "v-gamesa", scope: "food", category_ids: ["snacks"], price_minor: 1500, eta_mins: 12 },
  // Airport Supermart
  { item_id: "as-basmati-rice", name: "Basmati Rice 5kg", vendor_id: "v-airport-supermart", scope: "groceries", category_ids: ["rice-grains"], price_minor: 14000, eta_mins: 25, weight_g: 5000 },
  { item_id: "as-spaghetti", name: "Spaghetti 500g", vendor_id: "v-airport-supermart", scope: "groceries", category_ids: ["rice-grains"], price_minor: 1200, eta_mins: 15 },
  { item_id: "as-tomato-paste", name: "Tomato Paste (tin)", vendor_id: "v-airport-supermart", scope: "groceries", category_ids: ["rice-grains"], price_minor: 900, eta_mins: 15, weight_g: 400 },
  { item_id: "as-mineral-water", name: "Mineral Water 1.5L", vendor_id: "v-airport-supermart", scope: "groceries", category_ids: ["beverages"], price_minor: 700, eta_mins: 15, weight_g: 1550 },
  { item_id: "as-laundry-detergent", name: "Laundry Detergent 2kg", vendor_id: "v-airport-supermart", scope: "groceries", category_ids: ["household"], price_minor: 6500, eta_mins: 20, weight_g: 2000 },
  { item_id: "as-apples", name: "Fresh Apples (4 pack)", vendor_id: "v-airport-supermart", scope: "groceries", category_ids: ["fruits-vegetables"], price_minor: 2800, eta_mins: 20, weight_g: 700 },
  // Osu Fresh Market
  { item_id: "om-pineapple", name: "Sugarloaf Pineapple", vendor_id: "v-osu-fresh-market", scope: "groceries", category_ids: ["fruits-vegetables"], price_minor: 1500, eta_mins: 20, weight_g: 1500 },
  { item_id: "om-garden-eggs", name: "Garden Eggs 1kg", vendor_id: "v-osu-fresh-market", scope: "groceries", category_ids: ["fruits-vegetables"], price_minor: 1200, eta_mins: 20, weight_g: 1000 },
  { item_id: "om-okro", name: "Fresh Okro 500g", vendor_id: "v-osu-fresh-market", scope: "groceries", category_ids: ["fruits-vegetables"], price_minor: 1000, eta_mins: 20 },
  { item_id: "om-avocados", name: "Avocados (3 pcs)", vendor_id: "v-osu-fresh-market", scope: "groceries", category_ids: ["fruits-vegetables"], price_minor: 1800, eta_mins: 20, weight_g: 750 },
  { item_id: "om-cassava", name: "Cassava (tuber)", vendor_id: "v-osu-fresh-market", scope: "groceries", category_ids: ["fruits-vegetables", "rice-grains"], price_minor: 1500, eta_mins: 20, weight_g: 1500 },
  { item_id: "om-kontomire", name: "Kontomire Leaves (bunch)", vendor_id: "v-osu-fresh-market", scope: "groceries", category_ids: ["fruits-vegetables"], price_minor: 800, eta_mins: 20, weight_g: 300 },
  // MedPlus Pharmacy
  { item_id: "mp-ibuprofen", name: "Ibuprofen 200mg (24 tablets)", vendor_id: "v-medplus-pharmacy", scope: "groceries", category_ids: ["pharmacy"], price_minor: 1500, eta_mins: 20, weight_g: 40 },
  { item_id: "mp-vitamin-c", name: "Vitamin C 1000mg (20 tablets)", vendor_id: "v-medplus-pharmacy", scope: "groceries", category_ids: ["pharmacy"], price_minor: 2500, eta_mins: 20, weight_g: 80 },
  { item_id: "mp-ors", name: "Oral Rehydration Salts (10 sachets)", vendor_id: "v-medplus-pharmacy", scope: "groceries", category_ids: ["pharmacy"], price_minor: 1200, eta_mins: 20, weight_g: 100 },
  { item_id: "mp-thermometer", name: "Digital Thermometer", vendor_id: "v-medplus-pharmacy", scope: "groceries", category_ids: ["pharmacy"], price_minor: 6000, eta_mins: 25, weight_g: 50 },
  { item_id: "mp-antiseptic", name: "Antiseptic Liquid 250ml", vendor_id: "v-medplus-pharmacy", scope: "groceries", category_ids: ["pharmacy"], price_minor: 2200, eta_mins: 20, weight_g: 300 },
  { item_id: "mp-face-masks", name: "Face Masks (50 pack)", vendor_id: "v-medplus-pharmacy", scope: "groceries", category_ids: ["pharmacy"], price_minor: 3000, eta_mins: 20, weight_g: 200 },
  // Kanda Chemists
  { item_id: "kc-cough-syrup", name: "Cough Syrup 100ml", vendor_id: "v-kanda-chemists", scope: "groceries", category_ids: ["pharmacy"], price_minor: 2800, eta_mins: 20, weight_g: 150 },
  { item_id: "kc-antacid", name: "Antacid Tablets (24)", vendor_id: "v-kanda-chemists", scope: "groceries", category_ids: ["pharmacy"], price_minor: 1600, eta_mins: 20, weight_g: 50 },
  { item_id: "kc-allergy-relief", name: "Allergy Relief Tablets (10)", vendor_id: "v-kanda-chemists", scope: "groceries", category_ids: ["pharmacy"], price_minor: 2000, eta_mins: 20, weight_g: 30 },
  { item_id: "kc-crepe-bandage", name: "Crepe Bandage", vendor_id: "v-kanda-chemists", scope: "groceries", category_ids: ["pharmacy"], price_minor: 1500, eta_mins: 20, weight_g: 60 },
  { item_id: "kc-multivitamins", name: "Multivitamins (30 tablets)", vendor_id: "v-kanda-chemists", scope: "groceries", category_ids: ["pharmacy"], price_minor: 4500, eta_mins: 20, weight_g: 100 },
  // GlowUp Beauty
  { item_id: "gb-shea-butter", name: "Pure Shea Butter 250g", vendor_id: "v-glowup-beauty", scope: "groceries", category_ids: ["health-beauty"], price_minor: 3000, eta_mins: 25, weight_g: 260 },
  { item_id: "gb-black-soap", name: "African Black Soap", vendor_id: "v-glowup-beauty", scope: "groceries", category_ids: ["health-beauty"], price_minor: 1800, eta_mins: 25, weight_g: 200 },
  { item_id: "gb-hair-oil", name: "Coconut Hair Oil 200ml", vendor_id: "v-glowup-beauty", scope: "groceries", category_ids: ["health-beauty"], price_minor: 2500, eta_mins: 25, weight_g: 220 },
  { item_id: "gb-sunscreen", name: "Sunscreen SPF 50", vendor_id: "v-glowup-beauty", scope: "groceries", category_ids: ["health-beauty"], price_minor: 6500, eta_mins: 25, weight_g: 120 },
  { item_id: "gb-nail-polish", name: "Nail Polish", vendor_id: "v-glowup-beauty", scope: "groceries", category_ids: ["health-beauty"], price_minor: 1500, eta_mins: 25, weight_g: 30 },
  { item_id: "gb-body-scrub", name: "Sugar Body Scrub", vendor_id: "v-glowup-beauty", scope: "groceries", category_ids: ["health-beauty"], price_minor: 4200, eta_mins: 25, weight_g: 300 },
  // Circuit Hub Electronics
  { item_id: "ci-bt-speaker", name: "Bluetooth Speaker", vendor_id: "v-circuit-hub", scope: "groceries", category_ids: ["gadgets"], price_minor: 22000, eta_mins: 40, weight_g: 600 },
  { item_id: "ci-hdmi-cable", name: "HDMI Cable 2m", vendor_id: "v-circuit-hub", scope: "groceries", category_ids: ["gadgets"], price_minor: 4500, eta_mins: 35, weight_g: 150 },
  { item_id: "ci-usb-c-cable", name: "USB-C Charging Cable", vendor_id: "v-circuit-hub", scope: "groceries", category_ids: ["gadgets"], price_minor: 2500, eta_mins: 35, weight_g: 80 },
  { item_id: "ci-wireless-mouse", name: "Wireless Mouse", vendor_id: "v-circuit-hub", scope: "groceries", category_ids: ["gadgets"], price_minor: 8500, eta_mins: 35, weight_g: 120 },
  { item_id: "ci-surge-protector", name: "Surge Protector Extension", vendor_id: "v-circuit-hub", scope: "groceries", category_ids: ["gadgets"], price_minor: 12000, eta_mins: 40, weight_g: 700 },
  // Gadget Corner
  { item_id: "gc-smart-watch", name: "Smart Watch", vendor_id: "v-gadget-corner", scope: "groceries", category_ids: ["gadgets"], price_minor: 35000, eta_mins: 40, weight_g: 150 },
  { item_id: "gc-phone-case", name: "Shockproof Phone Case", vendor_id: "v-gadget-corner", scope: "groceries", category_ids: ["gadgets"], price_minor: 4500, eta_mins: 30, weight_g: 80 },
  { item_id: "gc-screen-protector", name: "Tempered Glass Screen Protector", vendor_id: "v-gadget-corner", scope: "groceries", category_ids: ["gadgets"], price_minor: 2500, eta_mins: 30, weight_g: 40 },
  { item_id: "gc-car-charger", name: "Dual USB Car Charger", vendor_id: "v-gadget-corner", scope: "groceries", category_ids: ["gadgets"], price_minor: 6000, eta_mins: 30, weight_g: 80 },
  { item_id: "gc-ring-light", name: "Selfie Ring Light", vendor_id: "v-gadget-corner", scope: "groceries", category_ids: ["gadgets"], price_minor: 9500, eta_mins: 35, weight_g: 500 },
  // Petals & Co.
  { item_id: "pc-red-roses", name: "Dozen Red Roses", vendor_id: "v-petals-co", scope: "groceries", category_ids: ["flowers"], price_minor: 18000, eta_mins: 45, weight_g: 800 },
  { item_id: "pc-sunflowers", name: "Sunflower Bunch", vendor_id: "v-petals-co", scope: "groceries", category_ids: ["flowers"], price_minor: 11000, eta_mins: 45, weight_g: 700 },
  { item_id: "pc-lily-bouquet", name: "White Lily Bouquet", vendor_id: "v-petals-co", scope: "groceries", category_ids: ["flowers"], price_minor: 15000, eta_mins: 45, weight_g: 800 },
  { item_id: "pc-potted-orchid", name: "Potted Orchid", vendor_id: "v-petals-co", scope: "groceries", category_ids: ["flowers"], price_minor: 22000, eta_mins: 50, weight_g: 1500 },
  { item_id: "pc-flower-box", name: "Pastel Flower Box", vendor_id: "v-petals-co", scope: "groceries", category_ids: ["flowers"], price_minor: 26000, eta_mins: 50, weight_g: 1200 },
  // Gift Box Accra (paused)
  { item_id: "gx-birthday-box", name: "Birthday Surprise Box", vendor_id: "v-gift-box", scope: "groceries", category_ids: ["gifts"], price_minor: 30000, eta_mins: 40, weight_g: 1500 },
  { item_id: "gx-kente-set", name: "Kente Accessories Gift Set", vendor_id: "v-gift-box", scope: "groceries", category_ids: ["gifts"], price_minor: 42000, eta_mins: 40, weight_g: 900 },
  { item_id: "gx-cookie-hamper", name: "Chocolate & Cookies Hamper", vendor_id: "v-gift-box", scope: "groceries", category_ids: ["gifts"], price_minor: 27000, eta_mins: 40, weight_g: 1800 },
  { item_id: "gx-teddy-bear", name: "Teddy Bear (medium)", vendor_id: "v-gift-box", scope: "groceries", category_ids: ["gifts"], price_minor: 15000, eta_mins: 35, weight_g: 600 },
  { item_id: "gx-photo-frame", name: "Personalised Photo Frame", vendor_id: "v-gift-box", scope: "groceries", category_ids: ["gifts"], price_minor: 12000, eta_mins: 45, weight_g: 700 },
  // BuildRite Home & DIY
  { item_id: "br-cordless-drill", name: "Cordless Drill", vendor_id: "v-buildrite", scope: "groceries", category_ids: ["home-diy"], price_minor: 65000, eta_mins: 45, weight_g: 1600 },
  { item_id: "br-claw-hammer", name: "Claw Hammer", vendor_id: "v-buildrite", scope: "groceries", category_ids: ["home-diy"], price_minor: 5500, eta_mins: 35, weight_g: 700 },
  { item_id: "br-measuring-tape", name: "Measuring Tape 5m", vendor_id: "v-buildrite", scope: "groceries", category_ids: ["home-diy"], price_minor: 2500, eta_mins: 35, weight_g: 250 },
  { item_id: "br-led-bulbs", name: "LED Bulbs (4 pack)", vendor_id: "v-buildrite", scope: "groceries", category_ids: ["home-diy", "household"], price_minor: 3600, eta_mins: 35, weight_g: 300 },
  { item_id: "br-paint-brushes", name: "Paint Brush Set", vendor_id: "v-buildrite", scope: "groceries", category_ids: ["home-diy"], price_minor: 3000, eta_mins: 35, weight_g: 350 },
  { item_id: "br-padlock", name: "Heavy-Duty Padlock", vendor_id: "v-buildrite", scope: "groceries", category_ids: ["home-diy"], price_minor: 4500, eta_mins: 35, weight_g: 400 },
  // Pro Sports Arena
  { item_id: "ps-football", name: "Size 5 Football", vendor_id: "v-pro-sports", scope: "groceries", category_ids: ["sports"], price_minor: 15000, eta_mins: 35, weight_g: 450 },
  { item_id: "ps-yoga-mat", name: "Non-Slip Yoga Mat", vendor_id: "v-pro-sports", scope: "groceries", category_ids: ["sports"], price_minor: 12000, eta_mins: 35, weight_g: 1000 },
  { item_id: "ps-resistance-bands", name: "Resistance Bands (set of 5)", vendor_id: "v-pro-sports", scope: "groceries", category_ids: ["sports"], price_minor: 6500, eta_mins: 35, weight_g: 400 },
  { item_id: "ps-replica-jersey", name: "Black Stars Replica Jersey", vendor_id: "v-pro-sports", scope: "groceries", category_ids: ["sports"], price_minor: 25000, eta_mins: 35, weight_g: 250 },
  { item_id: "ps-shin-guards", name: "Shin Guards", vendor_id: "v-pro-sports", scope: "groceries", category_ids: ["sports"], price_minor: 5500, eta_mins: 35, weight_g: 300 },
  { item_id: "ps-gym-gloves", name: "Gym Gloves", vendor_id: "v-pro-sports", scope: "groceries", category_ids: ["sports"], price_minor: 4800, eta_mins: 35, weight_g: 150 },
  // Unpublished: must never appear anywhere.
  { item_id: "zz-draft-item", name: "Draft Menu Item", vendor_id: "v-campus-grill", scope: "food", category_ids: ["local-dishes"], price_minor: 2000, eta_mins: 15, published: false },
];

// MOCK promo flags (no promo system yet) — display only, never priced from.
// Drive the storefront's "Popular" / "-20%" badges and its "Most popular" /
// "Special offers" sections. Replace with a real promo system before release.
const MOCK_PROMOS: Readonly<Record<string, Pick<MockItem, "popular" | "discountPercent">>> = {
  "lm-grilled-chicken-wedges": { popular: true },
  "cg-chicken-jollof": { popular: true, discountPercent: 15 },
  "fd-chicken-shawarma": { discountPercent: 20 },
  "fd-kelewele": { popular: true },
  "lm-waakye": { discountPercent: 20 },
  "lm-jollof-chicken": { popular: true },
  "dr-sobolo": { popular: true },
  "dr-mango-smoothie": { discountPercent: 10 },
  "el-earbuds": { popular: true },
  "gf-gift-hamper": { discountPercent: 20 },
  "el-power-bank": { popular: true },
  // Store-linked vendors
  "mf-waakye-special": { popular: true },
  "mf-assorted-fried-rice": { discountPercent: 15 },
  "cr-classic-churros": { popular: true },
  "cr-chocolate-dip": { discountPercent: 10 },
  "mk-whole-milk": { popular: true },
  "mk-cheddar": { discountPercent: 10 },
  "rr-goat-kebab": { popular: true },
  "gm-butter-cookies": { popular: true },
  "gm-choc-chip-cookies": { discountPercent: 15 },
  "as-mineral-water": { popular: true },
  "as-laundry-detergent": { discountPercent: 10 },
  "om-pineapple": { popular: true },
  "om-avocados": { discountPercent: 10 },
  "mp-ibuprofen": { popular: true },
  "mp-antiseptic": { discountPercent: 10 },
  "kc-cough-syrup": { popular: true },
  "kc-multivitamins": { discountPercent: 15 },
  "gb-shea-butter": { popular: true },
  "gb-sunscreen": { discountPercent: 20 },
  "ci-bt-speaker": { popular: true },
  "ci-wireless-mouse": { discountPercent: 10 },
  "gc-smart-watch": { popular: true },
  "gc-car-charger": { discountPercent: 15 },
  "pc-red-roses": { popular: true },
  "pc-lily-bouquet": { discountPercent: 10 },
  "gx-birthday-box": { popular: true },
  "gx-teddy-bear": { discountPercent: 15 },
  "br-cordless-drill": { popular: true },
  "br-led-bulbs": { discountPercent: 10 },
  "ps-football": { popular: true },
  "ps-resistance-bands": { discountPercent: 15 },
};

export const ITEMS: MockItem[] = SEEDS.map((s) => ({
  stock: 20,
  disabled: false,
  weight_g: 500,
  published: true,
  ...s,
  ...MOCK_PROMOS[s.item_id],
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
