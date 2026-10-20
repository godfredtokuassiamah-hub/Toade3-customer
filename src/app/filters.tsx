// P12 Filters: a bottom sheet over the screen that opened it. The route is a
// transparentModal (no native animation); the white-glass backdrop and the
// sheet are drawn here (FilterSheetLayout), so the opener stays rendered
// and visible underneath, blurred and whitened. The root-level modal also
// covers the floating tab bar, so nothing underneath re-lays out.
//
// State model (§04):
// - appliedFilters live in discoveryStore and drive the visible results.
// - draftFilters live HERE (useReducer) and die with the screen.
// - preview metadata (count, facets) comes from useDiscoveryPreview and
//   never commits the draft.
// Close / backdrop tap / drag-down / Android back / X all play the exit
// animation and then unmount the screen; the unmount cleanup is the ONE
// discard handler (drops the draft, aborts the pending preview and Apply).
// Applied state and the underlying scroll stay as they were.
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  AccessibilityInfo,
  BackHandler,
  type LayoutChangeEvent,
  type ScrollView,
  StyleSheet,
  Text,
  type TextInput,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useDiscoveryPreview } from "../components/discovery/useDiscoveryPreview";
import { CategoryMultiSelect } from "../components/filters/CategoryMultiSelect";
import { FilterFooter } from "../components/filters/FilterFooter";
import { FilterSheetLayout } from "../components/filters/FilterSheetLayout";
import { PriceRangeSlider } from "../components/filters/PriceRangeSlider";
import { QuickFilterTile } from "../components/filters/QuickFilterTile";
import { RangeFields } from "../components/filters/RangeFields";
import { ScopeSegment } from "../components/filters/ScopeSegment";
import { SortOptions } from "../components/filters/SortOptions";
import { SwitchRow } from "../components/filters/SwitchRow";
import { useFiltersSheetMotion } from "../components/filters/useFiltersSheetMotion";
import { useTabBarSurface } from "../components/navigation/useTabBarSurface";
import { SearchStateView } from "../components/search/SearchStateView";
import {
  getApplied,
  getCachedFacets,
  primeResults,
  setApplied,
  setCachedFacets,
  setPendingP11Results,
  useDiscoveryContext,
} from "../lib/discovery/discoveryStore";
import { bucketEdges, stepMaxBound, stepMinBound } from "../lib/discovery/facets";
import {
  categoriesForScope,
  type DraftAction,
  draftFromApplied,
  draftToApplied,
  isDraftDefault,
  isUpTo50Selected,
  LOADING_COPY,
  makeDraftReducer,
  revalidateApplied,
  showItemsLabel,
  type StateAction,
  type StateKind,
} from "../lib/discovery/filterState";
import { queryFingerprint } from "../lib/discovery/fingerprint";
import { normalizeText } from "../lib/discovery/normalize";
import { buildQueryRequest, HOME_RESULTS_LIMIT, RESULTS_PAGE_SIZE } from "../lib/discovery/request";
import type { DiscoveryScope, DiscoverySurface } from "../lib/discovery/types";
import { selectionHaptic } from "../lib/haptics";
import { discoveryQuery, getCategoryTaxonomy, isAbortError } from "../services/discovery";
import { colors, fontFamily } from "../theme";

const NOTICE_MS = 3000;
const CATEGORIES = getCategoryTaxonomy();
const draftReducer = makeDraftReducer(CATEGORIES);

function isScope(v: string | undefined): v is DiscoveryScope {
  return v === "all" || v === "food" || v === "groceries";
}

type ApplyIntent = {
  editSeq: number;
  revision: number;
  controller: AbortController;
};

