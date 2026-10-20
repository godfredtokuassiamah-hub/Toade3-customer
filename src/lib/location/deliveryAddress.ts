// Delivery address model + local persistence (AsyncStorage, in Expo Go).
// Coordinates are always stored so the future quote-delivery API can use
// either raw coordinates or map them to a campus drop point.
import AsyncStorage from "@react-native-async-storage/async-storage";

export type DeliveryAddress = {
  id: string;
  title: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  plusCode: string;
};

export const ACTIVE_ADDRESS_KEY = "toade3.activeAddress";
export const RECENT_ADDRESSES_KEY = "toade3.recentAddresses";
export const MAX_RECENTS = 8;
// Two addresses closer than this are treated as the same place.
const SAME_PLACE_METERS = 25;

// Stable id from coordinates (~1 m precision).
export function addressId(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}

export function distanceMeters(
  a: Pick<DeliveryAddress, "latitude" | "longitude">,
  b: Pick<DeliveryAddress, "latitude" | "longitude">,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isSameAddress(a: DeliveryAddress, b: DeliveryAddress): boolean {
  if (a.id === b.id) return true;
  if (norm(a.title) === norm(b.title) && norm(a.subtitle) === norm(b.subtitle)) {
    return true;
  }
  return distanceMeters(a, b) < SAME_PLACE_METERS;
}

// Keeps the first occurrence of each place (list order = priority).
export function dedupeAddresses(list: readonly DeliveryAddress[]): DeliveryAddress[] {
  const out: DeliveryAddress[] = [];
  for (const item of list) {
    if (!out.some((kept) => isSameAddress(kept, item))) out.push(item);
  }
  return out;
}

// Most recent first, deduped, capped at max.
export function addRecent(
  list: readonly DeliveryAddress[],
  address: DeliveryAddress,
  max: number = MAX_RECENTS,
): DeliveryAddress[] {
  return dedupeAddresses([address, ...list]).slice(0, Math.max(0, max));
}

function isAddress(value: unknown): value is DeliveryAddress {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.title === "string" &&
    typeof v.subtitle === "string" &&
    typeof v.plusCode === "string" &&
    typeof v.latitude === "number" &&
    Number.isFinite(v.latitude) &&
    typeof v.longitude === "number" &&
    Number.isFinite(v.longitude)
  );
}

// Parses stored JSON, dropping anything malformed.
export function parseAddress(raw: string | null): DeliveryAddress | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isAddress(value) ? value : null;
  } catch {
    return null;
  }
}

export function parseRecents(raw: string | null): DeliveryAddress[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? dedupeAddresses(value.filter(isAddress)).slice(0, MAX_RECENTS)
      : [];
  } catch {
    return [];
  }
}

export async function loadDeliveryState(): Promise<{
  active: DeliveryAddress | null;
  recents: DeliveryAddress[];
}> {
  try {
    const [active, recents] = await Promise.all([
      AsyncStorage.getItem(ACTIVE_ADDRESS_KEY),
      AsyncStorage.getItem(RECENT_ADDRESSES_KEY),
    ]);
    return { active: parseAddress(active), recents: parseRecents(recents) };
  } catch {
    return { active: null, recents: [] };
  }
}

export async function saveDeliveryState(
  active: DeliveryAddress | null,
  recents: readonly DeliveryAddress[],
): Promise<void> {
  const ops: Promise<void>[] = [
    AsyncStorage.setItem(RECENT_ADDRESSES_KEY, JSON.stringify(recents)),
  ];
  ops.push(
    active
      ? AsyncStorage.setItem(ACTIVE_ADDRESS_KEY, JSON.stringify(active))
      : AsyncStorage.removeItem(ACTIVE_ADDRESS_KEY),
  );
  await Promise.all(ops);
}

// TODO(location): DEV-ONLY sample rows from the design mock so the recents
// list is visible in development. Never shown in release builds; remove
// once real recents exist in testing. Coordinates are approximate.
export const DEV_SEED_RECENTS: readonly DeliveryAddress[] = [
  {
    id: "dev-seed-1",
    title: "Nationwide Technologies Limited",
    subtitle: "Blewusi Road, Accra, Ghana",
    latitude: 5.6331,
    longitude: -0.1786,
    plusCode: "",
  },
  {
    id: "dev-seed-2",
    title: "Ecowas Road 113",
    subtitle: "Madina",
    latitude: 5.6833,
    longitude: -0.1667,
    plusCode: "",
  },
];
