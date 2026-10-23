// Catalog reads: products (with option groups), per-vendor / per-category
// lists, and the discovery snapshot. Supabase tables from
// supabase/migrations/0004 (public read of published rows), or the local
// mock catalog per BACKEND_MODE (src/lib/backend/fallback.ts).
//
// Ids are the app's ids (legacy_id), so carts / favourites match in every
// mode. DTOs are plain JSON (persisted by the query cache); images are
// attached at read time via resolveFoodImage (the dummy mapping until the
// vendor app uploads real photos).
import {
  CATEGORIES,
  getItemsByIds,
  ITEMS,
  SUGGESTION_TERMS,
  VENDORS,
} from "../data/mock/catalog";
import {
  getCompareAtMinor,
  getItemDescription,
  getOptionGroups,
  type OptionGroup,
} from "../data/mock/itemOptions";
import { backend, unwrap } from "../lib/backend/runner";
import type {
  CatalogScope,
  Category,
  CategoryIcon,
  MockCatalog,
  MockItem,
  MockVendor,
} from "../lib/discovery/types";
import { supabase } from "../lib/supabase";
import { resolveFoodImage } from "./foodImageSource";
import { refColumn } from "./stores";

export type ProductDTO = {
  id: string;
  vendorId: string;
  vendorName: string;
  name: string;
  aliases: string[];
  scope: CatalogScope;
  categoryIds: string[];
  priceMinor: number;
  compareAtMinor: number | null;
  weightG: number | null;
  stock: number;
  disabled: boolean;
  published: boolean;
  etaMins: number;
  description: string;
  optionGroups: OptionGroup[];
  imagePath: string | null;
  popular: boolean;
  discountPercent: number | null;
};

export type ProductFilter = { vendorId?: string | null; categoryId?: string | null };

// ---- Mock ----

const VENDOR_NAME = new Map(VENDORS.map((v) => [v.vendor_id, v.name]));

function mockProduct(item: MockItem): ProductDTO {
  return {
    id: item.item_id,
    vendorId: item.vendor_id,
    vendorName: VENDOR_NAME.get(item.vendor_id) ?? "",
    name: item.name,
    aliases: item.aliases ?? [],
    scope: item.scope,
    categoryIds: item.category_ids,
    priceMinor: item.price_minor,
    compareAtMinor: getCompareAtMinor(item.item_id, item.price_minor),
    weightG: item.weight_g,
    stock: item.stock,
    disabled: item.disabled,
    published: item.published,
    etaMins: item.eta_mins,
    description: getItemDescription(item.item_id, item.category_ids),
    optionGroups: getOptionGroups(item.item_id, item.category_ids),
    imagePath: null,
    popular: item.popular === true,
    discountPercent: item.discountPercent ?? null,
  };
}

// Synchronous mock product (the hooks' placeholder); null when unknown or
// unpublished.
// Cached so the placeholder keeps one identity per id across renders.
const mockProductCache = new Map<string, ProductDTO | null>();

export function getMockProduct(id: string): ProductDTO | null {
  let cached = mockProductCache.get(id);
  if (cached === undefined) {
    const item = getItemsByIds([id])[0];
    cached = item ? mockProduct(item) : null;
    mockProductCache.set(id, cached);
  }
  return cached;
}

export function listMockProducts(filter: ProductFilter): ProductDTO[] {
  return ITEMS.filter(
    (i) =>
      i.published &&
      !i.disabled &&
      (!filter.vendorId || i.vendor_id === filter.vendorId) &&
      (!filter.categoryId || i.category_ids.includes(filter.categoryId)),
  ).map(mockProduct);
}

// ---- Remote ----

