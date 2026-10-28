// "Order placed" confirmation: compact bottom sheet shown over the order
// detail screen right after place_order succeeds (order/[id].tsx with
// placed=1). Minimal white sheet: rider illustration, honest status copy,
// first-item card, order summary, Track order / Back to home.
//
// Motion: the shared BottomSheet slides up with a timing ease-out (no
// spring) over a plain dim scrim (no BlurView, per the glass crash rule).
// The content groups fade/translate in with a small stagger driven by
// shared values (no `entering` layout animations). Reduced motion: the sheet
// only fades and the content is shown at once.
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getItemsByIds } from "../../data/mock/catalog";
import { formatMinorFixed } from "../../lib/discovery/money";
import {
  buildSummaryRows,
  itemCardText,
  ORDER_PLACED_ILLUSTRATION_URL,
  orderStatusCopy,
  shortOrderRef,
} from "../../lib/orders/orderPlaced";
import type { OrderDetail, OrderStatus } from "../../services/orders";
import { colors, fontFamily } from "../../theme";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";

const ILLUSTRATION = 104;
const STAGGER_START = 80;
const STAGGER_STEP = 50;
const STAGGER_MS = 220;
const STAGGER_OFFSET = 8;

type Props = {
  visible: boolean;
  // null while the order is loading or failed to load.
  order: OrderDetail | null;
  // Status from place_order, used until the order detail has loaded.
  fallbackStatus: OrderStatus;
  orderId: string;
  // Only from the authoritative server quote; null -> fallback text.
  eta: readonly [number, number] | null;
  onTrack: () => void;
  onHome: () => void;
  onClosed?: () => void;
};

