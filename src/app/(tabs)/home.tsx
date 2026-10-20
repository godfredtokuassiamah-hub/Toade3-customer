import { router, useScrollToTop } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import {
  FlatList,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppliedChipsRow } from "../../components/discovery/AppliedChipsRow";
import { CategoryGrid } from "../../components/home/CategoryGrid";
import { FilteredLoading, FilteredModule } from "../../components/home/FilteredHome";
import { FoodRow } from "../../components/home/FoodRow";
import {
  buildFilteredFeed,
  buildHomeFeed,
  type FilteredFeedItem,
  type HomeFeedItem,
} from "../../components/home/homeFeed";
import { HomeTopBar } from "../../components/home/HomeTopBar";
import { PopularPlaces } from "../../components/home/PopularPlaces";
import { PromoBanner } from "../../components/home/PromoBanner";
import { SearchRow } from "../../components/home/SearchRow";
import { SectionHeader } from "../../components/home/SectionHeader";
import { useFilteredHome } from "../../components/home/useFilteredHome";
import { useHomeUser } from "../../components/home/useHomeUser";
import { useUserLocation } from "../../components/home/useUserLocation";
import { getTabBarClearance } from "../../components/navigation/tabBarMetrics";
import { SearchStateView } from "../../components/search/SearchStateView";
import { homeData } from "../../data/mock/home";
import type { HomeShortcut } from "../../data/home/categoryShortcuts";
import { setApplied, useApplied } from "../../lib/discovery/discoveryStore";
import {
  type AppliedDiscovery,
  appliedGroupCount,
  DEFAULT_APPLIED,
  isAppliedDefault,
  type StateAction,
} from "../../lib/discovery/filterState";
import { useDeliveryAddress } from "../../lib/location/DeliveryAddressContext";
import { pickLocationLabel } from "../../lib/places/locationLabel";
import { colors } from "../../theme";

const FEED = buildHomeFeed(homeData);

// Static feed rows, or the server-filtered rows once Home has filters.
type Row = HomeFeedItem | FilteredFeedItem;

const keyExtractor = (item: Row) => item.key;

// Feed row wrapper. No `entering` layout animation: Reanimated layout
// animations on cells that FlatList virtualization mounts/unmounts while
// scrolling crash the app natively.
function Block({
  children,
}: {
  index?: number;
  animate?: boolean;
  children: ReactNode;
}) {
  return <View>{children}</View>;
}

