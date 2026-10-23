// Place order mutation (no retries: the user retries, reusing the same
// idempotency key). On success: refresh the order list and every product /
// catalog query (stock changed).
import { useMutation } from "@tanstack/react-query";

import type { BackendError } from "../lib/backend/errors";
import { queryClient } from "../lib/backend/queryClient";
import { qk } from "../lib/backend/queryKeys";
import { type PlacedOrder, type PlaceOrderInput, placeOrder } from "../services/orders";

export function invalidateAfterOrder(): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: qk.orders() }),
    queryClient.invalidateQueries({ queryKey: qk.productRoot() }),
    queryClient.invalidateQueries({ queryKey: qk.productsRoot() }),
    queryClient.invalidateQueries({ queryKey: qk.discoveryCatalog() }),
  ]);
}

export function usePlaceOrder() {
  return useMutation<PlacedOrder, BackendError, PlaceOrderInput>(
    {
      mutationFn: placeOrder,
      onSuccess: () => {
        invalidateAfterOrder();
      },
    },
    queryClient,
  );
}
