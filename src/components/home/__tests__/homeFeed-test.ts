// TypeScript 6 no longer auto-includes @types/*, so pull in jest globals here.
/// <reference types="jest" />
import { homeData } from "../../../data/mock/home";
import { buildHomeFeed } from "../homeFeed";

describe("buildHomeFeed", () => {
  const feed = buildHomeFeed(homeData);

  test("returns the 7 rows in visual order", () => {
    expect(feed.map((row) => [row.type, row.key])).toEqual([
      ["search", "search"],
      ["banner", "banner-vegetables"],
      ["foodSection", "local-meals"],
      ["popularPlaces", "popular-places"],
      ["foodSection", "drinks"],
      ["banner", "banner-big-sale"],
      ["foodSection", "bakery-desserts"],
    ]);
  });

  test("keys are unique", () => {
    const keys = feed.map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("rows reference the catalog objects without copying", () => {
    const { banners, sections, popularPlaces } = homeData;
    const [, top, localMeals, places, drinks, middle, bakery] = feed;
    expect(top.type === "banner" && top.banner).toBe(banners.top);
    expect(middle.type === "banner" && middle.banner).toBe(banners.middle);
    expect(localMeals.type === "foodSection" && localMeals.section).toBe(
      sections.localMeals,
    );
    expect(drinks.type === "foodSection" && drinks.section).toBe(sections.drinks);
    expect(bakery.type === "foodSection" && bakery.section).toBe(sections.bakery);
    expect(places.type === "popularPlaces" && places.places).toBe(popularPlaces);
  });
});
