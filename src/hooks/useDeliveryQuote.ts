// Checkout delivery quote: the server's quote_delivery (authoritative), 30 s
// stale, never persisted. placeholderData = the local fare-matrix estimate
// for the same drop-off, so the fee / ETA show instantly. `quote` keeps
// showing that estimate if the server quote fails (offline); placement is
// re-quoted and re-priced server-side anyway.
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { MINUTE, queryClient } from "../lib/backend/queryClient";
import { qk } from "../lib/backend/queryKeys";
import type { LatLng } from "../lib/stores/deliveryQuote";
import { type DeliveryQuoteDTO, localDeliveryQuote, quoteDelivery } from "../services/orders";

export function useDeliveryQuote(vendorId: string | null, dropoff: LatLng) {
  const { latitude, longitude } = dropoff;
  const estimate = useMemo(
    () => (vendorId ? localDeliveryQuote(vendorId, { latitude, longitude }) : undefined),
    [vendorId, latitude, longitude],
  );
  const query = useQuery(
    {
      queryKey: qk.deliveryQuote(vendorId ?? "", latitude, longitude),
      queryFn: () => quoteDelivery(vendorId ?? "", { latitude, longitude }),
      enabled: !!vendorId,
      staleTime: 30_000,
      gcTime: 5 * MINUTE,
      placeholderData: estimate,
    },
    queryClient,
  );
  const quote: DeliveryQuoteDTO | undefined = query.data ?? estimate;
  return { ...query, quote };
}
