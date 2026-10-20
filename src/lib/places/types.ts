export type LatLng = { lat: number; lng: number };

// One address search / reverse-geocode result, provider-independent.
export type PlaceSuggestion = {
  // "photon:<osm_type><osm_id>", "photon:<lat>,<lng>" or "device:<lat>,<lng>".
  id: string;
  // Short line, e.g. "University Avenue".
  title: string;
  // Area / city / country, e.g. "Greater Accra Region, Ghana". May be "".
  subtitle: string;
  // title + subtitle parts, de-duplicated.
  fullAddress: string;
  lat: number;
  lng: number;
};
