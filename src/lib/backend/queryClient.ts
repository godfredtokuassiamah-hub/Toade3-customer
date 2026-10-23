// The ONE TanStack Query client (v5). There is no QueryClientProvider (the
// root layout belongs to another tool), so every useQuery / useMutation is
// passed this client as its second argument.
//
// Defaults: 5 min staleTime, 24 h gcTime (>= the persister maxAge, per the
// persistQueryClient docs), retries with exponential backoff for NETWORK
// errors only (business / 4xx errors never retry), refetch on reconnect and
// on app focus. Hooks override staleTime per resource (see src/hooks).
//
// Side effects run once on import (skipped under jest):
//   - focusManager <- AppState ("active" = focused)
//   - onlineManager <- NetInfo (included in Expo Go, SDK 57)
//   - persistQueryClient -> AsyncStorage, ONLY public catalog/store queries
//     (isPersistable), busted by CACHE_VERSION, max age 24 h. Mutations are
//     never persisted.
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { AppState, type AppStateStatus, Platform } from "react-native";

import { computeBackoffDelay } from "../security/backoff";
import { mapBackendError } from "./errors";
import { CACHE_VERSION, isPersistable } from "./queryKeys";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const PERSIST_MAX_AGE = 24 * HOUR;
export const PERSIST_KEY = "toade3.query-cache";
const MAX_RETRIES = 3;

export function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_RETRIES && mapBackendError(error).code === "NETWORK";
}

// Full jitter (uniform in [0, min(8 s, 1 s * 2^attempt))) so many clients
// recovering from the same outage don't retry in lockstep. Reads only:
// mutations never retry (retry: false below).
export function retryDelay(attempt: number): number {
  return computeBackoffDelay(attempt, { baseMs: 1000, capMs: 8000 });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * MINUTE,
      gcTime: PERSIST_MAX_AGE,
      retry: shouldRetry,
      retryDelay,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      // Run the queryFn even when NetInfo says offline: the services decide
      // (mock fallback in dev, NETWORK error in production).
      networkMode: "offlineFirst",
    },
    mutations: {
      retry: false,
      // Fail fast offline instead of pausing: checkout shows the NETWORK
      // copy and the retry reuses the same idempotency key.
      networkMode: "always",
    },
  },
});

let started = false;

function bootstrap() {
  if (started) return;
  started = true;

  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener("change", (status: AppStateStatus) => {
      if (Platform.OS !== "web") setFocused(status === "active");
    });
    return () => sub.remove();
  });

  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected);
    }),
  );

  const persister = createAsyncStoragePersister({
    storage: AsyncStorage,
    key: PERSIST_KEY,
    throttleTime: 1000,
  });
  persistQueryClient({
    queryClient,
    persister,
    maxAge: PERSIST_MAX_AGE,
    buster: CACHE_VERSION,
    dehydrateOptions: {
      shouldDehydrateQuery: (query) =>
        query.state.status === "success" && isPersistable(query.queryKey),
      shouldDehydrateMutation: () => false,
    },
  });
}

const underJest = typeof process !== "undefined" && !!process.env?.JEST_WORKER_ID;
if (!underJest) bootstrap();