export function OrderPlacedSheet({
  visible,
  order,
  fallbackStatus,
  orderId,
  eta,
  onTrack,
  onHome,
  onClosed,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const titleRef = useRef<Text>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const copy = orderStatusCopy(order?.status ?? fallbackStatus);
  const rows = buildSummaryRows({
    orderRef: shortOrderRef(orderId, order?.orderNumber ?? null),
    addressLabel: order?.dropoff.label,
    eta,
  });
  const first = order?.items[0];
  const card = order ? itemCardText(order.vendorName, order.items, order.itemCount) : null;
  const thumb = first?.productId ? getItemsByIds([first.productId])[0]?.image : undefined;
  const statusColor = copy.tone === "error" ? colors.error : colors.success;

  // Fixed set of stagger groups: illustration, title, item card, summary,
  // actions.
  const g0 = useSharedValue(0);
  const g1 = useSharedValue(0);
  const g2 = useSharedValue(0);
  const g3 = useSharedValue(0);
  const g4 = useSharedValue(0);

  useEffect(() => {
    const groups = [g0, g1, g2, g3, g4];
    groups.forEach((g, i) => {
      if (!visible) {
        g.value = 0;
      } else if (reducedMotion) {
        g.value = 1;
      } else {
        g.value = withDelay(
          STAGGER_START + i * STAGGER_STEP,
          withTiming(1, { duration: STAGGER_MS, easing: Easing.out(Easing.cubic) }),
        );
      }
    });
  }, [visible, reducedMotion, g0, g1, g2, g3, g4]);

  const s0 = useStaggerStyle(g0);
  const s1 = useStaggerStyle(g1);
  const s2 = useStaggerStyle(g2);
  const s3 = useStaggerStyle(g3);
  const s4 = useStaggerStyle(g4);

  const onOpened = () => {
    if (titleRef.current) AccessibilityInfo.sendAccessibilityEvent(titleRef.current, "focus");
    AccessibilityInfo.announceForAccessibilityWithOptions(`${copy.subtitle}. ${copy.statusLine}`, {
      queue: true,
    });
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onHome}
      onOpened={onOpened}
      onClosed={onClosed}
      backdrop="dim"
      fitContent
      accessibilityLabel={copy.title}
    >
      <ScrollView
        style={{ maxHeight: height * 0.9 - 24 }}
        contentContainerStyle={[styles.body, { paddingBottom: Math.max(insets.bottom, 16) }]}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.illustrationWrap, imageLoaded && styles.loaded, s0]}>
          {/* Icons8 (id wCClDpWTvma9), loaded remotely on purpose for quality.
              Icons8 requires attribution (README) or a paid licence before
              release. Decorative: hidden from screen readers. */}
          <Image
            source={{ uri: ORDER_PLACED_ILLUSTRATION_URL }}
            style={styles.illustration}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={reducedMotion ? 0 : 150}
            accessible={false}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageLoaded(true)}
          />
        </Animated.View>

        <Animated.View style={[styles.center, s1]}>
          <Text ref={titleRef} style={styles.title} accessibilityRole="header">
            {copy.title}
          </Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>
        </Animated.View>

        {order && card && first ? (
          <Animated.View
            style={[styles.card, styles.itemCard, s2]}
            accessible
            accessibilityLabel={`${card.title}. ${card.itemLine}. ${card.countLine}. Total ${formatMinorFixed(order.totalMinor)}`}
          >
            <View style={styles.thumb}>
              {thumb ? (
                <Image
                  source={thumb}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  accessible={false}
                />
              ) : (
                <Icon name="orders" size={22} color={colors.imagePlaceholderIcon} />
              )}
            </View>
            <View style={styles.flex}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {card.title}
              </Text>
              <Text style={styles.itemMeta} numberOfLines={1}>
                {card.itemLine}
              </Text>
              <Text style={styles.itemMeta} numberOfLines={1}>
                {card.countLine}
              </Text>
            </View>
            <Text style={styles.total}>{formatMinorFixed(order.totalMinor)}</Text>
          </Animated.View>
        ) : null}

        <Animated.View style={[styles.card, styles.summary, s3]}>
          <Text style={styles.summaryHeader} accessibilityRole="header">
            Order summary
          </Text>
          <View style={styles.divider} />
          {rows.map((row) => (
            <View
              key={row.key}
              style={styles.row}
              accessible
              accessibilityLabel={`${row.label}: ${row.value}`}
            >
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue} numberOfLines={2}>
                {row.value}
              </Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View style={[styles.actions, s4]}>
          <Pressable
            onPress={onTrack}
            accessibilityRole="button"
            accessibilityLabel="Track order"
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>Track order</Text>
          </Pressable>
          <Pressable
            onPress={onHome}
            accessibilityRole="button"
            accessibilityLabel="Back to home"
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>Back to home</Text>
          </Pressable>
          <View style={styles.statusRow} accessibilityLiveRegion="polite">
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{copy.statusLine}</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </BottomSheet>
  );
}

function useStaggerStyle(v: SharedValue<number>) {
  return useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateY: (1 - v.value) * STAGGER_OFFSET }],
  }));
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    alignItems: "center",
  },
  illustrationWrap: {
    width: ILLUSTRATION + 8,
    height: ILLUSTRATION + 8,
    borderRadius: (ILLUSTRATION + 8) / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.imagePlaceholder,
  },
  loaded: {
    backgroundColor: "transparent",
  },
  illustration: {
    width: ILLUSTRATION,
    height: ILLUSTRATION,
  },
  center: {
    alignSelf: "stretch",
    alignItems: "center",
  },
  title: {
    marginTop: 16,
    fontFamily: fontFamily.bold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 6,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: "center",
  },
  card: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    backgroundColor: colors.white,
  },
  itemCard: {
    marginTop: 24,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.imagePlaceholder,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: {
    flex: 1,
  },
  itemTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  itemMeta: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  total: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  summary: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  summaryHeader: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.text,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
    marginTop: 12,
    marginBottom: 4,
  },
  row: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 4,
  },
  rowLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
  rowValue: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: colors.text,
  },
  actions: {
    alignSelf: "stretch",
    alignItems: "center",
    marginTop: 24,
  },
  primary: {
    alignSelf: "stretch",
    minHeight: 52,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: colors.white,
  },
  secondary: {
    alignSelf: "stretch",
    marginTop: 4,
    minHeight: 48,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  statusRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.7,
  },
});
