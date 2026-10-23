// Results for the applied search: removable group chips (+ the uncounted
// sort label), the query interpretation note and a flat, cursor-paginated
// 2-column items grid. Root stack route above the tabs.
//
// Pages are appended only when they come from the same fingerprint, context
// revision and data revision. A stale cursor refreshes page one and says
// "Results refreshed as availability changed."
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CartBar } from "../components/cart/CartBar";
import { useCartBarInset } from "../components/cart/useCartBarInset";
import { AppliedChipsRow } from "../components/discovery/AppliedChipsRow";
import { toFoodCardItem } from "../components/discovery/cardItem";
import { useFiltersTrigger } from "../components/filters/useFiltersTrigger";
import { FoodCard } from "../components/home/FoodCard";
import { SearchLoading, SearchStateView } from "../components/search/SearchStateView";
import { searchStyles } from "../components/search/searchStyles";
import { Icon } from "../components/ui/Icon";
import {
  getResultsScroll,
  saveResultsScroll,
  setApplied,
  takePrimedResults,
  useApplied,
  useDiscoveryContext,
} from "../lib/discovery/discoveryStore";
import {
  type AppliedDiscovery,
  appliedGroupCount,
  DEFAULT_APPLIED,
  STALE_CURSOR_COPY,
  type StateAction,
  type StateKind,
} from "../lib/discovery/filterState";
import { queryFingerprint } from "../lib/discovery/fingerprint";
import { createRequestTracker } from "../lib/discovery/raceGuard";
import { buildQueryRequest, RESULTS_PAGE_SIZE } from "../lib/discovery/request";
import { DiscoveryError, type DiscoveryItem, type DiscoveryQueryResponse } from "../lib/discovery/types";
import { discoveryQuery, isAbortError } from "../services/discovery";
import { colors, fontFamily } from "../theme";

const SIDE = 14;
const GAP = 10;
const NOTICE_MS = 4000;

type Loaded = {
  key: string;
  response: DiscoveryQueryResponse | null;
  items: DiscoveryItem[];
  error: boolean;
};

const itemKey = (item: DiscoveryItem) => item.item_id;

