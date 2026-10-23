// Pure section building + local search for the vendor storefront (no
// react-native imports, unit-tested). Reuses groupItemsByCategory.
import { groupItemsByCategory } from "../discovery/menuSections";
import { normalizeText } from "../discovery/normalize";
import type { Category, MockItem } from "../discovery/types";

export type StorefrontSection = { id: string; title: string; data: MockItem[] };

export const POPULAR_SECTION_ID = "popular";
export const OFFERS_SECTION_ID = "offers";

// "Most popular" (MOCK popular flag) and "Special offers" (MOCK discount)
// first when includeFeatured, then one UPPERCASE section per category. Empty
// featured sections are omitted. An item may appear in a featured section
// and its category section, so row keys must include the section id.
export function buildStorefrontSections(
  items: MockItem[],
  categories: Category[],
  options: { includeFeatured: boolean },
): StorefrontSection[] {
  const sections: StorefrontSection[] = [];
  if (options.includeFeatured) {
    const popular = items.filter((i) => i.popular === true);
    const offers = items.filter((i) => i.discountPercent != null && i.discountPercent > 0);
    if (popular.length > 0) {
      sections.push({ id: POPULAR_SECTION_ID, title: "Most popular", data: popular });
    }
    if (offers.length > 0) {
      sections.push({ id: OFFERS_SECTION_ID, title: "Special offers", data: offers });
    }
  }
  for (const s of groupItemsByCategory(items, categories)) {
    sections.push({ id: s.id, title: s.title.toUpperCase(), data: s.data });
  }
  return sections;
}

// Local, no-network menu filter: the normalized query (case/diacritics/
// punctuation-insensitive) must be a substring of the normalized name or of
// any alias. Blank query -> every item.
export function filterMenuItems(items: MockItem[], query: string): MockItem[] {
  const q = normalizeText(query);
  if (q === "") return items;
  return items.filter(
    (item) =>
      normalizeText(item.name).includes(q) ||
      (item.aliases ?? []).some((alias) => normalizeText(alias).includes(q)),
  );
}
