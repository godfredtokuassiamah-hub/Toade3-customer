// Keeps the discovery context in step with the confirmed delivery point.
// A new drop-off bumps the context revision: open Filters drafts close,
// old requests are rejected by the race guard and lists refetch.
import { useEffect } from "react";

import { updateDeliveryContext } from "../../lib/discovery/discoveryStore";
import { useDeliveryAddress } from "../../lib/location/DeliveryAddressContext";
import { getCategoryTaxonomy, registerDeliveryContext } from "../../services/discovery";

export function DiscoveryContextSync() {
  const { active } = useDeliveryAddress();
  const id = active?.id ?? null;
  const latitude = active?.latitude ?? null;
  const longitude = active?.longitude ?? null;

  useEffect(() => {
    if (id == null) return;
    const coords =
      latitude != null && longitude != null ? { latitude, longitude } : null;
    updateDeliveryContext(id, getCategoryTaxonomy(), (revision) =>
      registerDeliveryContext(id, revision, coords),
    );
  }, [id, latitude, longitude]);

  return null;
}
