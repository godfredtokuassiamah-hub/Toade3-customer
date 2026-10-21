// Pure menu grouping for the vendor storefront. Buckets items by their first
// category (category_ids[0]) into SectionList sections, labelled from the
// catalog taxonomy and kept in taxonomy order. Items whose category is
// unknown or absent fall into a trailing "More" section (defensive; current
// data always maps). Empty buckets are dropped.
import type { Category, MockItem } from "./types";

export type MenuSection = {
  id: string;
  title: string;
  data: MockItem[];
};

const MORE_ID = "more";
const MORE_TITLE = "More";

export function groupItemsByCategory(
  items: MockItem[],
  categories: Category[],
): MenuSection[] {
  const labelById = new Map(categories.map((c) => [c.id, c.label]));
  const buckets = new Map<string, MockItem[]>();
  const more: MockItem[] = [];

  for (const item of items) {
    const categoryId = item.category_ids[0];
    if (categoryId != null && labelById.has(categoryId)) {
      const bucket = buckets.get(categoryId);
      if (bucket) bucket.push(item);
      else buckets.set(categoryId, [item]);
    } else {
      more.push(item);
    }
  }

  // Emit in catalog taxonomy order, skipping empty buckets.
  const sections: MenuSection[] = [];
  for (const category of categories) {
    const data = buckets.get(category.id);
    if (data && data.length > 0) {
      sections.push({ id: category.id, title: category.label, data });
    }
  }
  if (more.length > 0) {
    sections.push({ id: MORE_ID, title: MORE_TITLE, data: more });
  }
  return sections;
}
