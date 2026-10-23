// One store (directory entry) by id; placeholder = the mock entry.
import { useQuery } from "@tanstack/react-query";

import type { Store } from "../data/mock/stores";
import { MINUTE, queryClient } from "../lib/backend/queryClient";
import { qk } from "../lib/backend/queryKeys";
import { getStore, MOCK_STORE_DTOS, type StoreDTO, withStoreArt } from "../services/stores";

function selectStore(store: StoreDTO | null): Store | null {
  return store ? withStoreArt([store])[0] : null;
}

export function useStore(id: string | null | undefined) {
  return useQuery(
    {
      queryKey: qk.store(id ?? ""),
      queryFn: () => getStore(id ?? ""),
      enabled: !!id,
      staleTime: 5 * MINUTE,
      placeholderData: () => MOCK_STORE_DTOS.find((s) => s.id === id) ?? undefined,
      select: selectStore,
    },
    queryClient,
  );
}
