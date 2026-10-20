import { Image } from "expo-image";
import { memo } from "react";
import { type ImageSourcePropType, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { formatMinorFixed } from "../../lib/discovery/money";
import type { ItemStatus } from "../../lib/discovery/types";
import { formatEta, formatGhs } from "../../lib/format";
import { colors, fontFamily } from "../../theme";
import { Icon } from "../ui/Icon";

const PADDING = 8;

// Static Home FoodItem (priceGhs) or a discovery item (priceMinor, status).
export type FoodCardItem = {
  id: string;
  name: string;
  vendor: string;
  etaMins: number;
  image?: ImageSourcePropType;
  priceGhs?: number;
  // Integer pesewas (discovery results).
  priceMinor?: number;
  status?: ItemStatus;
};

type Props = {
  item: FoodCardItem;
  width: number;
};

const STATUS_LABEL: Record<Exclude<ItemStatus, "available">, string> = {
  closed: "Closed",
  sold_out: "Sold out",
};

function FoodCardBase({ item, width }: Props) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const price =
    item.priceMinor != null ? formatMinorFixed(item.priceMinor) : formatGhs(item.priceGhs ?? 0);
  const eta = formatEta(item.etaMins);
  const imageWidth = width - PADDING * 2;
  // Closed / sold-out items stay visible (never reordered), labelled and
  // not orderable. TODO(cart): disable Add once cards get an Add button.
  const statusLabel = item.status && item.status !== "available" ? STATUS_LABEL[item.status] : null;

  return (
    <Pressable
      // TODO(item): open item detail.
      onPress={() => {}}
      onPressIn={() => {
        if (!reducedMotion) scale.set(withTiming(0.97, { duration: 120 }));
      }}
      onPressOut={() => {
        if (!reducedMotion) scale.set(withTiming(1, { duration: 120 }));
      }}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.vendor}, ${price}, ${eta}${statusLabel ? `, ${statusLabel}` : ""}`}
    >
      <Animated.View style={[styles.card, { width }, pressStyle]}>
        <View style={[styles.imageBox, { width: imageWidth }, statusLabel != null && styles.dimmed]}>
          {item.image ? (
            <Image
              source={item.image}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
              recyclingKey={item.id}
              accessible={false}
            />
          ) : (
            // Photo not supplied yet (assets/images/food/README.md).
            <Icon name="orders" size={24} color={colors.imagePlaceholderIcon} />
          )}
        </View>
        {statusLabel ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{statusLabel}</Text>
          </View>
        ) : null}
        {/* flexGrow keeps ETA rows aligned when a name wraps to 2 lines (the
            row stretches every card to the tallest one). */}
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.price}>{price}</Text>
          </View>
          <Text style={styles.vendor} numberOfLines={1}>
            {item.vendor}
          </Text>
        </View>
        <View style={styles.etaRow}>
          <Icon name="clock" size={12} color={colors.primary} />
          <Text style={styles.eta}>{eta}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export const FoodCard = memo(FoodCardBase);

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    padding: PADDING,
    borderRadius: 12,
    backgroundColor: colors.surfaceCard,
  },
  imageBox: {
    aspectRatio: 16 / 10,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: colors.imagePlaceholder,
    alignItems: "center",
    justifyContent: "center",
  },
  dimmed: {
    opacity: 0.45,
  },
  badge: {
    position: "absolute",
    top: PADDING + 6,
    left: PADDING + 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: colors.text,
  },
  badgeText: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    color: colors.white,
  },
  info: {
    flexGrow: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 10,
  },
  name: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.text,
  },
  price: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.text,
  },
  vendor: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: colors.textMuted,
  },
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  eta: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: colors.primary,
  },
});
