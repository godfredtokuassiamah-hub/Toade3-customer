// P11 Search (transparent modal over Home): query, scope, recent searches,
// typeahead suggestions and the categories browse. Filters live in the
// separate P12 sheet (/filters), opened from the footer's "Filters" entry.
// The typed query and scope are a local draft; submitting commits them to
// the applied search and opens the results.
import { BlurView } from "expo-blur";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useFiltersTrigger } from "../components/filters/useFiltersTrigger";
import { ScopeTabs } from "../components/search/ScopeTabs";
import { SearchField } from "../components/search/SearchField";
import { BrowseCategories, RecentSearches, SuggestionList } from "../components/search/SearchLists";
import { searchStyles } from "../components/search/searchStyles";
import { useDebouncedRequest } from "../components/search/useDebouncedRequest";
import { Icon } from "../components/ui/Icon";
import {
  consumePendingP11Results,
  getApplied,
  setApplied,
  useDiscoveryContext,
} from "../lib/discovery/discoveryStore";
import {
  type AppliedDiscovery,
  appliedGroupCount,
  categoriesForScope,
  revalidateApplied,
} from "../lib/discovery/filterState";
import { normalizeText } from "../lib/discovery/normalize";
import { MAX_QUERY_LENGTH, MIN_SUGGEST_LENGTH } from "../lib/discovery/oracle";
import { buildSuggestionsRequest } from "../lib/discovery/request";
import type { DiscoveryScope } from "../lib/discovery/types";
import { selectionHaptic } from "../lib/haptics";
import { addRecentSearch, loadRecentSearches, saveRecentSearches } from "../lib/search/recentSearches";
import { discoverySuggestions, getCategoryTaxonomy } from "../services/discovery";
import { colors, fontFamily } from "../theme";

type Notice = { id: number; text: string };

const DEBOUNCE_MS = 250;
const NOTICE_MS = 3000;
// Collapsed main card shows a short preview; the expanded card shows all.
const PREVIEW_RECENTS = 3;
const PREVIEW_CATEGORIES = 5;
const CATEGORIES = getCategoryTaxonomy();

