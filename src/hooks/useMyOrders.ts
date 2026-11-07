// The customer's orders: 10 s stale, refetched on app focus, never
// persisted (private). useOrder for one order, useCancelOrder to cancel
// (expected_version -> STALE_VERSION on a race).
import { useMutation, useQuery } from "@tanstack/react-query";

import type { BackendError } from "../lib/backend/errors";
import { MINUTE, queryClient } from "../lib/backend/queryClient";
import { qk } from "../lib/backend/queryKeys";
import { type CancelResult, cancelOrder, getOrder, getOrderTracking, listMyOrders } from "../services/orders";

const ORDERS_STALE_MS = 10_000;

// pollMs: re-check while any order is still in progress (Orders tab), so a
// delivered order moves to "Past" without a pull.
export function useMyOrders(opts: { pollMs?: number } = {}) {
  const { pollMs } = opts;
  return useQuery(
    {
      queryKey: qk.orders(),
      queryFn: listMyOrders,
      staleTime: ORDERS_STALE_MS,
      gcTime: 5 * MINUTE,
      refetchOnWindowFocus: true,
      refetchInterval: pollMs
        ? (query) => (query.state.data?.some((o) => !FINAL_STATUSES.has(o.status)) ? pollMs : false)
        : false,
    },
    queryClient,
  );
}

// Order states that never change again (no polling once reached).
const FINAL_STATUSES = new Set(["delivered", "rejected", "cancelled"]);

// pollMs: refetch on this interval while the order is still in progress
// (the tracking screen), so a store accept shows up without a pull. Polling
// stops at a final status and while the app is in the background (TanStack
// pauses intervals when unfocused by default).
export function useOrder(id: string | null | undefined, opts: { pollMs?: number } = {}) {
  const { pollMs } = opts;
  return useQuery(
    {
      queryKey: qk.order(id ?? ""),
      queryFn: () => getOrder(id ?? ""),
      enabled: !!id,
      staleTime: ORDERS_STALE_MS,
      gcTime: 5 * MINUTE,
      refetchOnWindowFocus: true,
      refetchInterval: pollMs
        ? (query) => {
            const status = query.state.data?.status;
            return status && FINAL_STATUSES.has(status) ? false : pollMs;
          }
        : false,
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

// Live tracking (timeline, rider, server ETA). Polled with the order while
// it's in progress; data is null until 0010 is deployed (the screen then
// estimates on the device). Under the order's key, so cancel invalidates it.
export function useOrderTracking(id: string | null | undefined, opts: { pollMs?: number } = {}) {
  const { pollMs } = opts;
  return useQuery(
    {
      queryKey: [...qk.order(id ?? ""), "tracking"] as const,
      queryFn: () => getOrderTracking(id ?? ""),
      enabled: !!id,
      staleTime: ORDERS_STALE_MS,
      gcTime: 5 * MINUTE,
      refetchOnWindowFocus: true,
      refetchInterval: pollMs
        ? (query) => {
            const status = query.state.data?.status;
            return status && FINAL_STATUSES.has(status) ? false : pollMs;
          }
        : false,
    },
    queryClient,
  );
}