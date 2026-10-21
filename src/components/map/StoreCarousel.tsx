// Nearby-stores carousel above the floating tab bar (Airbnb / Uber Eats
// style). Horizontal paging FlatList of preview cards with the next card
// peeking. The whole carousel pops up (rise + fade + slight scale, critically
// damped spring, no bounce) and dismisses with the reverse; Reduce Motion
// gets an opacity fade only.
//
// Sync rules (owned by the map screen; this component only reports):
// - onSnap(id) fires when a swipe settles on a different page.
// - A new `selectedId` already in `items` scrolls to its page (animated).
// - New `items` (a rebuild) jump to the selected page without animation;
//   a new `popKey` replays the pop-up.
// - `open` false plays the dismiss, then calls onHidden.
import { memo, useCallback, useEffect, useRef } from "react";
import {
  FlatList,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { indexFromOffset } from "../../lib/stores/nearbyOrder";
import type { QuotedStore } from "../../lib/stores/storeSections";
import { StorePreviewCard } from "./StorePreviewCard";

// Card = screen - 56 (28 each side); the side padding centres the active
// card and the next one peeks in by 28 - GAP.
const SIDE = 28;
const GAP = 10;
// Room inside the list for the card shadow (ScrollView clips on iOS).
const SHADOW_TOP = 10;
const SHADOW_BOTTOM = 18;
const ENTER = {
  duration: 300,
  dampingRatio: 1,
  overshootClamping: true,
  reduceMotion: ReduceMotion.Never,
} as const;
const FADE_IN = { duration: 220, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never };
const EXIT = { duration: 200, easing: Easing.in(Easing.cubic), reduceMotion: ReduceMotion.Never };
const RISE = 40;
const SCALE_FROM = 0.94;

type Props = {
  items: QuotedStore[];
  selectedId: string | null;
  open: boolean;
  popKey: number;
  // Distance from the screen bottom to the carousel's bottom edge.
  bottom: number;
  onSnap: (id: string) => void;
  onPress: (item: QuotedStore) => void;
  onClose: () => void;
  onHidden: () => void;
};

function StoreCarouselBase({
  items,
  selectedId,
  open,
  popKey,
  bottom,
  onSnap,
  onPress,
  onClose,
  onHidden,
}: Props) {
  const { width } = useWindowDimensions();
  const cardWidth = width - SIDE * 2;
  const interval = cardWidth + GAP;
  const listRef = useRef<FlatList<QuotedStore>>(null);
  // Page the list is (or is animating) at.
  const indexRef = useRef(0);

  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const lastPopKey = useRef(popKey);

  useEffect(() => {
    if (open) {
      if (lastPopKey.current !== popKey) {
        lastPopKey.current = popKey;
        progress.set(0);
      }
      progress.set(reducedMotion ? withTiming(1, FADE_IN) : withSpring(1, ENTER));
      return;
    }
    progress.set(
      withTiming(0, EXIT, (finished) => {
        if (finished) scheduleOnRN(onHidden);
      }),
    );
  }, [open, popKey, reducedMotion, progress, onHidden]);

  // Primitive copies for the worklet; Reduce Motion = opacity only.
  const rise = reducedMotion ? 0 : RISE;
  const scaleFrom = reducedMotion ? 1 : SCALE_FROM;
  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: p,
      transform: [{ translateY: (1 - p) * rise }, { scale: scaleFrom + (1 - scaleFrom) * p }],
    };
  }, [rise, scaleFrom]);

  // Rebuild: jump to the selected page (index 0 after a marker rebuild).
  useEffect(() => {
    const i = Math.max(0, items.findIndex((s) => s.store.id === selectedId));
    indexRef.current = i;
    listRef.current?.scrollToOffset({ offset: i * interval, animated: false });
    // Only on a new list or layout; selection changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, interval]);

  // Map tap on a store already in the list: glide to its page.
  useEffect(() => {
    const i = items.findIndex((s) => s.store.id === selectedId);
    if (i < 0 || i === indexRef.current) return;
    indexRef.current = i;
    listRef.current?.scrollToOffset({ offset: i * interval, animated: true });
  }, [items, selectedId, interval]);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = indexFromOffset(e.nativeEvent.contentOffset.x, interval, items.length);
      if (i === indexRef.current) return;
      indexRef.current = i;
      const item = items[i];
      if (item) onSnap(item.store.id);
    },
    [interval, items, onSnap],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<QuotedStore> | null | undefined, index: number) => ({
      length: interval,
      offset: interval * index,
      index,
    }),
    [interval],
  );

  const renderItem = useCallback<ListRenderItem<QuotedStore>>(
    ({ item, index }) => (
      <View style={index < items.length - 1 ? styles.gap : undefined}>
        <StorePreviewCard item={item} width={cardWidth} onPress={onPress} onClose={onClose} />
      </View>
    ),
    [cardWidth, items.length, onPress, onClose],
  );

  return (
    <Animated.View
      style={[styles.root, { bottom: bottom - SHADOW_BOTTOM }, animatedStyle]}
      pointerEvents={open ? "box-none" : "none"}
    >
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        horizontal
        snapToInterval={interval}
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        contentContainerStyle={styles.content}
        accessibilityRole="list"
        accessibilityLabel="Nearby stores"
      />
    </Animated.View>
  );
}

const keyExtractor = (item: QuotedStore) => item.store.id;

export const StoreCarousel = memo(StoreCarouselBase);

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  content: {
    paddingLeft: SIDE,
    // With the gap only between cards, the last page lands exactly on
    // (n - 1) * interval.
    paddingRight: SIDE,
    paddingTop: SHADOW_TOP,
    paddingBottom: SHADOW_BOTTOM,
  },
  gap: {
    marginRight: GAP,
  },
});
