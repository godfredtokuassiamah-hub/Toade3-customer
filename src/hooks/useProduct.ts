// One product with its option groups (2 min stale, persisted).
// placeholderData = the mock product (catalog.ts + itemOptions.ts), so the
// item sheet renders immediately and identically to before.
import { useQuery } from "@tanstack/react-query";

import { MINUTE, queryClient } from "../lib/backend/queryClient";
import { qk } from "../lib/backend/queryKeys";
import { getMockProduct, getProduct } from "../services/catalog";

export function useProduct(id: string) {
  return useQuery(
    {
      queryKey: qk.product(id),
      queryFn: () => getProduct(id),
      staleTime: 2 * MINUTE,
      placeholderData: () => getMockProduct(id),
    },
    queryClient,
  );
}
