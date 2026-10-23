// Pure helpers for the storefront "More info" sheet: maps/directions/tel
// URLs, the hours row text, service labels, the rating line and which rows
// show. No react-native imports; the caller passes the platform in.
//
// URL formats (checked, see .agents/tasks/storefront-moreinfo/plan.md §0):
// - Apple Maps: https://maps.apple.com/?daddr=LAT,LNG&dirflg=d (directions
//   from the current location), ?ll=LAT,LNG&q=NAME (labelled pin).
// - Google Maps URLs: https://www.google.com/maps/dir/?api=1&destination=..
//   and /maps/search/?api=1&query=.. (api=1 required; opens the app when
//   installed, else the browser).
// - Android geo intent: geo:LAT,LNG?q=LAT,LNG(Label) (any maps app).
// Primary URLs are https (always handled) so no canOpenURL / query schemes
// are needed.
import type { Coordinates, MockVendor, ServiceType } from "../discovery/types";

export type MapsPlatform = "ios" | "android" | "other";
export type LinkPair = { primary: string; fallback: string };
export type VendorPlace = Pick<MockVendor, "name" | "latitude" | "longitude" | "addressLabel">;

export function toMapsPlatform(os: string): MapsPlatform {
  return os === "ios" || os === "android" ? os : "other";
}

// Both halves finite and in range, else null.
export function vendorCoordinates(v: Pick<MockVendor, "latitude" | "longitude">): Coordinates | null {
  const { latitude, longitude } = v;
  if (latitude == null || longitude == null) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

function fmt(n: number): string {
  return Number(n.toFixed(6)).toString();
}

// "LAT,LNG" for display and URL params.
export function coordinatesText(c: Coordinates): string {
  return `${fmt(c.latitude)}, ${fmt(c.longitude)}`;
}

function googleDir(c: Coordinates): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${fmt(c.latitude)}%2C${fmt(c.longitude)}`;
}

function googleSearch(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function geoUrl(c: Coordinates, name: string): string {
  const ll = `${fmt(c.latitude)},${fmt(c.longitude)}`;
  return `geo:${ll}?q=${ll}(${encodeURIComponent(name)})`;
}

export function directionsUrls(dest: Coordinates, name: string, platform: MapsPlatform): LinkPair {
  const google = googleDir(dest);
  switch (platform) {
    case "ios":
      return {
        primary: `https://maps.apple.com/?daddr=${fmt(dest.latitude)},${fmt(dest.longitude)}&dirflg=d`,
        fallback: google,
      };
    case "android":
      return { primary: google, fallback: geoUrl(dest, name) };
    default:
      return { primary: google, fallback: google };
  }
}

// Coordinates win over the address; neither -> null.
export function mapUrls(v: VendorPlace, platform: MapsPlatform): LinkPair | null {
  const c = vendorCoordinates(v);
  if (c) {
    const ll = `${fmt(c.latitude)}%2C${fmt(c.longitude)}`;
    const google = googleSearch(ll);
    switch (platform) {
      case "ios":
        return {
          primary: `https://maps.apple.com/?ll=${fmt(c.latitude)},${fmt(c.longitude)}&q=${encodeURIComponent(v.name)}`,
          fallback: google,
        };
      case "android":
        return { primary: google, fallback: geoUrl(c, v.name) };
      default:
        return { primary: google, fallback: google };
    }
  }
  const address = v.addressLabel?.trim();
  if (!address) return null;
  const q = encodeURIComponent(address);
  const google = googleSearch(q);
  return platform === "ios"
    ? { primary: `https://maps.apple.com/?q=${q}`, fallback: google }
    : { primary: google, fallback: google };
}

// "tel:+233200000001": digits only, keeping a leading "+". null if no digits.
export function telUrl(phone: string | undefined): string | null {
  if (phone == null) return null;
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits === "") return null;
  return `tel:${trimmed.startsWith("+") ? "+" : ""}${digits}`;
}

export function openStatusTitle(v: Pick<MockVendor, "paused" | "hours">, open: boolean): string {
  if (open) return "Open now";
  if (v.paused) return "Closed";
  return `Opens at ${v.hours.open}`;
}

// "07:00–22:00"; a "24:00" close reads "23:59" (so all-day is 00:00–23:59).
export function hoursRange(hours: MockVendor["hours"]): string {
  const close = hours.close === "24:00" ? "23:59" : hours.close;
  return `${hours.open}–${close}`;
}

const SERVICE_ORDER: readonly ServiceType[] = ["delivery", "scheduled", "pickup"];
const SERVICE_LABELS: Record<ServiceType, string> = {
  delivery: "Delivery",
  scheduled: "Scheduled delivery",
  pickup: "Pickup",
};

// De-duplicated, in a fixed order.
export function serviceTypeLabels(types: readonly ServiceType[] | undefined): string[] {
  if (!types || types.length === 0) return [];
  const set = new Set(types);
  return SERVICE_ORDER.filter((t) => set.has(t)).map((t) => SERVICE_LABELS[t]);
}

// "based on 7,839 ratings" / "based on 1 rating".
export function ratingBasisText(count: number): string {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const grouped = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `based on ${grouped} ${n === 1 ? "rating" : "ratings"}`;
}

// Subtitle for the "View map" row.
export function addressLine(v: VendorPlace): string | null {
  const address = v.addressLabel?.trim();
  if (address) return address;
  const c = vendorCoordinates(v);
  return c ? coordinatesText(c) : null;
}

export type InfoRowVisibility = {
  call: boolean;
  address: boolean;
  map: boolean;
  services: boolean;
  rating: boolean;
};

// Missing data hides its row; the hours row always shows.
export function infoRowVisibility(v: MockVendor): InfoRowVisibility {
  return {
    call: telUrl(v.phone) != null,
    address: addressLine(v) != null,
    map: vendorCoordinates(v) != null,
    services: serviceTypeLabels(v.serviceTypes).length > 0,
    rating: v.rating != null,
  };
}
