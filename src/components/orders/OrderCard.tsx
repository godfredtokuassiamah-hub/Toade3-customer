// Orders tab card (Uber Eats / Bolt Food style), for real orders.
//
// - In progress: highlighted, status badge + "Track order"; tap opens live
//   tracking.
// - Past: store logo, name, "2 items · 3:15 PM", total, outcome badge
//   (Delivered / Cancelled / Declined) and a Reorder pill; tap opens the
//   order details (receipt).
// No swipe-to-delete: order history is kept, like Uber/Bolt.
import { Image } from "expo-image";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getVendorById } from "../../data/mock/catalog";
import { formatMinorFixed } from "../../lib/discovery/money";
import { canReorder, cardMeta, isActive, statusBadge } from "../../lib/orders/orderHistory";
import type { OrderSummary } from "../../services/orders";
import { colors, fontFamily } from "../../theme";
import { ReorderButton } from "../order/ReorderSheet";
import { Icon } from "../ui/Icon";

const TONE = {
  success: { bg: "#E7F5EC", fg: colors.success },
  error: { bg: "#FDECEA", fg: colors.error },
  active: { bg: colors.primaryLight, fg: colors.primary },
} as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

type Props = {
  order: OrderSummary;
  onPress: (order: OrderSummary) => void;
  onReorder: (order: OrderSummary) => void;
  reordering: boolean;
};

function OrderCardBase({ order, onPress, onReorder, reordering }: Props) {
  const vendor = getVendorById(order.vendorId);
  const logo = vendor?.logo;
  const name = order.vendorName || vendor?.name || "Store";
  const active = isActive(order.status);
  const badge = statusBadge(order.status);
  const tone = TONE[badge.tone];
  const total = formatMinorFixed(order.totalMinor);
  const meta = cardMeta(order);

  return (
    <Pressable
      onPress={() => onPress(order)}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${badge.label}, ${meta}, ${total}`}
      accessibilityHint={active ? "Opens live tracking" : "Opens the order details"}
      style={({ pressed }) => [styles.card, active && styles.cardActive, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <View style={styles.logo}>
          {logo ? (
            <Image source={logo} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessible={false} />
          ) : (
            <Text style={styles.initials}>{initials(name)}</Text>
          )}
        </View>
        <View style={styles.body}>
          <Text style={styles.vendor} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
          <View style={[styles.badge, { backgroundColor: tone.bg }]}>
            <View style={[styles.dot, { backgroundColor: tone.fg }]} />
            <Text style={[styles.badgeText, { color: tone.fg }]}>{badge.label}</Text>
          </View>
        </View>
        <Text style={styles.total}>{total}</Text>
      </View>

      {active ? (
        <View style={styles.footer}>
          <Text style={styles.track}>Track order</Text>
          <Icon name="chevronRight" size={16} color={colors.primary} />
        </View>
      ) : canReorder(order.status) ? (
        <View style={styles.footer}>
          <Text style={styles.details}>View details</Text>
          <ReorderButton onPress={() => onReorder(order)} busy={reordering} />
        </View>
      ) : null}
    </Pressable>
  );
}

export const OrderCard = memo(OrderCardBase);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    boxShadow: "0px 4px 14px rgba(0,0,0,0.06)",
  },
  cardActive: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.textMuted,
  },
  body: {
    flex: 1,
    gap: 3,
  },
  vendor: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.text,
  },
  meta: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  badge: {
    marginTop: 3,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
  },
  total: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  footer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 36,
  },
  track: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.primary,
  },
  details: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.75,
  },
});
