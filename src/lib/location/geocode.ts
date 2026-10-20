// Thin wrappers over expo-location geocoding (platform geocoders: Apple on
// iOS, Android Geocoder on Android). No Places API key, so this is basic
// geocoding, not autocomplete. On Android, geocoding needs the foreground
// location permission.
import * as Location from "expo-location";

import { addressId, dedupeAddresses, type DeliveryAddress } from "./deliveryAddress";
import { shortPlusCode } from "./plusCode";

type Geocoded = Pick<
  Location.LocationGeocodedAddress,
  "name" | "street" | "streetNumber" | "district" | "city" | "subregion" | "region" | "country"
>;

function join(parts: (string | null | undefined)[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const v = p?.trim();
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out.join(", ");
}

// Readable title/subtitle from a geocoder result.
export function formatGeocoded(
  g: Geocoded | undefined,
  fallbackTitle: string,
): { title: string; subtitle: string } {
  if (!g) return { title: fallbackTitle, subtitle: "Pinned location" };
  const street = join([
    g.street && g.streetNumber ? `${g.street} ${g.streetNumber}` : g.street,
  ]);
  // iOS often puts the street address in `name`; prefer a distinct place name.
  const title = g.name?.trim() || street || g.district?.trim() || fallbackTitle;
  const subtitle = join([
    street.toLowerCase() === title.toLowerCase() ? null : street,
    g.district,
    g.city ?? g.subregion,
    g.country,
  ].filter((p) => p?.trim().toLowerCase() !== title.toLowerCase()));
  return { title, subtitle: subtitle || "Pinned location" };
}

export function buildAddress(
  latitude: number,
  longitude: number,
  title: string,
  subtitle: string,
): DeliveryAddress {
  return {
    id: addressId(latitude, longitude),
    title,
    subtitle,
    latitude,
    longitude,
    plusCode: shortPlusCode(latitude, longitude),
  };
}

// Address for a point; falls back to the plus code if the geocoder fails.
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<DeliveryAddress> {
  const plusCode = shortPlusCode(latitude, longitude);
  try {
    const [first] = await Location.reverseGeocodeAsync({ latitude, longitude });
    const { title, subtitle } = formatGeocoded(first, plusCode);
    return buildAddress(latitude, longitude, title, subtitle);
  } catch {
    return buildAddress(latitude, longitude, plusCode, "Pinned location");
  }
}

const MAX_RESULTS = 5;

// Forward geocode a free-text query. Throws if the geocoder fails.
export async function searchAddresses(query: string): Promise<DeliveryAddress[]> {
  const hits = (await Location.geocodeAsync(query)).slice(0, MAX_RESULTS);
  const results = await Promise.all(
    hits.map(async (hit) => {
      try {
        const [first] = await Location.reverseGeocodeAsync(hit);
        const { title, subtitle } = formatGeocoded(first, query);
        return buildAddress(hit.latitude, hit.longitude, title, subtitle);
      } catch {
        return buildAddress(hit.latitude, hit.longitude, query, "Search result");
      }
    }),
  );
  return dedupeAddresses(results);
}
