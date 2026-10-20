// Device location for the profile setup flow and the Home top bar.
// Foreground only. expo-location's native reverse geocoder first (no network
// quota; Android/iOS only), Photon /reverse as the fallback (and on web).
import * as Location from "expo-location";
import { Platform } from "react-native";

import { withTimeout } from "../lib/auth/profileCompletion";
import { formatGeocoded } from "../lib/location/geocode";
import { shortLabelFromParts } from "../lib/places/locationLabel";
import { joinParts } from "../lib/places/mapPhoton";
import type { LatLng, PlaceSuggestion } from "../lib/places/types";
import { reverseGeocode } from "./places";

export type PermissionState = { granted: boolean; canAskAgain: boolean };

// Reads the current permission; never prompts.
export async function readPermission(): Promise<PermissionState> {
  try {
    const p = await Location.getForegroundPermissionsAsync();
    return { granted: p.granted, canAskAgain: p.canAskAgain };
  } catch {
    return { granted: false, canAskAgain: true };
  }
}

// Shows the system prompt when the OS still allows it.
export async function requestPermission(): Promise<PermissionState> {
  try {
    const p = await Location.requestForegroundPermissionsAsync();
    return { granted: p.granted, canAskAgain: p.canAskAgain };
  } catch {
    return { granted: false, canAskAgain: true };
  }
}

// Cached position no older than maxAgeMs, or null. Never throws.
export async function getLastKnownCoords(maxAgeMs: number): Promise<LatLng | null> {
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: maxAgeMs });
    return last ? { lat: last.coords.latitude, lng: last.coords.longitude } : null;
  } catch {
    return null;
  }
}

// Last known (default max 5 min old), else a Balanced fix bounded by
// timeoutMs (getCurrentPositionAsync has no timeout option). Throws on
// failure / timeout. Permission must already be granted.
export async function getDeviceCoords(
  opts: { maxAgeMs?: number; timeoutMs?: number } = {},
): Promise<LatLng> {
  const last = await getLastKnownCoords(opts.maxAgeMs ?? 5 * 60 * 1000);
  if (last) return last;
  const pos = await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    opts.timeoutMs ?? 10000,
  );
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

export type DescribedPlace = PlaceSuggestion & {
  // Short top-bar label, e.g. "University Avenue".
  shortLabel: string;
};

const PINNED = "Pinned location";

async function describeNative(c: LatLng): Promise<DescribedPlace | null> {
  const [first] = await Location.reverseGeocodeAsync({
    latitude: c.lat,
    longitude: c.lng,
  });
  if (!first) return null;
  const { title, subtitle: rawSubtitle } = formatGeocoded(first, "");
  if (!title.trim()) return null;
  const subtitle = rawSubtitle === PINNED ? "" : rawSubtitle;
  return {
    id: `device:${c.lat.toFixed(5)},${c.lng.toFixed(5)}`,
    title,
    subtitle,
    fullAddress: joinParts([title, ...subtitle.split(", ")]),
    lat: c.lat,
    lng: c.lng,
    shortLabel: shortLabelFromParts(first) ?? title,
  };
}

// Readable place for a device position, or null when both geocoders fail.
// Keeps the device coordinates (not the matched feature's).
export async function describeCoords(c: LatLng): Promise<DescribedPlace | null> {
  if (Platform.OS !== "web") {
    try {
      const native = await describeNative(c);
      if (native) return native;
    } catch {
      // Fall through to Photon.
    }
  }
  try {
    const s = await reverseGeocode(c.lat, c.lng);
    if (!s) return null;
    return { ...s, lat: c.lat, lng: c.lng, shortLabel: s.title };
  } catch {
    return null;
  }
}
