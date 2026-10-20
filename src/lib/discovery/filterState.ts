// Filter state model (§03/§04): applied vs draft, one shared reducer for
// every P12 control, group counting, chips and the exact §17 copy. Pure.
import { minorToText, parseGhsToMinor, PRICE_ORDER_ERROR, priceSummary } from "./money";
import type {
  CatalogScope,
  Category,
  DiscoveryFilters,
  DiscoveryScope,
  DiscoverySort,
} from "./types";

export const PRICE_ERROR = PRICE_ORDER_ERROR;
export const UP_TO_50_MAX_MINOR = 5000;
// Capability gate: no versioned sale prices exist, so there is no Offers
// tile and offers_only is never sent as true.
export const OFFERS_AVAILABLE = false;

export const DEFAULT_SORT: DiscoverySort = "best_match";
export const DEFAULT_DISCOVERY_FILTERS: DiscoveryFilters = {
  category_ids: [],
  min_price_minor: null,
  max_price_minor: null,
  open_now: false,
  in_stock_only: false,
  offers_only: false,
};

// What the visible results were built from.
export type AppliedDiscovery = {
  q: string;
  scope: DiscoveryScope;
  sort: DiscoverySort;
  filters: DiscoveryFilters;
};

export const DEFAULT_APPLIED: AppliedDiscovery = {
  q: "",
  scope: "all",
  sort: DEFAULT_SORT,
  filters: DEFAULT_DISCOVERY_FILTERS,
};

export const SCOPES: { id: DiscoveryScope; label: string }[] = [
  { id: "all", label: "All" },
  { id: "food", label: "Food" },
  { id: "groceries", label: "Groceries" },
];

export const SORT_OPTIONS: { id: DiscoverySort; label: string }[] = [
  { id: "best_match", label: "Best match" },
  { id: "price_asc", label: "Price: low to high" },
  { id: "price_desc", label: "Price: high to low" },
];

export type PriceFieldErrors = { min?: string; max?: string };

export type DraftState = {
  q: string;
  scope: DiscoveryScope;
  sort: DiscoverySort;
  // Last VALID price values; the texts below are what the fields show.
  filters: DiscoveryFilters;
  minText: string;
  maxText: string;
  fieldErrors: PriceFieldErrors;
  notice: { id: number; text: string } | null;
  // Bumped by every edit; an Apply captured at an older value is void.
  editSeq: number;
};

export type DraftAction =
  | { type: "toggleOpenNow" }
  | { type: "setOpenNow"; value: boolean }
  | { type: "toggleUpTo50" }
  | { type: "setScope"; scope: DiscoveryScope }
  | { type: "toggleCategory"; id: string }
  | { type: "setMinText"; text: string }
  | { type: "setMaxText"; text: string }
  | { type: "setRange"; min: number | null; max: number | null }
  // Slider handle / screen-reader step: one bound, the other field untouched.
  | { type: "setBound"; handle: "min" | "max"; value: number | null }
  | { type: "setInStock"; value: boolean }
  | { type: "setSort"; sort: DiscoverySort }
  | { type: "clearQuery" }
  | { type: "reset" }
  | { type: "clearNotice" };

export function scopeLabel(scope: DiscoveryScope): string {
  return SCOPES.find((s) => s.id === scope)?.label ?? "All";
}

export function scopeNote(scope: DiscoveryScope): string {
  return `Categories updated for ${scopeLabel(scope)}.`;
}

export function sortLabel(sort: DiscoverySort): string {
  return SORT_OPTIONS.find((s) => s.id === sort)?.label ?? "Best match";
}

export function categoriesForScope(
  categories: readonly Category[],
  scope: DiscoveryScope,
): Category[] {
  return categories.filter((c) => scope === "all" || c.scope === scope);
}

export function draftFromApplied(applied: AppliedDiscovery): DraftState {
  const f = applied.filters;
  return {
    q: applied.q,
    scope: applied.scope,
    sort: applied.sort,
    filters: { ...f, category_ids: [...f.category_ids] },
    minText: f.min_price_minor == null ? "" : minorToText(f.min_price_minor),
    maxText: f.max_price_minor == null ? "" : minorToText(f.max_price_minor),
    fieldErrors: {},
    notice: null,
    editSeq: 0,
  };
}

// Field-level validation. Never swaps min and max.
export function validatePriceTexts(
  minText: string,
  maxText: string,
): { min: number | null; max: number | null; errors: PriceFieldErrors } {
  const pMin = parseGhsToMinor(minText);
  const pMax = parseGhsToMinor(maxText);
  const errors: PriceFieldErrors = {};
  if (!pMin.ok) errors.min = pMin.error;
  if (!pMax.ok) errors.max = pMax.error;
  const min = pMin.ok ? pMin.value : null;
  const max = pMax.ok ? pMax.value : null;
  if (pMin.ok && pMax.ok && min != null && max != null && min > max) errors.max = PRICE_ERROR;
  return { min, max, errors };
}

