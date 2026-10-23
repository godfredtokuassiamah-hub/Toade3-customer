// Products for a vendor and / or category (5 min stale, persisted).
import { useQuery } from "@tanstack/react-query";

import { MINUTE, queryClient } from "../lib/backend/queryClient";
import { type ProductFilter, qk } from "../lib/backend/queryKeys";
import { listMockProducts, listProducts } from "../services/catalog";

export function useProducts(filter: ProductFilter) {
  const vendorId = filter.vendorId ?? null;
  const categoryId = filter.categoryId ?? null;
  return useQuery(
    {
      queryKey: qk.products({ vendorId, categoryId }),
      queryFn: () => listProducts({ vendorId, categoryId }),
      staleTime: 5 * MINUTE,
      placeholderData: () => listMockProducts({ vendorId, categoryId }),
    },
    queryClient,
  );
}
