/// <reference types="jest" />
import type { Category, MockItem } from "../../discovery/types";
import {
  buildStorefrontSections,
  filterMenuItems,
  OFFERS_SECTION_ID,
  POPULAR_SECTION_ID,
} from "../storefrontSections";

const categories: Category[] = [
  { id: "local-dishes", label: "Local dishes", scope: "food", icon: "localDishes" },
  { id: "snacks", label: "Snacks", scope: "food", icon: "snacks" },
];

function item(id: string, overrides: Partial<MockItem> = {}): MockItem {
  return {
    item_id: id,
    name: id,
    vendor_id: "v-test",
    scope: "food",
    category_ids: ["local-dishes"],
    price_minor: 1000,
    stock: 10,
    disabled: false,
    weight_g: 500,
    published: true,
    eta_mins: 10,
    ...overrides,
  };
}

describe("buildStorefrontSections", () => {
  const items = [
    item("a", { popular: true }),
    item("b", { category_ids: ["snacks"], discountPercent: 20 }),
    item("c", { category_ids: ["snacks"] }),
  ];

  test("featured sections first, then uppercase categories", () => {
    const sections = buildStorefrontSections(items, categories, { includeFeatured: true });
    expect(sections.map((s) => [s.id, s.title])).toEqual([
      [POPULAR_SECTION_ID, "Most popular"],
      [OFFERS_SECTION_ID, "Special offers"],
      ["local-dishes", "LOCAL DISHES"],
      ["snacks", "SNACKS"],
    ]);
  });

  test("items can appear in a featured and a category section", () => {
    const sections = buildStorefrontSections(items, categories, { includeFeatured: true });
    const ids = sections.flatMap((s) => s.data.map((i) => i.item_id));
    expect(ids.filter((id) => id === "a")).toHaveLength(2);
  });

  test("empty featured sections are omitted", () => {
    const sections = buildStorefrontSections([item("x")], categories, { includeFeatured: true });
    expect(sections.map((s) => s.id)).toEqual(["local-dishes"]);
  });

  test("includeFeatured:false drops featured sections", () => {
    const sections = buildStorefrontSections(items, categories, { includeFeatured: false });
    expect(sections.map((s) => s.id)).toEqual(["local-dishes", "snacks"]);
  });

  test("no items -> []", () => {
    expect(buildStorefrontSections([], categories, { includeFeatured: true })).toEqual([]);
  });
});

describe("filterMenuItems", () => {
  const items = [
    item("jr", { name: "Jollof Rice & Chicken" }),
    item("kw", { name: "Spicy Kelewele" }),
    item("bk", { name: "Banku & Okro", aliases: ["Jollof special"] }),
    item("cafe", { name: "Café Latte" }),
  ];

  test("blank query returns all", () => {
    expect(filterMenuItems(items, "  ")).toBe(items);
  });

  test("matches names and aliases", () => {
    expect(filterMenuItems(items, "jollof").map((i) => i.item_id)).toEqual(["jr", "bk"]);
  });

  test("case- and diacritics-insensitive", () => {
    expect(filterMenuItems(items, "KELE").map((i) => i.item_id)).toEqual(["kw"]);
    expect(filterMenuItems(items, "cafe").map((i) => i.item_id)).toEqual(["cafe"]);
  });

  test("no match -> []", () => {
    expect(filterMenuItems(items, "pizza")).toEqual([]);
  });
});