function withPriceTexts(state: DraftState, minText: string, maxText: string): DraftState {
  const { min, max, errors } = validatePriceTexts(minText, maxText);
  return {
    ...state,
    minText,
    maxText,
    fieldErrors: errors,
    filters: {
      ...state.filters,
      min_price_minor: errors.min ? state.filters.min_price_minor : min,
      max_price_minor: errors.max ? state.filters.max_price_minor : max,
    },
  };
}

function hasFieldErrors(state: DraftState): boolean {
  return state.fieldErrors.min != null || state.fieldErrors.max != null;
}

// Derived, never stored: exactly min = null and max = 5000.
export function isUpTo50Selected(state: DraftState): boolean {
  return (
    !hasFieldErrors(state) &&
    state.filters.min_price_minor === null &&
    state.filters.max_price_minor === UP_TO_50_MAX_MINOR
  );
}

export function resetDraft(state: DraftState): DraftState {
  // Query (and the delivery context / route constraints, held outside the
  // draft) remain.
  return {
    ...draftFromApplied({ ...DEFAULT_APPLIED, q: state.q }),
    editSeq: state.editSeq,
  };
}

export function makeDraftReducer(categories: readonly Category[]) {
  const scopeOf = new Map<string, CatalogScope>(categories.map((c) => [c.id, c.scope]));

  function apply(state: DraftState, action: DraftAction): DraftState {
    switch (action.type) {
      case "toggleOpenNow":
        return { ...state, filters: { ...state.filters, open_now: !state.filters.open_now } };
      case "setOpenNow":
        return { ...state, filters: { ...state.filters, open_now: action.value } };
      case "setInStock":
        return { ...state, filters: { ...state.filters, in_stock_only: action.value } };
      case "toggleUpTo50":
        return isUpTo50Selected(state)
          ? withPriceTexts(state, "", "")
          : withPriceTexts(state, "", minorToText(UP_TO_50_MAX_MINOR));
      case "setScope": {
        if (action.scope === state.scope) return state;
        // Budget, availability and sort are kept; incompatible ids go.
        const kept = state.filters.category_ids.filter((id) => {
          const s = scopeOf.get(id);
          return s != null && (action.scope === "all" || s === action.scope);
        });
        const removed = kept.length !== state.filters.category_ids.length;
        return {
          ...state,
          scope: action.scope,
          filters: { ...state.filters, category_ids: kept },
          notice: removed
            ? { id: state.editSeq + 1, text: scopeNote(action.scope) }
            : state.notice,
        };
      }
      case "toggleCategory": {
        const ids = state.filters.category_ids;
        return {
          ...state,
          filters: {
            ...state.filters,
            category_ids: ids.includes(action.id)
              ? ids.filter((c) => c !== action.id)
              : [...ids, action.id],
          },
        };
      }
      case "setMinText":
        return withPriceTexts(state, action.text, state.maxText);
      case "setMaxText":
        return withPriceTexts(state, state.minText, action.text);
      case "setRange":
        return withPriceTexts(
          state,
          action.min == null ? "" : minorToText(action.min),
          action.max == null ? "" : minorToText(action.max),
        );
      case "setBound": {
        const text = action.value == null ? "" : minorToText(action.value);
        return action.handle === "min"
          ? withPriceTexts(state, text, state.maxText)
          : withPriceTexts(state, state.minText, text);
      }
      case "setSort":
        return { ...state, sort: action.sort };
      case "clearQuery":
        return { ...state, q: "" };
      case "reset":
        return resetDraft(state);
      case "clearNotice":
        return state;
    }
  }

  return function draftReducer(state: DraftState, action: DraftAction): DraftState {
    if (action.type === "clearNotice") return state.notice ? { ...state, notice: null } : state;
    const next = apply(state, action);
    return next === state ? state : { ...next, editSeq: state.editSeq + 1 };
  };
}

export function isDraftDefault(state: DraftState): boolean {
  const f = state.filters;
  return (
    state.scope === "all" &&
    state.sort === DEFAULT_SORT &&
    f.category_ids.length === 0 &&
    f.min_price_minor === null &&
    f.max_price_minor === null &&
    state.minText.trim() === "" &&
    state.maxText.trim() === "" &&
    !f.open_now &&
    !f.in_stock_only &&
    !f.offers_only
  );
}

// null while a price field is invalid (nothing can be previewed/applied).
export function draftToApplied(state: DraftState): AppliedDiscovery | null {
  if (hasFieldErrors(state)) return null;
  return {
    q: state.q.trim(),
    scope: state.scope,
    sort: state.sort,
    filters: {
      ...state.filters,
      category_ids: [...new Set(state.filters.category_ids)].sort(),
      offers_only: OFFERS_AVAILABLE ? state.filters.offers_only : false,
    },
  };
}

