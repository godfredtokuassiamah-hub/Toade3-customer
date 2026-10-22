// Stores tab: a directory of stores (not dishes). Pinned title, then one
// virtualized FlatList like Home: search + filter, sideways category tiles,
// banner, swiping store sections (second banner after the 2nd section).
// Fees and times are display estimates (lib/stores/deliveryQuote) from the
// confirmed drop-off, or central Accra until one is set.
import { router, useScrollToTop } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList,
  type ListRenderItem,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PromoBanner } from "../../components/home/PromoBanner";
import { SearchRow } from "../../components/home/SearchRow";
import { SectionHeader } from "../../components/home/SectionHeader";
import { getTabBarClearance } from "../../components/navigation/tabBarMetrics";
import { StoreCategoryTiles } from "../../components/stores/StoreCategoryTiles";
import { StoreCard } from "../../components/stores/StoreCard";
import { openStorefront, StoreRow } from "../../components/stores/StoreRow";
import { useDropoff } from "../../components/stores/useDropoff";
import { Icon } from "../../components/ui/Icon";
import { homeData } from "../../data/mock/home";
import { STORE_CATEGORY_LABELS, STORES, type StoreCategory } from "../../data/mock/stores";
import {
  buildStoreSections,
  type QuotedStore,
  quoteStores,
  type StoreSection,
} from "../../lib/stores/storeSections";
import { colors, fontFamily } from "../../theme";

type Row =
  | { key: string; type: "search" }
  | { key: string; type: "tiles" }
  | { key: string; type: "filterNote"; category: StoreCategory }
  | { key: string; type: "banner"; banner: typeof homeData.banners.top }
  | { key: string; type: "section"; section: StoreSection }
  | { key: string; type: "store"; item: QuotedStore }
  | { key: string; type: "empty" };

const keyExtractor = (row: Row) => row.key;

export default function Stores() {
  const insets = useSafeAreaInsets();
  const { fontScale, width } = useWindowDimensions();
  // Tapping the focused Stores tab scrolls back to the top. No scroll-driven
  // tab-bar compaction: Home doesn't use it either.
  const listRef = useRef<FlatList<Row>>(null);
  useScrollToTop(listRef);

  const { dropoff, exact, ready } = useDropoff();
  const [category, setCategory] = useState<StoreCategory | null>(null);
  const toggleCategory = useCallback(
    (id: StoreCategory) => setCategory((current) => (current === id ? null : id)),
    [],
  );

  const sections = useMemo(
    () => buildStoreSections(STORES, dropoff, category),
    [dropoff, category],
  );

  // With a category selected, show ONLY that category's stores in one list
  // (nearest first). The mixed sections repeat the same stores under
  // generic titles like "Near you", which read as "not filtered".
  const categoryStores = useMemo(
    () =>
      category
        ? quoteStores(STORES, dropoff).filter((s) => s.store.category === category)
        : [],
    [dropoff, category],
  );

  const data = useMemo<Row[]>(() => {
    const rows: Row[] = [
      { key: "search", type: "search" },
      { key: "tiles", type: "tiles" },
    ];
    if (category) {
      rows.push({ key: "filterNote", type: "filterNote", category });
      categoryStores.forEach((item) =>
        rows.push({ key: `store-${item.store.id}`, type: "store", item }),
      );
      if (categoryStores.length === 0) rows.push({ key: "empty", type: "empty" });
      return rows;
    }
    rows.push({ key: "banner-top", type: "banner", banner: homeData.banners.top });
    sections.forEach((section, index) => {
      rows.push({ key: `section-${section.id}`, type: "section", section });
      if (index === 1) {
        rows.push({ key: "banner-middle", type: "banner", banner: homeData.banners.middle });
      }
    });
    if (sections.length === 0) rows.push({ key: "empty", type: "empty" });
    return rows;
  }, [sections, category, categoryStores]);

  const openSection = useCallback(
    (id: StoreSection["id"]) => {
      router.push({
        pathname: "/stores-list",
        params: category ? { section: id, category } : { section: id },
      });
    },
    [category],
  );

  const renderItem = useCallback<ListRenderItem<Row>>(
    ({ item }) => {
      switch (item.type) {
        case "search":
          // TODO(stores): store-specific search and filters arrive with the
          // stores API; these open the catalog search and Home filters.
          return <SearchRow />;
        case "tiles":
          return <StoreCategoryTiles selected={category} onToggle={toggleCategory} />;
        case "filterNote":
          return (
            <View style={styles.filterNote}>
              <Text style={styles.filterNoteText} accessibilityLiveRegion="polite">
                Showing {STORE_CATEGORY_LABELS[item.category]} stores
              </Text>
              <Pressable
                onPress={() => setCategory(null)}
                accessibilityRole="button"
                accessibilityLabel="Clear store category"
                hitSlop={12}
                style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
              >
                <Icon name="close" size={14} color={colors.text} weight="semibold" />
              </Pressable>
            </View>
          );
        case "banner":
          return (
            <View style={styles.banner}>
              <PromoBanner banner={item.banner} />
            </View>
          );
        case "section":
          return (
            <View>
              <SectionHeader
                title={item.section.title}
                actionLabel="See all"
                onViewAll={() => openSection(item.section.id)}
              />
              <StoreRow stores={item.section.stores} />
            </View>
          );
        case "store":
          return (
            <View style={styles.storeItem}>
              <StoreCard item={item.item} width={width - 28} onPress={openStorefront} />
            </View>
          );
        case "empty":
          return <Text style={styles.empty}>No stores in this category yet.</Text>;
      }
    },
    [category, toggleCategory, openSection, width],
  );

  const contentStyle = useMemo(
    () => ({ paddingTop: 4, paddingBottom: getTabBarClearance(insets.bottom, fontScale) }),
    [insets.bottom, fontScale],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Stores
        </Text>
        {ready && !exact ? (
          <Pressable
            onPress={() => router.push("/location-picker")}
            accessibilityRole="link"
            accessibilityLabel="Set your drop-off for exact prices"
            style={({ pressed }) => [styles.hint, pressed && styles.pressed]}
          >
            <Icon name="pin" size={13} color={colors.primary} />
            <Text style={styles.hintText}>Set your drop-off for exact prices</Text>
          </Pressable>
        ) : null}
      </View>
      {/* getItemLayout omitted: banner and section heights vary. */}
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        initialNumToRender={5}
        maxToRenderPerBatch={3}
        windowSize={9}
        // No removeClippedSubviews / maintainVisibleContentPosition (both
        // crashed the nested-carousel Home feed).
        contentContainerStyle={contentStyle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  storeItem: {
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 24,
    color: colors.text,
  },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    minHeight: 32,
  },
  hintText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.primary,
  },
  filterNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 14,
  },
  filterNoteText: {
    flexShrink: 1,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.text,
  },
  clear: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  banner: {
    marginTop: 14,
  },
  empty: {
    marginTop: 24,
    paddingHorizontal: 14,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.7,
  },
});
