/// <reference types="jest" />
import { groupItemsByCategory } from "../menuSections";
import type { Category, MockItem } from "../types";

const categories: Category[] = [
  { id: "local-dishes", label: "Local dishes", scope: "food", icon: "localDishes" },
  { id: "rice-meals", label: "Rice meals", scope: "food", icon: "riceMeals" },
  { id: "drinks", label: "Drinks", scope: "food", icon: "drinks" },
];

function item(id: string, categoryIds: string[]): MockItem {
  return {
    item_id: id,
    name: id,
    vendor_id: "v-test",
    scope: "food",
    category_ids: categoryIds,
    price_minor: 1000,
    stock: 10,
    disabled: false,
    weight_g: 500,
    published: true,
    eta_mins: 10,
  };
}

describe("groupItemsByCategory", () => {
  it("yields ordered sections with catalog labels", () => {
    const sections = groupItemsByCategory(
      [item("a", ["drinks"]), item("b", ["local-dishes"]), item("c", ["rice-meals"])],
      categories,
    );
    expect(sections.map((s) => s.id)).toEqual(["local-dishes", "rice-meals", "drinks"]);
    expect(sections.map((s) => s.title)).toEqual(["Local dishes", "Rice meals", "Drinks"]);
  });

  it("groups an all-one-category vendor into a single section", () => {
    const sections = groupItemsByCategory(
      [item("a", ["drinks"]), item("b", ["drinks"])],
      categories,
    );
    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBe("drinks");
    expect(sections[0].data.map((i) => i.item_id)).toEqual(["a", "b"]);
  });

  it("buckets by the first category id", () => {
    const sections = groupItemsByCategory([item("a", ["rice-meals", "local-dishes"])], categories);
    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBe("rice-meals");
  });

  it("places unknown/absent categories into a trailing More section", () => {
    const sections = groupItemsByCategory(
      [item("a", ["drinks"]), item("b", ["mystery"]), item("c", [])],
      categories,
    );
    expect(sections.map((s) => s.id)).toEqual(["drinks", "more"]);
    const more = sections[sections.length - 1];
    expect(more.title).toBe("More");
    expect(more.data.map((i) => i.item_id)).toEqual(["b", "c"]);
  });

  it("returns [] for empty input", () => {
    expect(groupItemsByCategory([], categories)).toEqual([]);
  });
});