export default function FiltersScreen() {
  const params = useLocalSearchParams<{ surface?: string; origin?: string; q?: string; scope?: string }>();
  const surface: DiscoverySurface = params.surface === "search" ? "search" : "home";
  const fromP11 = params.origin === "p11";
  const context = useDiscoveryContext();
  const [openedRevision] = useState(context.revision);

  // Open: clone applied -> draft (P11 passes its typed query and scope).
  const [draft, dispatch] = useReducer(draftReducer, null, () => {
    const applied = getApplied(surface);
    const seed = fromP11
      ? { ...applied, q: params.q ?? applied.q, scope: isScope(params.scope) ? params.scope : applied.scope }
      : applied;
    return draftFromApplied(revalidateApplied(seed, CATEGORIES));
  });

  const titleRef = useRef<Text>(null);
  const scrollRef = useRef<ScrollView>(null);
  const minRef = useRef<TextInput>(null);
  const maxRef = useRef<TextInput>(null);
  const categoriesY = useRef(0);
  const closed = useRef(false);
  const applyIntent = useRef<ApplyIntent | null>(null);
  const latest = useRef({ editSeq: draft.editSeq, revision: context.revision });
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState(false);

  useEffect(() => {
    latest.current = { editSeq: draft.editSeq, revision: context.revision };
  });

  // Backdrop material: the same platform modes as the floating tab bar.
  const mode = useTabBarSurface();

  // Focus the title for screen readers once the sheet has settled; never
  // open the keyboard.
  const focusTitle = useCallback(() => {
    if (titleRef.current) AccessibilityInfo.sendAccessibilityEvent(titleRef.current, "focus");
  }, []);
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
  }, []);
  const motion = useFiltersSheetMotion({ onOpened: focusTitle, onClosed: goBack });
  const closeSheet = motion.close;

  const close = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    closeSheet();
  }, [closeSheet]);

  // Android hardware back closes the sheet (with its exit animation).
  // Focus-scoped, so /location-picker opened over Filters keeps its own back.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        close();
        return true;
      });
      return () => sub.remove();
    }, [close]),
  );

  // The single discard handler (X, swipe, back and context changes all end
  // here via unmount).
  useEffect(
    () => () => {
      applyIntent.current?.controller.abort();
      applyIntent.current = null;
    },
    [],
  );

  // Delivery point changed while open: discard the draft.
  useEffect(() => {
    if (context.revision !== openedRevision) close();
  }, [context.revision, openedRevision, close]);

  // Every edit goes through here: an edit while Apply is running voids it.
  const edit = useCallback((action: DraftAction) => {
    if (applyIntent.current) {
      applyIntent.current.controller.abort();
      applyIntent.current = null;
      setApplying(false);
    }
    setApplyError(false);
    dispatch(action);
  }, []);

  // ---- Preview ----
  const draftApplied = useMemo(() => draftToApplied(draft), [draft]);
  const previewRequest = useMemo(
    () => (draftApplied ? buildQueryRequest(draftApplied, context, surface, "preview", 0, null) : null),
    [draftApplied, context, surface],
  );
  const preview = useDiscoveryPreview(previewRequest);
  const facetKey = `${surface}|${draft.scope}|${normalizeText(draft.q)}`;
  const response = preview.response;
  const facets = response?.facets ?? getCachedFacets(facetKey);

  useEffect(() => {
    if (!response) return;
    setCachedFacets(`${surface}|${response.scope}|${response.query_interpretation.normalized_q}`, response.facets);
  }, [response, surface]);

  const countKnown = draftApplied != null && response != null && !preview.pending && preview.error == null;
  const count = countKnown ? response.item_count : null;
  const updating = draftApplied != null && preview.pending;
  const buttonLabel = count == null ? "Show results" : showItemsLabel(count);

  // Announce counts without moving focus.
  useEffect(() => {
    if (count != null) AccessibilityInfo.announceForAccessibility(showItemsLabel(count));
  }, [count]);

  // "Categories updated for Groceries." (shown + announced, then fades).
  const notice = draft.notice;
  useEffect(() => {
    if (!notice) return;
    AccessibilityInfo.announceForAccessibility(notice.text);
    const t = setTimeout(() => dispatch({ type: "clearNotice" }), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);

  // ---- Apply ----
  const onApply = useCallback(() => {
    if (applyIntent.current) return; // duplicate tap
    if (draft.fieldErrors.min) {
      minRef.current?.focus();
      return;
    }
    if (draft.fieldErrors.max) {
      maxRef.current?.focus();
      return;
    }
    const next = draftToApplied(draft);
    if (!next) return;
    const limit = surface === "home" ? HOME_RESULTS_LIMIT : RESULTS_PAGE_SIZE;
    const req = buildQueryRequest(next, context, surface, "results", limit, null);
    const fingerprint = queryFingerprint(req);
    const intent: ApplyIntent = {
      editSeq: draft.editSeq,
      revision: context.revision,
      controller: new AbortController(),
    };
    applyIntent.current = intent;
    setApplying(true);
    setApplyError(false);
    discoveryQuery(req, intent.controller.signal).then(
      (res) => {
        if (applyIntent.current !== intent) return;
        applyIntent.current = null;
        // Commit only if the draft and the delivery context still match.
        const still =
          latest.current.editSeq === intent.editSeq &&
          latest.current.revision === intent.revision &&
          res.context_revision === intent.revision;
        if (!still) {
          setApplying(false);
          return;
        }
        primeResults(fingerprint, intent.revision, res);
        setApplied(surface, next);
        if (fromP11) setPendingP11Results();
        close();
      },
      (e: unknown) => {
        if (applyIntent.current !== intent || isAbortError(e)) return;
        applyIntent.current = null;
        setApplying(false);
        // The draft is kept; never shown as "no food".
        setApplyError(true);
      },
    );
  }, [draft, surface, context, fromP11, close]);

  // ---- Controls ----
  const onTile = useCallback(
    (id: string) => {
      selectionHaptic();
      edit(id === "open-now" ? { type: "toggleOpenNow" } : { type: "toggleUpTo50" });
    },
    [edit],
  );
  const onScope = useCallback(
    (scope: DiscoveryScope) => {
      if (scope === draft.scope) return;
      selectionHaptic();
      edit({ type: "setScope", scope });
    },
    [edit, draft.scope],
  );
  const price = facets?.price ?? { buckets: [], min: null, max: null };
  const edges = useMemo(() => bucketEdges(price.buckets), [price.buckets]);
  const onCommitBound = useCallback(
    (handle: "min" | "max", value: number | null) => edit({ type: "setBound", handle, value }),
    [edit],
  );
  const { min_price_minor: minBound, max_price_minor: maxBound } = draft.filters;
  const onStep = useCallback(
    (handle: "min" | "max", dir: 1 | -1) => {
      const value =
        handle === "min"
          ? stepMinBound(edges, minBound, maxBound, dir)
          : stepMaxBound(edges, maxBound, minBound, dir);
      edit({ type: "setBound", handle, value });
    },
    [edit, edges, minBound, maxBound],
  );

  const onCategoriesLayout = useCallback((e: LayoutChangeEvent) => {
    categoriesY.current = e.nativeEvent.layout.y;
  }, []);

  let stateKind: StateKind | null = null;
  if (draftApplied && (preview.error || applyError)) stateKind = "offline";
  else if (countKnown && response.item_count === 0) {
    stateKind = response.empty_reason ?? "filters_exclude";
  }

  const onStateAction = useCallback(
    (action: StateAction) => {
      switch (action) {
        case "retry":
          setApplyError(false);
          preview.retry();
          return;
        case "reset_filters":
          edit({ type: "reset" });
          return;
        case "turn_off_open_now":
          edit({ type: "setOpenNow", value: false });
          return;
        case "clear_search":
          edit({ type: "clearQuery" });
          return;
        case "browse_categories":
          scrollRef.current?.scrollTo({ y: Math.max(0, categoriesY.current - 12), animated: true });
          return;
        case "change_dropoff":
          router.push("/location-picker");
          return;
      }
    },
    [edit, preview],
  );

  const scopeCategories = categoriesForScope(CATEGORIES, draft.scope);
  const status = updating ? LOADING_COPY : null;

  return (
    <GestureHandlerRootView style={styles.fill}>
      <StatusBar style="dark" />
      <FilterSheetLayout
        titleRef={titleRef}
        status={status}
        onClose={close}
        scrollRef={scrollRef}
        motion={motion}
        mode={mode}
        renderFooter={(bottomPadding) => (
          <FilterFooter
            label={buttonLabel}
            updating={updating}
            applying={applying}
            resetDisabled={isDraftDefault(draft)}
            onReset={() => edit({ type: "reset" })}
            onApply={onApply}
            bottomPadding={bottomPadding}
          />
        )}
      >
        {stateKind ? (
          <View style={styles.stateBox}>
            <SearchStateView kind={stateKind} query={draft.q} onAction={onStateAction} compact />
          </View>
        ) : null}

        <Text style={styles.sectionTitle} accessibilityRole="header">
          Quick filters
        </Text>
        <View style={styles.tiles}>
          <QuickFilterTile
            id="open-now"
            label="Open now"
            icon="clock"
            selected={draft.filters.open_now}
            onPress={onTile}
          />
          <QuickFilterTile
            id="up-to-50"
            label="Up to GHS 50"
            icon="banknote"
            selected={isUpTo50Selected(draft)}
            onPress={onTile}
          />
          {/* Offers is capability-gated (OFFERS_AVAILABLE = false): no
              versioned sale prices exist, so there is no tile. */}
        </View>

        <View style={styles.divider} />
        <Text style={styles.sectionTitle} accessibilityRole="header">
          What would you like?
        </Text>
        <ScopeSegment value={draft.scope} onChange={onScope} />
        {notice ? (
          <Text style={styles.notice} accessibilityLiveRegion="polite">
            {notice.text}
          </Text>
        ) : null}

        <View style={styles.divider} />
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Price range
        </Text>
        <Text style={styles.subtitle}>Item price, excluding delivery</Text>
        <Text style={styles.chartLabel}>Item prices near you</Text>
        <PriceRangeSlider
          price={price}
          min={minBound}
          max={maxBound}
          onCommit={onCommitBound}
          onStep={onStep}
        />
        <RangeFields
          minText={draft.minText}
          maxText={draft.maxText}
          errors={draft.fieldErrors}
          highestPrice={price.max}
          onMinChange={(text) => edit({ type: "setMinText", text })}
          onMaxChange={(text) => edit({ type: "setMaxText", text })}
          minRef={minRef}
          maxRef={maxRef}
        />

        <View style={styles.divider} />
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Narrow your results
        </Text>
        <View onLayout={onCategoriesLayout}>
          <CategoryMultiSelect
            categories={scopeCategories}
            facets={facets?.categories ?? null}
            selectedIds={draft.filters.category_ids}
            onToggle={(id) => edit({ type: "toggleCategory", id })}
          />
        </View>
        <View style={styles.switches}>
          <SwitchRow
            label="Open now"
            hint="Stores accepting orders right now."
            value={draft.filters.open_now}
            onChange={(value) => edit({ type: "setOpenNow", value })}
          />
          <SwitchRow
            label="Available items only"
            hint="Hide sold-out and unavailable items."
            value={draft.filters.in_stock_only}
            onChange={(value) => edit({ type: "setInStock", value })}
          />
        </View>
        <Text style={[styles.groupLabel]}>Sort by</Text>
        <SortOptions value={draft.sort} onChange={(sort) => edit({ type: "setSort", sort })} />
      </FilterSheetLayout>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    // Transparent so the opener shows through the white-glass backdrop.
    backgroundColor: "transparent",
  },
  stateBox: {
    marginTop: 8,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 12,
    fontFamily: fontFamily.bold,
    fontSize: 20,
    color: colors.text,
  },
  subtitle: {
    marginTop: -8,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
  chartLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
  tiles: {
    flexDirection: "row",
    gap: 12,
  },
  notice: {
    marginTop: 10,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.primary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
    marginTop: 24,
  },
  switches: {
    marginTop: 12,
  },
  groupLabel: {
    marginTop: 16,
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
});
