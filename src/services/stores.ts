// Stores directory (Stores tab, Map tab, stores-list, Home Popular Places).
// Supabase `vendors` rows with listed = true (supabase/migrations/0004), or
// the local mock directory per BACKEND_MODE (src/lib/backend/fallback.ts).
//
// DTOs are plain JSON (they're persisted by the query cache); logos are
// local bundled assets attached by legacy id at read time (withStoreArt),
// because require() asset ids aren't stable across builds.
import { type Store, type StoreCategory, STORES, isStoreCategory } from "../data/mock/stores";
import { backend, unwrap } from "../lib/backend/runner";
import { supabase } from "../lib/supabase";

export type StoreDTO = Omit<Store, "logo" | "cover">;

type VendorRow = {
  id: string;
  legacy_id: string | null;
  name: string;
  category: string | null;
  lat: number;
  lng: number;
  prep_min: number;
  prep_max: number;
  is_open: boolean;
  menu: { id: string; legacy_id: string | null } | null;
};

const STORE_COLUMNS =
  "id, legacy_id, name, category, lat, lng, prep_min, prep_max, is_open, menu:menu_vendor_id(id, legacy_id)";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Column + value to look a row up by app id (legacy id) or uuid.
export function refColumn(id: string): "id" | "legacy_id" {
  return UUID.test(id) ? "id" : "legacy_id";
}

function toStoreDTO(row: VendorRow): StoreDTO {
  const category: StoreCategory = isStoreCategory(row.category) ? row.category : "groceries";
  const vendorId = row.menu ? (row.menu.legacy_id ?? row.menu.id) : undefined;
  return {
    id: row.legacy_id ?? row.id,
    name: row.name,
    category,
    latitude: row.lat,
    longitude: row.lng,
    prepMins: [row.prep_min, row.prep_max],
    open: row.is_open,
    ...(vendorId ? { vendorId } : null),
  };
}

function stripArt(store: Store): StoreDTO {
  const { logo: _logo, cover: _cover, ...rest } = store;
  return rest;
}

// Mock directory as DTOs (also the hooks' placeholder data).
export const MOCK_STORE_DTOS: readonly StoreDTO[] = STORES.map(stripArt);

const ART = new Map(STORES.map((s) => [s.id, { logo: s.logo, cover: s.cover }]));

// Re-attaches local logos / covers by store id.
export function withStoreArt(stores: readonly StoreDTO[]): Store[] {
  return stores.map((s) => {
    const art = ART.get(s.id);
    return art ? { ...s, ...art } : { ...s };
  });
}

export function listStores(): Promise<StoreDTO[]> {
  return backend.run({
    resource: "stores",
    op: "read",
    remote: async () => {
      const res = await supabase
        .from("vendors")
        .select(STORE_COLUMNS)
        .eq("listed", true)
        .order("name");
      return unwrap(res as { data: VendorRow[] | null; error: unknown; status: number }).map(
        toStoreDTO,
      );
    },
    mock: () => [...MOCK_STORE_DTOS],
  });
}

export function getStore(id: string): Promise<StoreDTO | null> {
  return backend.run({
    resource: "stores",
    op: "read",
    remote: async () => {
      const res = await supabase
        .from("vendors")
        .select(STORE_COLUMNS)
        .eq("listed", true)
        .eq(refColumn(id), id)
        .maybeSingle();
      if (res.error) unwrap(res as { data: null; error: unknown; status: number });
      const row = res.data as VendorRow | null;
      return row ? toStoreDTO(row) : null;
    },
    mock: () => MOCK_STORE_DTOS.find((s) => s.id === id) ?? null,
  });
}