// "Filters (N)": non-default filter GROUPS. Sort is not counted.
export function appliedGroupCount(a: AppliedDiscovery): number {
  const f = a.filters;
  let n = 0;
  if (a.scope !== "all") n += 1;
  if (f.min_price_minor != null || f.max_price_minor != null) n += 1;
  if (f.category_ids.length > 0) n += 1;
  if (f.open_now) n += 1;
  if (f.in_stock_only) n += 1;
  if (f.offers_only) n += 1;
  return n;
}

export function isAppliedDefault(a: AppliedDiscovery): boolean {
  return appliedGroupCount(a) === 0 && a.sort === DEFAULT_SORT;
}

export type AppliedChip = {
  key: string;
  label: string;
  remove: (a: AppliedDiscovery) => AppliedDiscovery;
};

function withFilters(a: AppliedDiscovery, patch: Partial<DiscoveryFilters>): AppliedDiscovery {
  return { ...a, filters: { ...a.filters, ...patch } };
}

// One removable chip per group, plus the (uncounted) sort label.
export function appliedChips(
  a: AppliedDiscovery,
  categoryLabel: (id: string) => string,
): { groups: AppliedChip[]; sort: AppliedChip | null } {
  const f = a.filters;
  const groups: AppliedChip[] = [];
  if (a.scope !== "all") {
    groups.push({ key: "scope", label: scopeLabel(a.scope), remove: (x) => ({ ...x, scope: "all" }) });
  }
  if (f.category_ids.length > 0) {
    const first = categoryLabel(f.category_ids[0]);
    groups.push({
      key: "categories",
      label: f.category_ids.length === 1 ? first : `${first} +${f.category_ids.length - 1}`,
      remove: (x) => withFilters(x, { category_ids: [] }),
    });
  }
  if (f.min_price_minor != null || f.max_price_minor != null) {
    groups.push({
      key: "price",
      label: priceSummary(f.min_price_minor, f.max_price_minor),
      remove: (x) => withFilters(x, { min_price_minor: null, max_price_minor: null }),
    });
  }
  if (f.open_now) {
    groups.push({ key: "open", label: "Open now", remove: (x) => withFilters(x, { open_now: false }) });
  }
  if (f.in_stock_only) {
    groups.push({
      key: "stock",
      label: "Available items only",
      remove: (x) => withFilters(x, { in_stock_only: false }),
    });
  }
  const sort =
    a.sort === DEFAULT_SORT
      ? null
      : { key: "sort", label: `Sort: ${sortLabel(a.sort)}`, remove: (x: AppliedDiscovery) => ({ ...x, sort: DEFAULT_SORT }) };
  return { groups, sort };
}

// Drops category ids the taxonomy no longer has or the scope excludes.
export function revalidateApplied(
  a: AppliedDiscovery,
  categories: readonly Category[],
): AppliedDiscovery {
  const allowed = new Set(categoriesForScope(categories, a.scope).map((c) => c.id));
  const ids = a.filters.category_ids.filter((id) => allowed.has(id));
  return ids.length === a.filters.category_ids.length ? a : withFilters(a, { category_ids: ids });
}

// ---- Exact failure copy (§17) ----

export type StateKind =
  | "no_query_matches"
  | "filters_exclude"
  | "stores_closed"
  | "not_covered"
  | "offline";

export type StateAction = "clear_search" | "browse_categories" | "reset_filters" | "turn_off_open_now" | "change_dropoff" | "retry";

export const LOADING_COPY = "Updating results...";
export const STALE_CURSOR_COPY = "Results refreshed as availability changed.";

export function stateCopy(
  kind: StateKind,
  query: string,
): { message: string; actions: { id: StateAction; label: string }[] } {
  switch (kind) {
    case "no_query_matches":
      return {
        message: `No matches for "${query.trim()}". Try another name or browse a category.`,
        actions: [
          { id: "clear_search", label: "Clear search" },
          { id: "browse_categories", label: "Browse categories" },
        ],
      };
    case "filters_exclude":
      return {
        message: "Nothing matches these filters. Try a wider price range or remove a filter.",
        actions: [{ id: "reset_filters", label: "Reset filters" }],
      };
    case "stores_closed":
      return {
        message: "Stores nearby are closed. Browse their menus or turn off Open now.",
        actions: [{ id: "turn_off_open_now", label: "Turn off Open now" }],
      };
    case "not_covered":
      return {
        message: "We are not delivering here yet. Choose another supported drop-off point.",
        actions: [{ id: "change_dropoff", label: "Change drop-off" }],
      };
    case "offline":
      return {
        message: "Results could not load. Check your connection and try again.",
        actions: [{ id: "retry", label: "Try again" }],
      };
  }
}

export function showItemsLabel(count: number): string {
  return count === 1 ? "Show 1 item" : `Show ${count} items`;
}