export default function SearchResults() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const applied = useApplied("search");
  const context = useDiscoveryContext();
  const cartInset = useCartBarInset();

  const firstPage = useMemo(
    () => buildQueryRequest(applied, context, "search", "results", RESULTS_PAGE_SIZE, null),
    [applied, context],
  );
  const fingerprint = queryFingerprint(firstPage);
  const key = `${fingerprint}|${context.revision}`;

  const [loaded, setLoaded] = useState<Loaded>({ key: "", response: null, items: [], error: false });
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tracker] = useState(createRequestTracker);
  const listRef = useRef<FlatList<DiscoveryItem>>(null);
  const moreController = useRef<AbortController | null>(null);
  const current = useRef({ fingerprint, contextRevision: context.revision });

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);

  // First page whenever the applied search or the drop-off changes. The
  // Apply response is reused when it matches (same snapshot, no refetch).
  useEffect(() => {
    const req = firstPage;
    const fp = queryFingerprint(req);
    current.current = { fingerprint: fp, contextRevision: req.context_revision };
    moreController.current?.abort();
    const token = tracker.next(fp, req.context_revision);
    const controller = new AbortController();
    const primed = attempt === 0 ? takePrimedResults(fp, req.context_revision) : null;
    const pending = primed ? Promise.resolve(primed) : discoveryQuery(req, controller.signal);
    pending.then(
      (response) => {
        if (!tracker.accept(token, response.context_revision, current.current)) return;
        const k = `${fp}|${req.context_revision}`;
        setLoaded({ key: k, response, items: response.items ?? [], error: false });
        setLoadingMore(false);
        // Coming back to the same search restores the scroll position.
        const offset = getResultsScroll(k);
        if (offset > 0) {
          requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset, animated: false }));
        }
      },
      (e: unknown) => {
        if (isAbortError(e) || !tracker.accept(token, req.context_revision, current.current)) return;
        setLoaded({ key: `${fp}|${req.context_revision}`, response: null, items: [], error: true });
      },
    );
    return () => controller.abort();
  }, [firstPage, attempt, tracker]);

  const isCurrent = loaded.key === key;
  const response = isCurrent ? loaded.response : null;
  const items = isCurrent ? loaded.items : [];
  const error = isCurrent && loaded.error;
  const loading = !isCurrent;

  const onEndReached = useCallback(() => {
    const cursor = response?.next_cursor;
    if (!cursor || loadingMore || !response) return;
    setLoadingMore(true);
    const controller = new AbortController();
    moreController.current = controller;
    const req = { ...firstPage, cursor };
    const pageKey = key;
    const revision = response.revision;
    discoveryQuery(req, controller.signal).then(
      (page) => {
        if (controller.signal.aborted) return;
        setLoaded((l) => {
          // Never append a page from another query or snapshot.
          if (l.key !== pageKey || !l.response || page.revision !== revision) return l;
          const seen = new Set(l.items.map((i) => i.item_id));
          return {
            ...l,
            response: { ...l.response, next_cursor: page.next_cursor },
            items: [...l.items, ...(page.items ?? []).filter((i) => !seen.has(i.item_id))],
          };
        });
        setLoadingMore(false);
      },
      (e: unknown) => {
        if (controller.signal.aborted || isAbortError(e)) return;
        setLoadingMore(false);
        if (e instanceof DiscoveryError && e.code === "CURSOR_STALE") {
          // Refresh page one; drop the mixed list.
          setNotice(STALE_CURSOR_COPY);
          listRef.current?.scrollToOffset({ offset: 0, animated: false });
          setAttempt((a) => a + 1);
        }
      },
    );
  }, [response, loadingMore, firstPage, key]);

  const saveScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => saveResultsScroll(key, e.nativeEvent.contentOffset.y),
    [key],
  );

  const update = useCallback((next: AppliedDiscovery) => setApplied("search", next), []);
  const filterCount = appliedGroupCount(applied);
  const cardWidth = Math.floor((width - SIDE * 2 - GAP) / 2);

  const openSearch = useCallback(() => {
    router.push({ pathname: "/search", params: { from: "results" } });
  }, []);
  // Focus returns to the "Filters (N)" button when the sheet closes.
  const { triggerRef: filtersRef, openFilters: pushFilters } = useFiltersTrigger();
  const openFilters = useCallback(() => pushFilters({ surface: "search" }), [pushFilters]);

  let stateKind: StateKind | null = null;
  if (error) stateKind = "offline";
  else if (response && response.item_count === 0) stateKind = response.empty_reason ?? "filters_exclude";

  const onStateAction = useCallback(
    (action: StateAction) => {
      switch (action) {
        case "retry":
          setAttempt((a) => a + 1);
          return;
        case "clear_search":
          update({ ...applied, q: "" });
          return;
        case "browse_categories":
          openSearch();
          return;
        case "reset_filters":
          // Neutral defaults; the query stays.
          update({ ...DEFAULT_APPLIED, q: applied.q });
          return;
        case "turn_off_open_now":
          update({ ...applied, filters: { ...applied.filters, open_now: false } });
          return;
        case "change_dropoff":
          router.push("/location-picker");
          return;
      }
    },
    [applied, update, openSearch],
  );

  const renderItem = useCallback<ListRenderItem<DiscoveryItem>>(
    ({ item }) => <FoodCard item={toFoodCardItem(item)} width={cardWidth} showFavourite />,
    [cardWidth],
  );

  const interpretation = response?.query_interpretation;
  const header = (
    <View>
      {notice ? (
        <Text style={styles.notice} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}
      {interpretation?.corrected_q ? (
        <Text style={styles.correction} accessibilityLiveRegion="polite">
          Showing results for <Text style={styles.correctionStrong}>{interpretation.corrected_q}</Text>.
        </Text>
      ) : null}
      {interpretation?.suggested_q ? (
        <Pressable
          onPress={() => update({ ...applied, q: interpretation.suggested_q ?? applied.q })}
          accessibilityRole="button"
          accessibilityLabel={`Did you mean ${interpretation.suggested_q}? Search for it`}
          style={({ pressed }) => [styles.suggestion, pressed && searchStyles.pressed]}
        >
          <Text style={styles.correction}>
            Did you mean <Text style={styles.suggestionStrong}>{interpretation.suggested_q}</Text>?
          </Text>
        </Pressable>
      ) : null}
      {response && response.item_count > 0 ? (
        <Text style={styles.groupTitle} accessibilityRole="header" accessibilityLiveRegion="polite">
          {response.item_count === 1 ? "1 item" : `${response.item_count} items`}
        </Text>
      ) : null}
    </View>
  );

  let empty = null;
  if (loading) empty = <SearchLoading />;
  else if (stateKind) empty = <SearchStateView kind={stateKind} query={applied.q} onAction={onStateAction} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={4}
          style={({ pressed }) => [styles.iconButton, pressed && searchStyles.pressed]}
        >
          <Icon name="arrowLeft" size={20} color={colors.text} weight="medium" />
        </Pressable>
        <Pressable
          onPress={openSearch}
          accessibilityRole="search"
          accessibilityLabel={applied.q ? `Search, ${applied.q}. Edit search` : "Edit search"}
          style={({ pressed }) => [styles.queryPill, pressed && searchStyles.pressed]}
        >
          <Icon name="search" size={16} color={colors.text} />
          <Text style={[styles.queryText, !applied.q && styles.queryPlaceholder]} numberOfLines={1}>
            {applied.q || "All results"}
          </Text>
        </Pressable>
        <Pressable
          ref={filtersRef}
          onPress={openFilters}
          accessibilityRole="button"
          accessibilityLabel={`Filters, ${filterCount} applied`}
          style={({ pressed }) => [styles.filtersButton, pressed && searchStyles.pressed]}
        >
          <Icon name="filter" size={16} color={colors.text} />
          <Text style={styles.filtersText}>Filters ({filterCount})</Text>
        </Pressable>
      </View>
      <AppliedChipsRow applied={applied} onChange={update} sidePadding={SIDE} />
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={itemKey}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.column}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.more} color={colors.primary} /> : null}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        onScrollEndDrag={saveScroll}
        onMomentumScrollEnd={saveScroll}
        initialNumToRender={8}
        windowSize={9}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 + cartInset }]}
      />
      <CartBar placement="stack" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: SIDE,
    paddingVertical: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  queryPill: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
  },
  queryText: {
    flexShrink: 1,
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.text,
  },
  queryPlaceholder: {
    color: colors.textMuted,
  },
  filtersButton: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#DDDDDD",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  filtersText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.text,
  },
  content: {
    paddingHorizontal: SIDE,
    paddingTop: 4,
  },
  column: {
    gap: GAP,
    marginBottom: GAP,
  },
  notice: {
    marginTop: 8,
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: colors.primary,
  },
  correction: {
    marginTop: 8,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
  correctionStrong: {
    fontFamily: fontFamily.bold,
    color: colors.text,
  },
  suggestion: {
    minHeight: 44,
    justifyContent: "center",
  },
  suggestionStrong: {
    fontFamily: fontFamily.bold,
    color: colors.primary,
  },
  groupTitle: {
    marginTop: 16,
    marginBottom: 10,
    fontFamily: fontFamily.bold,
    fontSize: 17,
    color: colors.text,
  },
  more: {
    paddingVertical: 16,
  },
});
