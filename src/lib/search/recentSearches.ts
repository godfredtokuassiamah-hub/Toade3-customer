// The customer's own recent searches, persisted on device. Never seeded:
// a new customer has none and the section stays hidden.
import AsyncStorage from "@react-native-async-storage/async-storage";

export const RECENT_SEARCHES_KEY = "toade3.recentSearches";
export const MAX_RECENT_SEARCHES = 8;

// Most recent first, case-insensitive dedupe, capped.
export function addRecentSearch(list: string[], term: string): string[] {
  const t = term.trim().replace(/\s+/g, " ");
  if (t === "") return list;
  const key = t.toLowerCase();
  return [t, ...list.filter((s) => s.toLowerCase() !== key)].slice(
    0,
    MAX_RECENT_SEARCHES,
  );
}

export function parseRecentSearches(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter((v): v is string => typeof v === "string" && v.trim() !== "")
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

export async function loadRecentSearches(): Promise<string[]> {
  try {
    return parseRecentSearches(await AsyncStorage.getItem(RECENT_SEARCHES_KEY));
  } catch {
    return [];
  }
}

export async function saveRecentSearches(list: string[]): Promise<void> {
  try {
    if (list.length === 0) await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
    else await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
  } catch {
    // Storage failure: history just isn't kept this time.
  }
}