type OptionRow = { legacy_id: string; label: string; price_minor: number; sort: number };
type GroupRow = {
  legacy_id: string;
  title: string;
  required: boolean;
  min_select: number;
  max_select: number;
  sort: number;
  options: OptionRow[] | null;
};
type ProductRow = {
  id: string;
  legacy_id: string | null;
  name: string;
  aliases: string[] | null;
  description: string | null;
  scope: CatalogScope;
  price_minor: number;
  compare_at_minor: number | null;
  weight_g: number | null;
  stock: number;
  disabled: boolean;
  published: boolean;
  eta_mins: number;
  popular: boolean;
  discount_percent: number | null;
  image_path: string | null;
  vendor: { id: string; legacy_id: string | null; name: string } | null;
  cats: { category_id: string }[] | null;
  option_groups?: GroupRow[] | null;
};

const PRODUCT_COLUMNS =
  "id, legacy_id, name, aliases, description, scope, price_minor, compare_at_minor, weight_g, stock, disabled, published, eta_mins, popular, discount_percent, image_path, vendor:vendor_id(id, legacy_id, name), cats:product_categories(category_id)";
const GROUP_COLUMNS =
  "option_groups(legacy_id, title, required, min_select, max_select, sort, options(legacy_id, label, price_minor, sort))";

const bySort = (a: { sort: number }, b: { sort: number }) => a.sort - b.sort;

function toGroups(rows: GroupRow[] | null | undefined): OptionGroup[] {
  return [...(rows ?? [])].sort(bySort).map((g) => ({
    id: g.legacy_id,
    title: g.title,
    required: g.required,
    min: g.min_select,
    max: g.max_select,
    options: [...(g.options ?? [])].sort(bySort).map((o) => ({
      id: o.legacy_id,
      label: o.label,
      priceMinor: o.price_minor,
    })),
  }));
}

function toProduct(row: ProductRow): ProductDTO {
  const id = row.legacy_id ?? row.id;
  const categoryIds = (row.cats ?? []).map((c) => c.category_id).sort();
  return {
    id,
    vendorId: row.vendor ? (row.vendor.legacy_id ?? row.vendor.id) : "",
    vendorName: row.vendor?.name ?? "",
    name: row.name,
    aliases: row.aliases ?? [],
    scope: row.scope,
    categoryIds,
    priceMinor: row.price_minor,
    compareAtMinor:
      row.compare_at_minor != null && row.compare_at_minor > row.price_minor
        ? row.compare_at_minor
        : null,
    weightG: row.weight_g,
    stock: row.stock,
    disabled: row.disabled,
    published: row.published,
    etaMins: row.eta_mins,
    description: row.description ?? getItemDescription(id, categoryIds),
    optionGroups: toGroups(row.option_groups),
    imagePath: row.image_path,
    popular: row.popular,
    discountPercent: row.discount_percent,
  };
}

type Res<T> = { data: T | null; error: unknown; status: number };

export function listProducts(filter: ProductFilter = {}): Promise<ProductDTO[]> {
  return backend.run({
    resource: "catalog",
    op: "read",
    remote: async () => {
      // !inner embeds turn the vendor / category filters into joins; `cats`
      // stays the full category list.
      let columns = PRODUCT_COLUMNS;
      if (filter.vendorId) columns += ", vf:vendor_id!inner(legacy_id)";
      if (filter.categoryId) columns += ", cf:product_categories!inner(category_id)";
      let query = supabase.from("products").select(columns).eq("disabled", false);
      if (filter.vendorId) query = query.eq("vf.legacy_id", filter.vendorId);
      if (filter.categoryId) query = query.eq("cf.category_id", filter.categoryId);
      const res = await query.order("price_minor").order("id");
      return unwrap(res as unknown as Res<ProductRow[]>).map(toProduct);
    },
    mock: () => listMockProducts(filter),
  });
}

export function getProduct(id: string): Promise<ProductDTO | null> {
  return backend.run({
    resource: "catalog",
    op: "read",
    remote: async () => {
      const res = await supabase
        .from("products")
        .select(`${PRODUCT_COLUMNS}, ${GROUP_COLUMNS}`)
        .eq(refColumn(id), id)
        .maybeSingle();
      if (res.error) unwrap(res as unknown as Res<null>);
      const row = res.data as unknown as ProductRow | null;
      return row ? toProduct(row) : null;
    },
    mock: () => getMockProduct(id),
  });
}

