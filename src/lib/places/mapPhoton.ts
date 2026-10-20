// Pure mapping of Photon (komoot) GeoJSON to PlaceSuggestion. No RN imports.
// Response: FeatureCollection; geometry.coordinates is [lon, lat] (lon first);
// every property may be missing.
import type { PlaceSuggestion } from "./types";

export type PhotonProperties = {
  osm_type?: string;
  osm_id?: number;
  osm_key?: string;
  osm_value?: string;
  type?: string;
  name?: string;
  housenumber?: string;
  street?: string;
  postcode?: string;
  district?: string;
  locality?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
  countrycode?: string;
};

export type PhotonFeature = {
  type?: string;
  geometry?: { type?: string; coordinates?: unknown };
  properties?: PhotonProperties;
};

const str = (v: unknown): string =>
  typeof v === "string" ? v.trim() : "";

// Trims, drops blanks, case-insensitive de-dupe, ", " join.
export function joinParts(parts: (string | null | undefined)[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const v = str(p);
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out.join(", ");
}

function coordsOf(geometry: PhotonFeature["geometry"]): { lat: number; lng: number } | null {
  const c = geometry?.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  const [lng, lat] = c as unknown[];
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function mapPhotonFeature(f: PhotonFeature): PlaceSuggestion | null {
  if (!f || typeof f !== "object") return null;
  const coords = coordsOf(f.geometry);
  if (!coords) return null;
  const p: PhotonProperties =
    f.properties && typeof f.properties === "object" ? f.properties : {};

  const street = str(p.street);
  const housenumber = str(p.housenumber);
  // Housenumber after the street (Ghana / EU style).
  const streetLine = street && housenumber ? `${street} ${housenumber}` : street;
  const title =
    str(p.name) ||
    streetLine ||
    str(p.district) ||
    str(p.locality) ||
    str(p.city) ||
    str(p.county) ||
    str(p.state) ||
    str(p.country);
  if (!title) return null;

  const same = (v: string) => v.toLowerCase() === title.toLowerCase();
  const rest = [
    streetLine,
    p.district,
    p.locality,
    str(p.city) || p.county,
    p.state,
    p.country,
  ]
    .map(str)
    .filter((v) => v && !same(v));
  const subtitle = joinParts(rest);
  const fullAddress = joinParts([title, ...rest]);

  const id =
    str(p.osm_type) && typeof p.osm_id === "number"
      ? `photon:${str(p.osm_type)}${p.osm_id}`
      : `photon:${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;

  return { id, title, subtitle, fullAddress, lat: coords.lat, lng: coords.lng };
}

// Tolerant of non-objects / missing features; drops unusable features and
// de-dupes by id and by title + subtitle.
export function mapPhotonResponse(json: unknown): PlaceSuggestion[] {
  if (!json || typeof json !== "object") return [];
  const features = (json as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];
  const ids = new Set<string>();
  const texts = new Set<string>();
  const out: PlaceSuggestion[] = [];
  for (const f of features) {
    const s = mapPhotonFeature(f as PhotonFeature);
    if (!s) continue;
    const text = `${s.title}|${s.subtitle}`.toLowerCase();
    if (ids.has(s.id) || texts.has(text)) continue;
    ids.add(s.id);
    texts.add(text);
    out.push(s);
  }
  return out;
}
