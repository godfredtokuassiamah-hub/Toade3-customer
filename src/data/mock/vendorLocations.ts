// TODO(vendors): MOCK pickup points for the catalog vendors (the catalog
// has no coordinates yet). Spread around central Accra so the checkout
// delivery estimate varies. Replace with the vendor read API.
import type { LatLng } from "../../lib/stores/deliveryQuote";

export type VendorLocation = LatLng & { prepMins: readonly [number, number] };

const LOCATIONS: Record<string, VendorLocation> = {
  "v-campus-grill": { latitude: 5.608, longitude: -0.185, prepMins: [10, 15] },
  "v-green-bowl": { latitude: 5.615, longitude: -0.18, prepMins: [10, 15] },
  "v-mamas-pot": { latitude: 5.593, longitude: -0.195, prepMins: [15, 20] },
  "v-auntie-ama": { latitude: 5.6, longitude: -0.19, prepMins: [5, 10] },
  "v-lakeside": { latitude: 5.63, longitude: -0.175, prepMins: [15, 20] },
  "v-campus-mart": { latitude: 5.622, longitude: -0.173, prepMins: [5, 10] },
  "v-sweet-sip": { latitude: 5.606, longitude: -0.176, prepMins: [5, 10] },
  "v-juice-hub": { latitude: 5.61, longitude: -0.2, prepMins: [5, 10] },
  "v-brew-corner": { latitude: 5.598, longitude: -0.182, prepMins: [5, 10] },
  "v-golden-crust": { latitude: 5.58, longitude: -0.21, prepMins: [5, 10] },
  "v-sweet-tooth": { latitude: 5.615, longitude: -0.165, prepMins: [5, 10] },
  "v-le-petit": { latitude: 5.565, longitude: -0.18, prepMins: [10, 15] },
  "v-fresh-basket": { latitude: 5.59, longitude: -0.2, prepMins: [10, 15] },
  "v-city-stores": { latitude: 5.625, longitude: -0.195, prepMins: [10, 20] },
};

// Unknown vendors fall back to central Accra.
const FALLBACK: VendorLocation = { latitude: 5.6037, longitude: -0.187, prepMins: [10, 15] };

export function getVendorLocation(vendorId: string): VendorLocation {
  return LOCATIONS[vendorId] ?? FALLBACK;
}
