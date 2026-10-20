// Typed rows of the virtualized Home feed. The static feed is built once
// from the mock home data; the filtered feed from a discovery response.
import type { StateKind } from "../../lib/discovery/filterState";
import type { DiscoveryModule, DiscoveryQueryResponse } from "../../lib/discovery/types";
import type { Banner, HomeData, HomeSection, PopularPlace } from "../../data/mock/home";

export type HomeFeedItem =
  | { key: "search"; type: "search" }
  | { key: "categories"; type: "categories" }
  | { key: string; type: "banner"; banner: Banner }
  | { key: string; type: "foodSection"; section: HomeSection }
  | { key: "popular-places"; type: "popularPlaces"; places: PopularPlace[] };

// Same visual order as the original ScrollView blocks.
export function buildHomeFeed(data: HomeData): HomeFeedItem[] {
  const { banners, sections, popularPlaces } = data;
  return [
    { key: "search", type: "search" },
    // Category-shortcut grid, only on the static (unfiltered) Home feed.
    { key: "categories", type: "categories" },
    { key: banners.top.id, type: "banner", banner: banners.top },
    { key: sections.localMeals.id, type: "foodSection", section: sections.localMeals },
    { key: "popular-places", type: "popularPlaces", places: popularPlaces },
    { key: sections.drinks.id, type: "foodSection", section: sections.drinks },
    { key: banners.middle.id, type: "banner", banner: banners.middle },
    { key: sections.bakery.id, type: "foodSection", section: sections.bakery },
  ];
}

export type FilteredFeedItem =
  | { key: "search"; type: "search" }
  | { key: "chips"; type: "chips" }
  | { key: "loading"; type: "loading" }
  | { key: "state"; type: "state"; kind: StateKind }
  | { key: string; type: "module"; module: DiscoveryModule };

// Server modules in order; empty modules hidden; one classified empty state
// when nothing matches.
export function buildFilteredFeed(
  response: DiscoveryQueryResponse | null,
  loading: boolean,
  error: boolean,
): FilteredFeedItem[] {
  const head: FilteredFeedItem[] = [
    { key: "search", type: "search" },
    { key: "chips", type: "chips" },
  ];
  if (error) return [...head, { key: "state", type: "state", kind: "offline" }];
  if (loading || !response) return [...head, { key: "loading", type: "loading" }];
  const modules = (response.modules ?? []).filter((m) =>
    m.type === "items" ? m.items.length > 0 : m.vendors.length > 0,
  );
  if (response.item_count === 0 || modules.length === 0) {
    return [...head, { key: "state", type: "state", kind: response.empty_reason ?? "filters_exclude" }];
  }
  return [...head, ...modules.map((m) => ({ key: m.id, type: "module" as const, module: m }))];
}
