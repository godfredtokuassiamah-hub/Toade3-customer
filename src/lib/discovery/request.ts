// Builds the exact §11 request from applied state + delivery context.
import type { AppliedDiscovery } from "./filterState";
import type {
  DiscoveryPurpose,
  DiscoveryQueryRequest,
  DiscoverySuggestionsRequest,
  DiscoverySurface,
} from "./types";

export const RESULTS_PAGE_SIZE = 20;
export const HOME_RESULTS_LIMIT = 10;
export const SUGGESTION_LIMIT = 3;

export function buildQueryRequest(
  applied: AppliedDiscovery,
  context: { id: string; revision: number },
  surface: DiscoverySurface,
  purpose: DiscoveryPurpose,
  limit: number,
  cursor: string | null,
): DiscoveryQueryRequest {
  return {
    context_id: context.id,
    context_revision: context.revision,
    q: applied.q,
    scope: applied.scope,
    sort: applied.sort,
    filters: applied.filters,
    surface,
    purpose,
    limit,
    cursor,
  };
}

export function buildSuggestionsRequest(
  applied: AppliedDiscovery,
  context: { id: string; revision: number },
): DiscoverySuggestionsRequest {
  return {
    context_id: context.id,
    context_revision: context.revision,
    q: applied.q,
    scope: applied.scope,
    filters: applied.filters,
    limit: SUGGESTION_LIMIT,
  };
}
