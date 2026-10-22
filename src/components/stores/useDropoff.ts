import { useMemo } from "react";

import { useDeliveryAddress } from "../../lib/location/DeliveryAddressContext";
import { DEFAULT_DROPOFF, type LatLng } from "../../lib/stores/deliveryQuote";

// Confirmed delivery address, or central Accra until one is set.
export function useDropoff(): { dropoff: LatLng; exact: boolean; ready: boolean } {
  const { active, ready } = useDeliveryAddress();
  const lat = active?.latitude;
  const lng = active?.longitude;
  return useMemo(
    () =>
      lat != null && lng != null
        ? { dropoff: { latitude: lat, longitude: lng }, exact: true, ready }
        : { dropoff: DEFAULT_DROPOFF, exact: false, ready },
    [lat, lng, ready],
  );
}
