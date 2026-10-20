// Pure helpers for the Home top-bar location label and its refresh policy.
import type { LatLng } from "./types";

export const LOCATION_REFRESH_MS = 10 * 60 * 1000;

const str = (v: string | null | undefined): string =>
  typeof v === "string" ? v.trim() : "";

// Short label from geocoder parts: street -> district -> name -> city -> subregion.
export function shortLabelFromParts(p: {
  name?: string | null;
  street?: string | null;
  district?: string | null;
  city?: string | null;
  subregion?: string | null;
}): string | null {
  return (
    str(p.street) ||
    str(p.district) ||
    str(p.name) ||
    str(p.city) ||
    str(p.subregion) ||
    null
  );
}

// Top-bar label precedence:
// 1. the address picked in /location-picker (deliberate per-device choice)
// 2. the live device label
// 3. the saved profile location label, only while permission is granted
//    (live fix pending)
// 4. the saved delivery address label
// 5. the fallback text
export function pickLocationLabel(i: {
  picked?: string | null;
  live?: string | null;
  savedLocation?: string | null;
  permissionGranted: boolean;
  address?: string | null;
  fallback: string;
}): string {
  return (
    str(i.picked) ||
    str(i.live) ||
    (i.permissionGranted ? str(i.savedLocation) : "") ||
    str(i.address) ||
    i.fallback
  );
}

export function shouldRefresh(
  lastAt: number | null,
  now: number,
  intervalMs: number,
): boolean {
  return lastAt === null || now - lastAt >= intervalMs;
}

// True when there's no previous point or b is at least `meters` from a.
export function movedEnough(a: LatLng | null, b: LatLng, meters: number): boolean {
  if (!a) return true;
  return distanceMeters(a, b) >= meters;
}

// Haversine. Local copy of lib/location/deliveryAddress's distanceMeters so
// this module stays free of AsyncStorage (pure, testable without mocks).
function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
