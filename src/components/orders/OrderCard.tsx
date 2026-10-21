// A single order in the "My orders" list: a white card with a light drop
// shadow (no divider lines), a vendor logo/initials, the vendor name and
// total, a reorder button, and a date + status line. Swipe left to reveal a
// delete action; releasing past the threshold removes it.
//
// Dummy data for now (src/data/mock/orders.ts). The real list will be driven
// by the authorized order source the notification engine defines.
import { Image } from "expo-image";
import { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { MockOrder } from "../../data/mock/orders";
import { getInitials } from "../../lib/format";
import { selectionHaptic } from "../../lib/haptics";
import { colors, fontFamily } from "../../theme";
import { Icon } from "../ui/Icon";

const LOGO = 48;
// Drag left past this (negative) to delete on release.
const DELETE_THRESHOLD = -96;
const ACTION_WIDTH = 88;
const SNAP = { duration: 180, easing: Easing.out(Easing.cubic) };

// 9045 -> "GH₵90.45" (mockup style: cedi symbol, always 2 decimals).
function formatCedi(minor: number): string {
  const whole = Math.floor(minor / 100).toLocaleString("en-US");
  const fraction = (minor % 100).toString().padStart(2, "0");
  return `GH\u00A2${whole}.${fraction}`;
}

// "10 Oct, 2026 3:15 PM"
function formatPlacedAt(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  // "10 Oct 2026" -> "10 Oct, 2026"
  return `${date.replace(/^(\d+ \w+) /, "$1, ")} ${time}`;
}

function statusText(order: MockOrder): string {
  if (order.status === "active") return order.activeLabel ?? "In progress";
  if (order.status === "cancelled") return "Cancelled";
  return "Delivered";
}

type Props = {
  order: MockOrder;
  onPress: (order: MockOrder) => void;
  onReorder: (order: MockOrder) => void;
  onDelete: (id: string) => void;
};

function OrderCardBase({ order, onPress, onReorder, onDelete }: Props) {
  const translateX = useSharedValue(0);
  const removing = useSharedValue(false);

  const remove = useCallback(() => {
    selectionHaptic();
    onDelete(order.id);
  }, [onDelete, order.id]);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onChange((e) => {
      "worklet";
      if (removing.value) return;
      // Left only; a little rightward give.
      translateX.value = Math.min(8, translateX.value + e.changeX);
    })
    .onEnd(() => {
      "worklet";
      if (translateX.value <= DELETE_THRESHOLD) {
        removing.value = true;
        // Slide out, then remove from the list.
        translateX.value = withTiming(-500, { duration: 180 }, (done) => {
          if (done) runOnJS(remove)();
        });
      } else {
        translateX.value = withTiming(0, SNAP);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // The red delete backing fades/reveals as the card slides off it.
  const actionStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, -translateX.value / ACTION_WIDTH),
  }));

  const status = statusText(order);
  const statusColor =
    order.status === "cancelled"
      ? colors.error
      : order.status === "active"
        ? colors.primary
        : colors.textMuted;

  const a11yLabel = `${order.vendorName}, ${formatCedi(order.totalMinor)}, ${status}`;

  return (
    <View style={styles.row}>
      {/* Delete backing, revealed on swipe. */}
      <Animated.View style={[styles.action, actionStyle]} pointerEvents="none">
        <Icon name="trash" size={20} color={colors.white} />
        <Text style={styles.actionText}>Delete</Text>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={cardStyle}>
          <Pressable
            onPress={() => onPress(order)}
            accessibilityRole="button"
            accessibilityLabel={a11yLabel}
            accessibilityHint="Opens the order. Swipe left to delete."
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.logo}>
              {order.logo ? (
                <Image
                  source={order.logo}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={150}
                  accessible={false}
                />
              ) : (
                <Text style={styles.logoInitials}>{getInitials(order.vendorName)}</Text>
              )}
            </View>
            <View style={styles.body}>
              <View style={styles.topLine}>
                <View style={styles.titleCol}>
                  <Text style={styles.vendor} numberOfLines={1}>
                    {order.vendorName}
                  </Text>
                  <Text style={styles.price}>{formatCedi(order.totalMinor)}</Text>
                </View>
                <Pressable
                  onPress={() => onReorder(order)}
                  accessibilityRole="button"
                  accessibilityLabel={`Reorder from ${order.vendorName}`}
                  hitSlop={6}
                  style={({ pressed }) => [styles.reorder, pressed && styles.pressed]}
                >
                  <Icon name="reorder" size={18} color={colors.text} weight="medium" />
                </Pressable>
              </View>
              <Text style={styles.meta} numberOfLines={1}>
                {formatPlacedAt(order.placedAt)}
                <Text style={styles.metaDot}>{"  \u00B7  "}</Text>
                <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export const OrderCard = memo(OrderCardBase);

const styles = StyleSheet.create({
  row: {
    marginBottom: 12,
  },
  action: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.error,
    borderRadius: 18,
    borderCurve: "continuous",
    alignItems: "flex-end",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingRight: 24,
  },
  actionText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: colors.white,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: colors.white,
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.05)",
  },
  logo: {
    width: LOGO,
    height: LOGO,
    borderRadius: 12,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  logoInitials: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: colors.primary,
  },
  body: {
    flex: 1,
  },
  topLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  titleCol: {
    flex: 1,
  },
  vendor: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  price: {
    marginTop: 2,
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.text,
  },
  reorder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: {
    marginTop: 8,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  metaDot: {
    color: colors.textMuted,
  },
  statusText: {
    fontFamily: fontFamily.semibold,
  },
  pressed: {
    opacity: 0.7,
  },
});
