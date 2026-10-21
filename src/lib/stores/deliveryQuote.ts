// Delivery fee and time estimates for store cards, from the architecture
// blueprint's fare matrix. Pure functions only (unit-tested).
//
// DISPLAY ESTIMATES ONLY: the server's quote-delivery is authoritative at
// checkout; never charge from these numbers.
//
// Distance: Haversine from the store to the drop-off, rounded UP to 0.1 km.
//   0.0-1.0 km -> GHS 5.00,  10-15 min
//   1.1-2.5 km -> GHS 8.00,  15-25 min
//   2.6-4.0 km -> GHS 12.00, 25-35 min
//   4.1-5.0 km -> GHS 12.00 + GHS 2.50 per km over 4.0, 35+ min
//   over 5.0 km -> not deliverable
// Shown time = (prep min + zone min) to (prep max + zone max).

export type LatLng = { latitude: number; longitude: number };

export type DeliveryZone = {
  id: 1 | 2 | 3 | 4;
  // Inclusive upper bound, in tenths of a km.
  maxTenths: number;
  etaMins: readonly [number, number];
};

export type DeliveryQuote =
  | {
      deliverable: true;
      distanceKm: number;
      feeMinor: number;
      etaMins: readonly [number, number];
    }
  | { deliverable: false; distanceKm: number };

// Fallback drop-off (central Accra) when no address is confirmed.
export const DEFAULT_DROPOFF: LatLng = { latitude: 5.6037, longitude: -0.187 };
export const MAX_DELIVERY_KM = 5;

// "35+ min": the blueprint gives no upper bound for zone 4, so cards show
// 35-45 min plus prep time.
const ZONES: readonly DeliveryZone[] = [
  { id: 1, maxTenths: 10, etaMins: [10, 15] },
  { id: 2, maxTenths: 25, etaMins: [15, 25] },
  { id: 3, maxTenths: 40, etaMins: [25, 35] },
  { id: 4, maxTenths: 50, etaMins: [35, 45] },
];

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Distance in whole tenths of a km, rounded up (1.04 -> 11). The epsilon
// keeps float noise (1.0000000001) from bumping an exact tenth up.
function toTenths(km: number): number {
  return Math.max(0, Math.ceil(km * 10 - 1e-9));
}

// 1.04 -> 1.1, 2.55 -> 2.6, 1.0 -> 1.0.
export function priceDistanceKm(km: number): number {
  return toTenths(km) / 10;
}

// Zone for an already-rounded price distance; null when over 5.0 km.
export function zoneFor(priceKm: number): DeliveryZone | null {
  const tenths = Math.round(priceKm * 10);
  return ZONES.find((z) => tenths <= z.maxTenths) ?? null;
}

// Fee in integer pesewas for a rounded price distance; null when over 5.0 km.
export function deliveryFeeMinor(priceKm: number): number | null {
  const zone = zoneFor(priceKm);
  if (!zone) return null;
  switch (zone.id) {
    case 1:
      return 500;
    case 2:
      return 800;
    case 3:
      return 1200;
    case 4: {
      // GHS 2.50 per km = 25 pesewas per 0.1 km over 4.0.
      const tenths = Math.round(priceKm * 10);
      return 1200 + 25 * (tenths - 40);
    }
  }
}

export function etaRange(
  prepMins: readonly [number, number],
  zone: DeliveryZone,
): readonly [number, number] {
  return [prepMins[0] + zone.etaMins[0], prepMins[1] + zone.etaMins[1]];
}

// [20, 35] -> "20-35 min".
export function formatEtaRange(range: readonly [number, number]): string {
  return `${range[0]}-${range[1]} min`;
}

export function quoteDelivery(
  store: LatLng & { prepMins: readonly [number, number] },
  dropoff: LatLng,
): DeliveryQuote {
  const distanceKm = priceDistanceKm(haversineKm(store, dropoff));
  const zone = zoneFor(distanceKm);
  const feeMinor = deliveryFeeMinor(distanceKm);
  if (!zone || feeMinor == null) return { deliverable: false, distanceKm };
  return { deliverable: true, distanceKm, feeMinor, etaMins: etaRange(store.prepMins, zone) };
}