export function productImage(product: Pick<ProductDTO, "id" | "imagePath">) {
  return resolveFoodImage(product.id, product.imagePath ?? undefined);
}

// ---- Discovery snapshot ----
// The discovery oracle (facets, counts, ranking) keeps running on the
// client; in remote / auto mode it reads this snapshot of the database
// catalog instead of the bundled mock (src/services/discovery.ts).

type CategoryRow = { id: string; label: string; scope: CatalogScope; icon: string | null; sort: number };
type CatalogVendorRow = {
  id: string;
  legacy_id: string | null;
  name: string;
  opening_hours: { open: string; close: string } | null;
  paused: boolean;
  updated_at: string;
};

const LOCAL_ICON = new Map(CATEGORIES.map((c) => [c.id, c.icon]));
const LOCAL_RATING = new Map(VENDORS.map((v) => [v.vendor_id, v.rating]));

// Discovery items without images (the snapshot is persisted); attach them
// with withItemImages.
export type DiscoverySnapshot = MockCatalog;

function snapshotFromMock(): DiscoverySnapshot {
  return {
    revision: 1,
    categories: CATEGORIES,
    vendors: VENDORS,
    items: ITEMS.map(({ image: _image, ...rest }) => rest),
    suggestion_terms: SUGGESTION_TERMS,
  };
}

export function withItemImages(catalog: DiscoverySnapshot): MockCatalog {
  return {
    ...catalog,
    items: catalog.items.map((i) => ({ ...i, image: resolveFoodImage(i.item_id) })),
  };
}

export function fetchDiscoveryCatalog(): Promise<DiscoverySnapshot> {
  return backend.run({
    resource: "catalog",
    op: "read",
    remote: async () => {
      const [cats, vendors, products] = await Promise.all([
        supabase.from("categories").select("id, label, scope, icon, sort").order("sort"),
        supabase
          .from("vendors")
          .select("id, legacy_id, name, opening_hours, paused, updated_at")
          .eq("listed", false),
        supabase.from("products").select(PRODUCT_COLUMNS),
      ]);
      const categoryRows = unwrap(cats as unknown as Res<CategoryRow[]>);
      const vendorRows = unwrap(vendors as unknown as Res<CatalogVendorRow[]>);
      const productRows = unwrap(products as unknown as Res<ProductRow[]>);

      const categories: Category[] = categoryRows.map((c) => ({
        id: c.id,
        label: c.label,
        scope: c.scope,
        icon: (c.icon as CategoryIcon | null) ?? LOCAL_ICON.get(c.id) ?? "snacks",
      }));
      const mockVendors: MockVendor[] = vendorRows.map((v) => {
        const id = v.legacy_id ?? v.id;
        const rating = LOCAL_RATING.get(id);
        return {
          vendor_id: id,
          name: v.name,
          // null hours = always open.
          hours: v.opening_hours ?? { open: "00:00", close: "24:00" },
          paused: v.paused,
          ...(rating ? { rating } : null),
        };
      });
      const items: MockItem[] = productRows.map((r) => {
        const p = toProduct(r);
        return {
          item_id: p.id,
          name: p.name,
          aliases: p.aliases,
          vendor_id: p.vendorId,
          scope: p.scope,
          category_ids: p.categoryIds,
          price_minor: p.priceMinor,
          stock: p.stock,
          disabled: p.disabled,
          weight_g: p.weightG,
          published: p.published,
          eta_mins: p.etaMins,
          ...(p.popular ? { popular: true } : null),
          ...(p.discountPercent != null ? { discountPercent: p.discountPercent } : null),
        };
      });
      // Revision: newest vendor change, in seconds (cursor staleness only).
      const newest = vendorRows.reduce((m, v) => Math.max(m, Date.parse(v.updated_at) || 0), 0);
      return {
        revision: Math.max(1, Math.floor(newest / 1000)),
        categories,
        vendors: mockVendors,
        items,
        suggestion_terms: SUGGESTION_TERMS,
      };
    },
    mock: snapshotFromMock,
  });
}
