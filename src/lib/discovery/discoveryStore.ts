// Applied discovery state shared by Home, P11 Search, P12 Filters and the
// results screen. A small module store (no provider) so it survives
// navigation. Drafts never live here: the Filters screen owns its draft and
// it dies with the screen (close / swipe / back = discard).
import { useSyncExternalStore } from "react";

import { type AppliedDiscovery, DEFAULT_APPLIED, revalidateApplied } from "./filterState";
import type { Category, DiscoveryFacets, DiscoveryQueryResponse, DiscoverySurface } from "./types";

type DeliveryContext = { id: string; revision: number };

type State = {
  applied: Record<DiscoverySurface, AppliedDiscovery>;
  context: DeliveryContext;
};

const NO_CONTEXT = "none";

let state: State = {
  applied: { home: DEFAULT_APPLIED, search: DEFAULT_APPLIED },
  context: { id: NO_CONTEXT, revision: 0 },
};
const facetCache = new Map<string, DiscoveryFacets>();
let primed: { fingerprint: string; contextRevision: number; response: DiscoveryQueryResponse } | null = null;
let resultsScroll: { key: string; offset: number } | null = null;
let pendingP11Results = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getApplied(surface: DiscoverySurface): AppliedDiscovery {
  return state.applied[surface];
}

export function setApplied(surface: DiscoverySurface, next: AppliedDiscovery): void {
  state = { ...state, applied: { ...state.applied, [surface]: next } };
  emit();
}

export function useApplied(surface: DiscoverySurface): AppliedDiscovery {
  const get = () => state.applied[surface];
  return useSyncExternalStore(subscribe, get, get);
}

export function getDiscoveryContext(): DeliveryContext {
  return state.context;
}

export function useDiscoveryContext(): DeliveryContext {
  return useSyncExternalStore(subscribe, getDiscoveryContext, getDiscoveryContext);
}

// Delivery point changed: new context revision, portable preferences kept,
// category ids revalidated. `register` runs before subscribers hear about
// the new revision (so their refetch already sees it on the service side).
export function updateDeliveryContext(
  id: string,
  categories: readonly Category[],
  register: (revision: number) => void,
): void {
  if (id === state.context.id) return;
  const revision = state.context.revision + 1;
  register(revision);
  facetCache.clear();
  primed = null;
  resultsScroll = null;
  state = {
    context: { id, revision },
    applied: {
      home: revalidateApplied(state.applied.home, categories),
      search: revalidateApplied(state.applied.search, categories),
    },
  };
  emit();
}

// Last real facets per key (surface|scope|q), to seed a reopened sheet.
export function getCachedFacets(key: string): DiscoveryFacets | null {
  return facetCache.get(key) ?? null;
}

export function setCachedFacets(key: string, facets: DiscoveryFacets): void {
  facetCache.set(key, facets);
}

// The Apply response, handed to the screen that renders it so it does not
// refetch the same snapshot. One-shot; must match fingerprint + context.
export function primeResults(fingerprint: string, contextRevision: number, response: DiscoveryQueryResponse): void {
  primed = { fingerprint, contextRevision, response };
}

export function takePrimedResults(fingerprint: string, contextRevision: number): DiscoveryQueryResponse | null {
  if (!primed || primed.fingerprint !== fingerprint || primed.contextRevision !== contextRevision) return null;
  const r = primed.response;
  primed = null;
  return r;
}

export function saveResultsScroll(key: string, offset: number): void {
  resultsScroll = { key, offset };
}

export function getResultsScroll(key: string): number {
  return resultsScroll && resultsScroll.key === key ? resultsScroll.offset : 0;
}

// P11 -> Filters -> Apply: P11 opens the results once it regains focus.
export function setPendingP11Results(): void {
  pendingP11Results = true;
}

export function consumePendingP11Results(): boolean {
  const v = pendingP11Results;
  pendingP11Results = false;
  return v;
}

export function resetDiscoveryStoreForTests(): void {
  state = {
    applied: { home: DEFAULT_APPLIED, search: DEFAULT_APPLIED },
    context: { id: NO_CONTEXT, revision: 0 },
  };
  facetCache.clear();
  primed = null;
  resultsScroll = null;
  pendingP11Results = false;
}
