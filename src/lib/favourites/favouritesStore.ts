// Favourite item ids, persisted on device (AsyncStorage, in Expo Go).
// Pure list helpers (unit-tested) plus local persistence. The React
// context/hook that loads this once and shares it lives in
// ./FavouritesContext.tsx (same split as deliveryAddress.ts /
// DeliveryAddressContext.tsx).
//
// TODO(favourites): when real auth/profile sync exists, favourites move
// server-side (per-user) instead of a device-local set.
import AsyncStorage from "@react-native-async-storage/async-storage";

export const FAVOURITES_KEY = "toade3.favourites";

// ---- Pure helpers (list = ordered ids, most-recent-first, de-duplicated) ----

// Adds `id` to the front; no duplicates. Ignores an empty id.
export function addFavourite(list: readonly string[], id: string): string[] {
  if (id === "") return [...list];
  return [id, ...list.filter((x) => x !== id)];
}

export function removeFavourite(list: readonly string[], id: string): string[] {
  return list.filter((x) => x !== id);
}

export function isFavourite(list: readonly string[], id: string): boolean {
  return list.includes(id);
}

export function toggleFavourite(list: readonly string[], id: string): string[] {
  return isFavourite(list, id) ? removeFavourite(list, id) : addFavourite(list, id);
}

// Parses stored JSON, dropping anything malformed (and empty strings).
export function parseFavourites(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const out: string[] = [];
    for (const v of value) {
      if (typeof v === "string" && v !== "" && !out.includes(v)) out.push(v);
    }
    return out;
  } catch {
    return [];
  }
}

export async function loadFavourites(): Promise<string[]> {
  try {
    return parseFavourites(await AsyncStorage.getItem(FAVOURITES_KEY));
  } catch {
    return [];
  }
}

export async function saveFavourites(list: readonly string[]): Promise<void> {
  try {
    if (list.length === 0) await AsyncStorage.removeItem(FAVOURITES_KEY);
    else await AsyncStorage.setItem(FAVOURITES_KEY, JSON.stringify(list));
  } catch {
    // Storage failure: the choice still applies for this session.
  }
}
