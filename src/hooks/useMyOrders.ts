// The customer's orders: 10 s stale, refetched on app focus, never
// persisted (private). useOrder for one order, useCancelOrder to cancel
// (expected_version -> STALE_VERSION on a race).
import { useMutation, useQuery } from "@tanstack/react-query";

import type { BackendError } from "../lib/backend/errors";
import { MINUTE, queryClient } from "../lib/backend/queryClient";
import { qk } from "../lib/backend/queryKeys";
import { type CancelResult, cancelOrder, getOrder, listMyOrders } from "../services/orders";

const ORDERS_STALE_MS = 10_000;

export function useMyOrders() {
  return useQuery(
    {
      queryKey: qk.orders(),
      queryFn: listMyOrders,
      staleTime: ORDERS_STALE_MS,
      gcTime: 5 * MINUTE,
      refetchOnWindowFocus: true,
    },
    queryClient,
  );
}

export function useOrder(id: string | null | undefined) {
  return useQuery(
    {
      queryKey: qk.order(id ?? ""),
      queryFn: () => getOrder(id ?? ""),
      enabled: !!id,
      staleTime: ORDERS_STALE_MS,
      gcTime: 5 * MINUTE,
      refetchOnWindowFocus: true,
    },
    queryClient,
  );
}

export function useCancelOrder() {
  return useMutation<CancelResult, BackendError, { orderId: string; expectedVersion: number }>(
    {
      mutationFn: ({ orderId, expectedVersion }) => cancelOrder(orderId, expectedVersion),
      onSettled: (_data, _error, vars) => {
        queryClient.invalidateQueries({ queryKey: qk.order(vars.orderId) });
        queryClient.invalidateQueries({ queryKey: qk.orders() });
      },
    },
    queryClient,
  );
}
