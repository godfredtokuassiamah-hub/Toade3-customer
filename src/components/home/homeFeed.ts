// Typed rows of the virtualized Home feed. Built once from the static
// catalog; the section/banner/place objects are passed through by reference.
import type { Banner, HomeData, HomeSection, PopularPlace } from "../../data/mock/home";

export type HomeFeedItem =
  | { key: "search"; type: "search" }
  | { key: string; type: "banner"; banner: Banner }
  | { key: string; type: "foodSection"; section: HomeSection }
  | { key: "popular-places"; type: "popularPlaces"; places: PopularPlace[] };

// Same visual order as the original ScrollView blocks.
export function buildHomeFeed(data: HomeData): HomeFeedItem[] {
  const { banners, sections, popularPlaces } = data;
  return [
    { key: "search", type: "search" },
    { key: banners.top.id, type: "banner", banner: banners.top },
    { key: sections.localMeals.id, type: "foodSection", section: sections.localMeals },
    { key: "popular-places", type: "popularPlaces", places: popularPlaces },
    { key: sections.drinks.id, type: "foodSection", section: sections.drinks },
    { key: banners.middle.id, type: "banner", banner: banners.middle },
    { key: sections.bakery.id, type: "foodSection", section: sections.bakery },
  ];
}