// Home tab. The top bar is pinned above the feed and the floating tab bar
// overlays the bottom, so only the content between them scrolls.
export default function Home() {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  // Tapping the focused Home tab scrolls back to the top.
  const listRef = useRef<FlatList<Row>>(null);
  useScrollToTop(listRef);

  // Plain JS onScroll on a plain FlatList (no Reanimated scroll worklet).
  // It only feeds the top-bar hairline, written only when it flips, so this
  // costs nothing per frame. The tab bar no longer reacts to scroll.
  const scrollY = useSharedValue(0);
  const scrolledRef = useRef(false);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const scrolled = e.nativeEvent.contentOffset.y > 4;
      if (scrolled !== scrolledRef.current) {
        scrolledRef.current = scrolled;
        scrollY.set(scrolled ? 12 : 0);
      }
    },
    [scrollY],
  );
  const entranceDone = true;

  // Sized for the expanded bar and never tied to compaction, so the bar
  // animating can't shift the feed; the last card clears it fully.
  const contentStyle = useMemo(
    () => ({
      paddingTop: 8,
      paddingBottom: getTabBarClearance(insets.bottom, fontScale),
    }),
    [insets.bottom, fontScale],
  );

  // Applied Home filters: with none, Home stays the static mock feed.
  const appliedHome = useApplied("home");
  const filtered = !isAppliedDefault(appliedHome);
  const filterCount = appliedGroupCount(appliedHome);
  const filteredHome = useFilteredHome(appliedHome, filtered);
  const data = useMemo<Row[]>(
    () =>
      filtered
        ? buildFilteredFeed(filteredHome.response, filteredHome.loading, filteredHome.error)
        : FEED,
    [filtered, filteredHome.response, filteredHome.loading, filteredHome.error],
  );
  const updateHome = useCallback((next: AppliedDiscovery) => setApplied("home", next), []);
  const retryHome = filteredHome.retry;
  const onStateAction = useCallback(
    (action: StateAction) => {
      switch (action) {
        case "retry":
          retryHome();
          return;
        case "reset_filters":
          updateHome(DEFAULT_APPLIED);
          return;
        case "turn_off_open_now":
          updateHome({ ...appliedHome, filters: { ...appliedHome.filters, open_now: false } });
          return;
        case "change_dropoff":
          router.push("/location-picker");
          return;
        case "clear_search":
        case "browse_categories":
          router.push("/search");
          return;
      }
    },
    [retryHome, updateHome, appliedHome],
  );
  // Category-grid tile: Favourites opens its screen; a scope/category tile
  // sets the applied SEARCH from neutral defaults and opens the results.
  const onSelectShortcut = useCallback((shortcut: HomeShortcut) => {
    const target = shortcut.target;
    if (target.kind === "favourites") {
      router.push("/favourites");
      return;
    }
    const categoryIds = target.kind === "category" ? [target.categoryId] : [];
    setApplied("search", {
      ...DEFAULT_APPLIED,
      scope: target.scope,
      filters: { ...DEFAULT_APPLIED.filters, category_ids: categoryIds },
    });
    router.push("/search-results");
  }, []);

  // "View all": the same filters plus that section's category.
  const onViewAll = useCallback(
    (categoryId: string) => {
      setApplied("search", {
        ...appliedHome,
        filters: { ...appliedHome.filters, category_ids: [categoryId] },
      });
      router.push("/search-results");
    },
    [appliedHome],
  );

  const renderItem = useCallback<ListRenderItem<Row>>(
    ({ item, index }) => {
      const animate = !entranceDone;
      switch (item.type) {
        case "search":
          return (
            <Block index={index} animate={animate}>
              <SearchRow filterCount={filterCount} />
            </Block>
          );
        case "categories":
          return (
            <Block index={index} animate={animate}>
              <CategoryGrid onSelect={onSelectShortcut} />
            </Block>
          );
        case "chips":
          return (
            <Block>
              <AppliedChipsRow applied={appliedHome} onChange={updateHome} sidePadding={14} />
            </Block>
          );
        case "loading":
          return (
            <Block>
              <FilteredLoading />
            </Block>
          );
        case "state":
          return (
            <Block>
              <SearchStateView kind={item.kind} query="" onAction={onStateAction} />
            </Block>
          );
        case "module":
          return (
            <Block>
              <FilteredModule module={item.module} onViewAll={onViewAll} />
            </Block>
          );
        case "banner":
          return (
            <Block index={index} animate={animate}>
              <View style={styles.banner}>
                <PromoBanner banner={item.banner} />
              </View>
            </Block>
          );
        case "foodSection":
          return (
            <Block index={index} animate={animate}>
              <SectionHeader title={item.section.title} />
              <FoodRow items={item.section.items} />
            </Block>
          );
        case "popularPlaces":
          return (
            <Block index={index} animate={animate}>
              <SectionHeader title="Popular Places" />
              <PopularPlaces places={item.places} />
            </Block>
          );
      }
    },
    [entranceDone, filterCount, appliedHome, updateHome, onStateAction, onViewAll, onSelectShortcut],
  );

  const { user } = homeData;
  const { active: activeAddress } = useDeliveryAddress();
  // Real profile name (mock until it loads). If the launch profile check
  // was skipped (offline/slow) and the profile turns out incomplete, send
  // the user to the missing setup step.
  const { firstName, fullName, nextRoute, addressLabel, savedLocation } =
    useHomeUser();
  useEffect(() => {
    if (nextRoute) router.replace(nextRoute);
  }, [nextRoute]);
  // Picked address > live device location > saved location (permission
  // on, fix pending) > saved delivery address > fallback.
  const { liveLabel, permissionGranted } = useUserLocation(savedLocation);
  const locationLabel = pickLocationLabel({
    picked: activeAddress?.title,
    live: liveLabel,
    savedLocation: savedLocation.locationLabel,
    permissionGranted,
    address: addressLabel,
    fallback: "Set delivery address",
  });

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <HomeTopBar
        firstName={firstName}
        fullName={fullName}
        avatar={user.avatar}
        locationLabel={locationLabel}
        scrollY={scrollY}
      />
      {/* getItemLayout is omitted: row heights vary with banner aspect ratio
          and text size. */}
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        extraData={entranceDone}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        // Our paddingBottom already clears the bar; no automatic iOS inset.
        contentInsetAdjustmentBehavior="never"
        initialNumToRender={4}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={50}
        windowSize={9}
        // No removeClippedSubviews / maintainVisibleContentPosition: both
        // crash with this nested-carousel feed on scroll. Re-add
        // maintainVisibleContentPosition only with real "load more" and test.
        contentContainerStyle={contentStyle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  banner: {
    marginTop: 14,
  },
});
