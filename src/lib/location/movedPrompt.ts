// "You've moved" prompt policy for Home. The confirmed delivery address is
// where orders go, so a new device position never replaces it silently:
// Home offers the switch and the user decides.
//
// Offer when:
// - there is a confirmed address and a live device position,
// - the device is at least MOVED_PROMPT_METERS from that address, and
// - the user hasn't dismissed the prompt near this position already
//   (dismissing at a place silences it until they move another
//   MOVED_PROMPT_METERS from where they dismissed it).
import { addressId, type DeliveryAddress, distanceMeters } from "./deliveryAddress";
import { shortPlusCode } from "./plusCode";

export const MOVED_PROMPT_METERS = 500;

export type Point = { latitude: number; longitude: number };

// A described device position (services/deviceLocation DescribedPlace).
export type LivePlace = {
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
  shortLabel: string;
};

export function shouldOfferMove(i: {
  active: DeliveryAddress | null;
  live: LivePlace | null;
  dismissedAt: Point | null;
  meters?: number;
}): boolean {
  const meters = i.meters ?? MOVED_PROMPT_METERS;
  if (!i.active || !i.live) return false;
  const here: Point = { latitude: i.live.lat, longitude: i.live.lng };
  if (distanceMeters(i.active, here) < meters) return false;
  if (i.dismissedAt && distanceMeters(i.dismissedAt, here) < meters) return false;
  return true;
}

// The live place as a delivery address (same shape the picker confirms).
export function liveToAddress(p: LivePlace): DeliveryAddress {
  return {
    id: addressId(p.lat, p.lng),
    title: p.title,
    subtitle: p.subtitle,
    latitude: p.lat,
    longitude: p.lng,
    plusCode: shortPlusCode(p.lat, p.lng),
  };
}

export function parsePoint(raw: string | null): Point | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return null;
    const { latitude, longitude } = v as Record<string, unknown>;
    return typeof latitude === "number" &&
      Number.isFinite(latitude) &&
      typeof longitude === "number" &&
      Number.isFinite(longitude)
      ? { latitude, longitude }
      : null;
  } catch {
    return null;
  }
}
