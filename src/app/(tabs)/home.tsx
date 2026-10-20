import { useScrollToTop } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type FlatList,
  type ListRenderItem,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  ReduceMotion,
  useAnimatedScrollHandler,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FoodRow } from "../../components/home/FoodRow";
import { buildHomeFeed, type HomeFeedItem } from "../../components/home/homeFeed";
import { HomeTopBar } from "../../components/home/HomeTopBar";
import { PopularPlaces } from "../../components/home/PopularPlaces";
import { PromoBanner } from "../../components/home/PromoBanner";
import { SearchRow } from "../../components/home/SearchRow";
import { SectionHeader } from "../../components/home/SectionHeader";
import {
  clampScrollOffset,
  nextCompactionState,
} from "../../components/navigation/scrollCompaction";
import { getTabBarClearance } from "../../components/navigation/tabBarMetrics";
import {
  COMPACTION_TIMING,
  useTabBarScroll,
} from "../../components/navigation/TabBarScrollContext";
import { homeData } from "../../data/mock/home";
import { colors } from "../../theme";

const FEED = buildHomeFeed(homeData);

// Long enough for the last staggered block (6 * 60 + 320ms) to finish.
const ENTRANCE_MS = 900;

const keyExtractor = (item: HomeFeedItem) => item.key;

// Staggered entrance; skipped automatically when the OS reduces motion.
// Only on first mount, so rows re-mounted by virtualization don't replay it.
function Block({
  index,
  animate,
  children,
}: {
  index: number;
  animate: boolean;
  children: ReactNode;
}) {
  return (
    <Animated.View
      entering={
        animate
          ? FadeInDown.delay(index * 60)
              .duration(320)
              .reduceMotion(ReduceMotion.System)
          : undefined
      }
    >
      {children}
    </Animated.View>
  );
}

// Home tab. The top bar is pinned above the feed and the floating tab bar
// overlays the bottom, so only the content between them scrolls.
// TODO(home): session/profile bootstrap from the architecture blueprint.
export default function Home() {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const { progress, compaction } = useTabBarScroll();

  // Tapping the focused Home tab scrolls back to the top (the bar expands
  // itself on that press).
  const listRef = useRef<FlatList<HomeFeedItem>>(null);
  useScrollToTop(listRef);

  const scrollY = useSharedValue(0);
  const lastY = useSharedValue(0);
  // One handler for the top-bar hairline and the tab bar compaction. Shared
  // values only: nothing here re-renders React per frame.
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.set(e.contentOffset.y);
      if (reducedMotion) return;
      // Clamped so rubber-banding at either end can't toggle the bar.
      const y = clampScrollOffset(
        e.contentOffset.y,
        e.contentSize.height,
        e.layoutMeasurement.height,
      );
      const delta = y - lastY.get();
      lastY.set(y);
      const prev = compaction.get();
      const next = nextCompactionState(prev, y, delta);
      if (next.compact !== prev.compact || next.travel !== prev.travel) {
        compaction.set(next);
      }
      if (next.compact !== prev.compact) {
        progress.set(withTiming(next.compact ? 1 : 0, COMPACTION_TIMING));
      }
    },
  });

  const [entranceDone, setEntranceDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEntranceDone(true), ENTRANCE_MS);
    return () => clearTimeout(t);
  }, []);

  // Sized for the expanded bar and never tied to compaction, so the bar
  // animating can't shift the feed; the last card clears it fully.
  const contentStyle = useMemo(
    () => ({
      paddingTop: 8,
      paddingBottom: getTabBarClearance(insets.bottom, fontScale),
    }),
    [insets.bottom, fontScale],
  );

  const renderItem = useCallback<ListRenderItem<HomeFeedItem>>(
    ({ item, index }) => {
      const animate = !entranceDone;
      switch (item.type) {
        case "search":
          return (
            <Block index={index} animate={animate}>
              <SearchRow />
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
    [entranceDone],
  );

  const { user, locationLabel } = homeData;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <HomeTopBar
        firstName={user.firstName}
        fullName={user.fullName}
        avatar={user.avatar}
        locationLabel={locationLabel}
        scrollY={scrollY}
      />
      {/* getItemLayout is omitted: row heights vary with banner aspect ratio
          and text size. */}
      <Animated.FlatList
        ref={listRef}
        data={FEED}
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
        removeClippedSubviews={Platform.OS === "android"}
        // load-more: keeps the visible row anchored when results are
        // inserted above or appended later.
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
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
