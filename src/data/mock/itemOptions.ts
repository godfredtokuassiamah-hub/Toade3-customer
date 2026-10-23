// TODO(catalog): mock item option groups, compare-at prices and
// descriptions until the vendor app supplies real menus. Prices are integer
// pesewas. Read by the item detail sheet (src/components/item).
//
// Rules (getOptionGroups):
// - Drinks (id "dr-*" or category "drinks"): required "Size" (single) and
//   optional "Ice" (single).
// - Bakery / desserts (id "bk-*" or category "bread-bakery"): optional
//   "Add-ons" (up to 3).
// - Other food (local dishes, rice meals, snacks): required "Choose your
//   protein" (single), optional "Drink addition" (up to 2) and optional
//   "Extras" (up to 3).
// - Everything else (gifts, sports, gadgets, pharmacy, ...): no groups.

export type OptionItem = { id: string; label: string; priceMinor: number };

export type OptionGroup = {
  id: string;
  title: string;
  required: boolean;
  // Selection count bounds. max === 1 renders radios, otherwise checkboxes.
  min: number;
  max: number;
  options: OptionItem[];
};

const PROTEIN: OptionGroup = {
  id: "protein",
  title: "Choose your protein",
  required: true,
  min: 1,
  max: 1,
  options: [
    { id: "protein-chicken", label: "Chicken", priceMinor: 0 },
    { id: "protein-beef", label: "Beef", priceMinor: 500 },
    { id: "protein-fish", label: "Fish", priceMinor: 800 },
  ],
};

const DRINK_ADDITION: OptionGroup = {
  id: "drink-addition",
  title: "Drink addition",
  required: false,
  min: 0,
  max: 2,
  options: [
    { id: "drink-sprite", label: "Sprite 450ml", priceMinor: 1760 },
    { id: "drink-coke", label: "Coca-Cola 500ml", priceMinor: 1500 },
    { id: "drink-water", label: "Water 500ml", priceMinor: 500 },
  ],
};

const EXTRAS: OptionGroup = {
  id: "extras",
  title: "Extras",
  required: false,
  min: 0,
  max: 3,
  options: [
    { id: "extra-sauce", label: "Extra sauce", priceMinor: 300 },
    { id: "extra-shito", label: "Extra shito", priceMinor: 400 },
    { id: "extra-coleslaw", label: "Coleslaw", priceMinor: 600 },
  ],
};

const SIZE: OptionGroup = {
  id: "size",
  title: "Size",
  required: true,
  min: 1,
  max: 1,
  options: [
    { id: "size-regular", label: "Regular", priceMinor: 0 },
    { id: "size-large", label: "Large", priceMinor: 600 },
  ],
};

const ICE: OptionGroup = {
  id: "ice",
  title: "Ice",
  required: false,
  min: 0,
  max: 1,
  options: [
    { id: "ice-none", label: "No ice", priceMinor: 0 },
    { id: "ice-less", label: "Less ice", priceMinor: 0 },
  ],
};

const BAKERY_ADDONS: OptionGroup = {
  id: "addons",
  title: "Add-ons",
  required: false,
  min: 0,
  max: 3,
  options: [
    { id: "addon-cream", label: "Extra cream", priceMinor: 400 },
    { id: "addon-chocolate", label: "Chocolate drizzle", priceMinor: 300 },
    { id: "addon-gift-box", label: "Gift box", priceMinor: 500 },
  ],
};

const FOOD_CATEGORIES = new Set(["local-dishes", "rice-meals", "snacks"]);

type Kind = "drink" | "bakery" | "food" | "other";

function kindOf(itemId: string, categoryIds: readonly string[]): Kind {
  if (itemId.startsWith("dr-") || categoryIds.includes("drinks")) return "drink";
  if (itemId.startsWith("bk-") || categoryIds.includes("bread-bakery")) return "bakery";
  if (categoryIds.some((c) => FOOD_CATEGORIES.has(c))) return "food";
  return "other";
}

export function getOptionGroups(itemId: string, categoryIds: readonly string[]): OptionGroup[] {
  switch (kindOf(itemId, categoryIds)) {
    case "drink":
      return [SIZE, ICE];
    case "bakery":
      return [BAKERY_ADDONS];
    case "food":
      return [PROTEIN, DRINK_ADDITION, EXTRAS];
    default:
      return [];
  }
}

// Compare-at ("was") prices, pesewas. Only shown when above the price.
const COMPARE_AT: Record<string, number> = {
  "lm-jollof-chicken": 4500,
  "dr-sobolo": 1300,
  "bk-chocolate-cake": 4200,
};

export function getCompareAtMinor(itemId: string, priceMinor: number): number | null {
  const was = COMPARE_AT[itemId];
  return was != null && was > priceMinor ? was : null;
}

const DESCRIPTIONS: Record<string, string> = {
  "lm-grilled-chicken-wedges": "Flame-grilled chicken quarter with crispy potato wedges and a side of pepper sauce.",
  "lm-beef-veggie-rice": "Tender beef strips stir-fried with seasonal vegetables over fluffy rice.",
  "lm-jollof-chicken": "Smoky party jollof cooked in a rich tomato base, served with grilled chicken.",
  "lm-waakye": "Golden yam chips with crispy fried chicken and a spicy pepper dip.",
  "lm-banku-tilapia": "Freshly made banku with a hearty okro stew.",
  "lm-fried-rice-chicken": "Vegetable fried rice with fried chicken and fresh coleslaw.",
  "dr-sobolo": "Chilled hibiscus drink brewed with ginger, cloves and pineapple.",
  "dr-mango-smoothie": "Fresh strawberries blended with coconut milk.",
  "bk-chocolate-cake": "Light sponge rolled with fresh cream and strawberries.",
  "fd-chicken-shawarma": "Grilled chicken, veggies and garlic sauce wrapped in warm pita.",
};

const KIND_FALLBACK: Record<Kind, string> = {
  food: "Freshly prepared by the kitchen when you order.",
  drink: "Served chilled.",
  bakery: "Baked fresh every day.",
  other: "Sold and delivered by the store.",
};

export function getItemDescription(itemId: string, categoryIds: readonly string[]): string {
  return DESCRIPTIONS[itemId] ?? KIND_FALLBACK[kindOf(itemId, categoryIds)];
}