export default function SearchScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromResults = from === "results";
  const insets = useSafeAreaInsets();
  const context = useDiscoveryContext();

  // From Home, a new search starts from Home's applied filters.
  const [base] = useState<AppliedDiscovery>(() =>
    fromResults ? getApplied("search") : { ...getApplied("home"), q: "" },
  );
  const [query, setQuery] = useState(base.q);
  const [scope, setScope] = useState<DiscoveryScope>(base.scope);
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [recents, setRecents] = useState<string[]>([]);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Real history only; empty for a new customer (section hidden).
  useEffect(() => {
    let cancelled = false;
    void loadRecentSearches().then((list) => {
      if (!cancelled) setRecents(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);

  const collapseSearch = useCallback(() => {
    inputRef.current?.blur();
    setExpanded(false);
  }, []);

  // Android back collapses the expanded search before closing the sheet.
  useEffect(() => {
    if (!expanded) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      collapseSearch();
      return true;
    });
    return () => sub.remove();
  }, [expanded, collapseSearch]);

  const remember = useCallback(
    (q: string) => {
      if (q === "") return;
      const list = addRecentSearch(recents, q);
      setRecents(list);
      void saveRecentSearches(list);
    },
    [recents],
  );

  const openResults = useCallback(() => {
    Keyboard.dismiss();
    if (fromResults) router.back();
    else router.replace("/search-results");
  }, [fromResults]);

  // P11 -> Filters -> Apply: Filters committed the applied search; open it.
  useFocusEffect(
    useCallback(() => {
      if (!consumePendingP11Results()) return;
      remember(getApplied("search").q);
      openResults();
    }, [remember, openResults]),
  );

  const draftApplied = useMemo(
    () => revalidateApplied({ ...base, q: query.trim(), scope }, CATEGORIES),
    [base, query, scope],
  );

  // Submit (explicit search: 1-120 chars; blank = browse everything).
  const commit = useCallback(
    (next: AppliedDiscovery) => {
      remember(next.q);
      setApplied("search", next);
      openResults();
    },
    [remember, openResults],
  );
  const onSubmit = useCallback(() => commit(draftApplied), [commit, draftApplied]);
  const runQuery = useCallback(
    (text: string) => commit({ ...draftApplied, q: text.trim().slice(0, MAX_QUERY_LENGTH) }),
    [commit, draftApplied],
  );
  const onBrowseCategory = useCallback(
    (id: string) => commit({ ...draftApplied, filters: { ...draftApplied.filters, category_ids: [id] } }),
    [commit, draftApplied],
  );
  // TODO(item): open item detail once the screen exists.
  const onItem = useCallback(() => setNotice({ id: Date.now(), text: "Item details are coming soon." }), []);
  // TODO(store): open the storefront once the screen exists.
  const onStore = useCallback(() => setNotice({ id: Date.now(), text: "Storefronts are coming soon." }), []);
  const clearHistory = useCallback(() => {
    setRecents([]);
    void saveRecentSearches([]);
  }, []);

  const onScope = useCallback(
    (next: DiscoveryScope) => {
      if (next === scope) return;
      selectionHaptic();
      setScope(next);
    },
    [scope],
  );

  // Focus returns to the footer "Filters" control when the sheet closes.
  const { triggerRef: filtersRef, openFilters: pushFilters } = useFiltersTrigger();
  const openFilters = useCallback(() => {
    Keyboard.dismiss();
    pushFilters({ surface: "search", origin: "p11", q: query.trim(), scope });
  }, [query, scope, pushFilters]);

  // --- Typeahead (2+ characters, bounded, labelled groups) ---
  const normalized = normalizeText(query);
  const suggestParams = useMemo(
    () =>
      expanded && normalized.length >= MIN_SUGGEST_LENGTH
        ? buildSuggestionsRequest(draftApplied, context)
        : null,
    [expanded, normalized, draftApplied, context],
  );
  const suggestions = useDebouncedRequest(suggestParams, discoverySuggestions, DEBOUNCE_MS);

  const scopeCategories = categoriesForScope(CATEGORIES, scope);
  const showSuggestions = expanded && normalized.length >= MIN_SUGGEST_LENGTH;
  const filterCount = appliedGroupCount({ ...draftApplied, scope: "all" });

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {Platform.OS === "ios" ? (
        <>
          <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.iosTint]} />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.androidTint]} />
      )}
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <View style={{ paddingTop: insets.top }} />
        {!expanded ? (
          <View style={styles.topBar}>
            <ScopeTabs value={scope} onChange={onScope} />
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Close search"
              hitSlop={8}
              style={({ pressed }) => [styles.close, pressed && searchStyles.pressed]}
            >
              <Icon name="close" size={16} color={colors.text} weight="semibold" />
            </Pressable>
          </View>
        ) : null}
        <ScrollView
          style={styles.fill}
          contentContainerStyle={[styles.scroll, expanded && styles.scrollExpanded]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={expanded ? "none" : "on-drag"}
          showsVerticalScrollIndicator={false}
        >
          <View style={[searchStyles.card, styles.mainCard, expanded && styles.mainCardExpanded]}>
            {!expanded ? (
              <View style={styles.intro}>
                <Text style={styles.title} accessibilityRole="header">
                  What are you looking for?
                </Text>
                <Text style={[searchStyles.muted, styles.subtitle]}>
                  Find meals, groceries and stores near your drop-off.
                </Text>
              </View>
            ) : null}
            <SearchField
              inputRef={inputRef}
              value={query}
              onChangeText={(t) => setQuery(t.slice(0, MAX_QUERY_LENGTH))}
              onSubmit={onSubmit}
              onFocus={() => setExpanded(true)}
              expanded={expanded}
              onBack={collapseSearch}
            />
            {notice ? (
              <Text style={styles.notice} accessibilityLiveRegion="polite">
                {notice.text}
              </Text>
            ) : null}
            {showSuggestions ? (
              suggestions.data ? (
                <SuggestionList
                  suggestions={suggestions.data}
                  onQuery={runQuery}
                  onItem={onItem}
                  onStore={onStore}
                />
              ) : (
                <Text style={[searchStyles.muted, styles.hint]}>Finding matches…</Text>
              )
            ) : (
              <View>
                <RecentSearches
                  terms={expanded ? recents : recents.slice(0, PREVIEW_RECENTS)}
                  onSelect={runQuery}
                  onClear={clearHistory}
                />
                <BrowseCategories
                  categories={expanded ? scopeCategories : scopeCategories.slice(0, PREVIEW_CATEGORIES)}
                  onSelect={onBrowseCategory}
                />
              </View>
            )}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: keyboardOpen ? 12 : Math.max(insets.bottom, 12) }]}>
          <Pressable
            ref={filtersRef}
            onPress={openFilters}
            accessibilityRole="button"
            accessibilityLabel={`Filters, ${filterCount} applied`}
            style={({ pressed }) => [styles.filters, pressed && searchStyles.pressed]}
          >
            <Icon name="filter" size={16} color={colors.text} />
            <Text style={styles.filtersText}>{filterCount > 0 ? `Filters (${filterCount})` : "Filters"}</Text>
          </Pressable>
          <Pressable
            onPress={onSubmit}
            accessibilityRole="button"
            accessibilityLabel={query.trim() ? `Search for ${query.trim()}` : "Show all results"}
            style={({ pressed }) => [styles.show, pressed && styles.showPressed]}
          >
            <Icon name="search" size={16} color={colors.white} weight="semibold" />
            <Text style={styles.showText}>{query.trim() ? "Search" : "Show all"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  iosTint: {
    backgroundColor: "rgba(247,247,247,0.55)",
  },
  androidTint: {
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  topBar: {
    paddingTop: 6,
    // Extra gap so the card doesn't crowd the All/Food/Groceries tabs.
    paddingBottom: 24,
    paddingHorizontal: 64,
    justifyContent: "center",
  },
  close: {
    position: "absolute",
    right: 16,
    top: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.tabBarShadow,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  scroll: {
    paddingTop: 4,
    paddingBottom: 24,
  },
  scrollExpanded: {
    flexGrow: 1,
    paddingTop: 8,
  },
  mainCard: {
    padding: 20,
  },
  mainCardExpanded: {
    flexGrow: 1,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 24,
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
  },
  // Gap between the title block and the search field.
  intro: {
    marginBottom: 16,
  },
  notice: {
    marginTop: 10,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.primary,
  },
  hint: {
    marginTop: 20,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingTop: 12,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  filters: {
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#DDDDDD",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
  },
  filtersText: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  show: {
    flexShrink: 1,
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  showPressed: {
    opacity: 0.85,
  },
  showText: {
    flexShrink: 1,
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.white,
  },
});
