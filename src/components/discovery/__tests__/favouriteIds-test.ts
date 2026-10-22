// The heart on a card saves FoodCardItem.id; Favourites resolves ids with
// getItemsByIds (catalog item_id). They must be the same id space.
import { getItemsByIds, ITEMS } from "../../../data/mock/catalog";
import { homeData } from "../../../data/mock/home";
import { catalogItemToFoodCardItem, toFoodCardItem } from "../cardItem";

describe("favourite id mapping", () => {
  it("every Home card id resolves to a catalog item", () => {
    const { localMeals, drinks, bakery } = homeData.sections;
    const ids = [...localMeals.items, ...drinks.items, ...bakery.items].map((i) => i.id);
    const resolved = getItemsByIds(ids).map((i) => i.item_id);
    expect(resolved).toEqual(ids);
  });

  it("catalog and discovery cards use item_id as the card id", () => {
    const item = ITEMS[0];
    expect(catalogItemToFoodCardItem(item).id).toBe(item.item_id);
    expect(
      toFoodCardItem({
        item_id: item.item_id,
        name: item.name,
        vendor_name: "x",
        eta_mins: 10,
        price_minor: 100,
        status: "available",
      } as Parameters<typeof toFoodCardItem>[0]).id,
    ).toBe(item.item_id);
  });

  it("round-trips: hearted ids come back as the same cards", () => {
    const ids = ["lm-waakye", "dr-sobolo"];
    expect(getItemsByIds(ids).map(catalogItemToFoodCardItem).map((c) => c.id)).toEqual(ids);
  });
});
