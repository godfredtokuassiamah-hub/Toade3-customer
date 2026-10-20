// The ONE discovery contract: P12 previews, P11 suggestions, results pages
// and the filtered Home all call these two functions.
//
// TODO(discovery): replace the mock oracle with the Edge endpoints
//   POST /v1/customer/discovery/query        -> discoveryQuery
//   POST /v1/customer/discovery/suggestions  -> discoverySuggestions
// (same request/response shapes, see docs/discovery-api.md). Coverage is
// then resolved server-side from the confirmed drop-off, and HTTP 401/403/
// 409/422/429 map onto DiscoveryError. Availability and price are
// rechecked at quote/order time; discovery is display-only.
import { CATEGORIES, mockDiscoveryCatalog } from "../data/mock/catalog";
import {
  isWithinMockCoverage,
  MOCK_COVERAGE,
  runDiscoveryQuery,
  runDiscoverySuggestions,
} from "../lib/discovery/oracle";
import {
  type Category,
  type Coordinates,
  DiscoveryError,
  type DiscoveryQueryRequest,
  type DiscoveryQueryResponse,
  type DiscoverySuggestionsRequest,
  type DiscoverySuggestionsResponse,
  type MockCatalog,
} from "../lib/discovery/types";

const LATENCY_MS = 300;

let catalog: MockCatalog = mockDiscoveryCatalog;
const contexts = new Map<string, { revision: number; coords: Coordinates | null }>();

// Local category taxonomy (labels / scopes) for chips and revalidation.
export function getCategoryTaxonomy(): Category[] {
  return CATEGORIES;
}

export function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

// Mock stand-in for the server resolving a confirmed drop-off point.
export function registerDeliveryContext(
  id: string,
  revision: number,
  coords: Coordinates | null,
): void {
  contexts.set(id, { revision, coords });
}

// DEV: simulate a catalog change (stock/price update) so open cursors go
// stale and the client shows "Results refreshed as availability changed."
export function bumpMockCatalogRevision(): void {
  catalog = { ...catalog, revision: catalog.revision + 1 };
}

export function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === "AbortError";
}

function abortError(): Error {
  const e = new Error("Aborted");
  e.name = "AbortError";
  return e;
}

// Resolves after the simulated latency unless aborted first.
function delay(signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, LATENCY_MS);
    function onAbort() {
      clearTimeout(timer);
      reject(abortError());
    }
    signal?.addEventListener("abort", onAbort);
  });
}

function resolveContext(id: string, revision: number): { covered: boolean } {
  const ctx = contexts.get(id);
  if (!ctx) return { covered: true };
  if (ctx.revision !== revision) {
    throw new DiscoveryError("CONTEXT_STALE", "Delivery point changed.");
  }
  return {
    covered: isWithinMockCoverage(ctx.coords, MOCK_COVERAGE.center, MOCK_COVERAGE.radiusKm),
  };
}

function asDiscoveryError(e: unknown): unknown {
  if (e instanceof DiscoveryError || isAbortError(e)) return e;
  return new DiscoveryError("NETWORK", "Results could not load.");
}

export async function discoveryQuery(
  req: DiscoveryQueryRequest,
  signal?: AbortSignal,
): Promise<DiscoveryQueryResponse> {
  await delay(signal);
  try {
    const { covered } = resolveContext(req.context_id, req.context_revision);
    return runDiscoveryQuery(catalog, req, { now: new Date(), covered });
  } catch (e) {
    throw asDiscoveryError(e);
  }
}

export async function discoverySuggestions(
  req: DiscoverySuggestionsRequest,
  signal?: AbortSignal,
): Promise<DiscoverySuggestionsResponse> {
  await delay(signal);
  try {
    const { covered } = resolveContext(req.context_id, req.context_revision);
    return runDiscoverySuggestions(catalog, req, { now: new Date(), covered });
  } catch (e) {
    throw asDiscoveryError(e);
  }
}
