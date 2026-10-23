// Stores directory through the shared query cache (5 min stale, persisted).
// placeholderData = the bundled mock directory, so the first render matches
// the app before the backend existed; logos are attached in `select`.
import { useQuery } from "@tanstack/react-query";

import type { Store } from "../data/mock/stores";
import { MINUTE, queryClient } from "../lib/backend/queryClient";
import { qk } from "../lib/backend/queryKeys";
import { listStores, MOCK_STORE_DTOS, type StoreDTO, withStoreArt } from "../services/stores";

const PLACEHOLDER: StoreDTO[] = [...MOCK_STORE_DTOS];
const NO_STORES: readonly Store[] = [];

export function useStores() {
  const query = useQuery(
    {
      queryKey: qk.stores(),
      queryFn: listStores,
      staleTime: 5 * MINUTE,
      placeholderData: PLACEHOLDER,
      select: withStoreArt,
    },
    queryClient,
  );
  return { ...query, stores: query.data ?? NO_STORES };
}
