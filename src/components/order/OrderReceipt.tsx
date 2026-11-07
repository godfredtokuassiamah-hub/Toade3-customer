// Completed order details (delivered / cancelled / declined), Uber Eats /
// Bolt Food style receipt: outcome, when, store, drop-off, every item with
// its options and notes, the full price breakdown, and Reorder / Get help.
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getItemsByIds, getVendorById } from "../../data/mock/catalog";
import { formatMinorFixed } from "../../lib/discovery/money";
import { canReorder, dayTitle } from "../../lib/orders/orderHistory";
import { shortOrderRef } from "../../lib/orders/orderPlaced";
import { formatClock, trackingCopy } from "../../lib/orders/orderTracking";
import { addressLine } from "../../lib/storefront/vendorInfo";
import type { OrderDetail, OrderTracking } from "../../services/orders";
import { colors, fontFamily } from "../../theme";
import { Icon } from "../ui/Icon";
import { ReorderButton, useReorder } from "./ReorderSheet";

type Props = {
  order: OrderDetail;
  tracking: OrderTracking;
  onBack: () => void;
};

export function OrderReceipt({ order, tracking, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [now] = useState(() => new Date());
  const reorder = useReorder();
  const vendor = getVendorById(order.vendorId);
  const vendorName = order.vendorName || vendor?.name || "Store";
  const live = tracking.version >= order.version;
  const status = live ? tracking.status : order.status;
  const delivered = status === "delivered";
  const ref = shortOrderRef(order.orderId, order.orderNumber);

  const when = (ms: number) => {
    const d = new Date(ms);
    return `${dayTitle(d, now)}, ${formatClock(d)}`;
  };
  const placed = Date.parse(order.createdAt);
  const title = delivered ? "Delivered" : status === "rejected" ? "Order declined" : "Order cancelled";
  const subtitle = delivered
    ? tracking.deliveredAt != null
      ? `Delivered ${when(tracking.deliveredAt)}. Enjoy!`
      : "Your order was delivered. Enjoy!"
    : trackingCopy(status, vendorName, { rejectReason: live ? tracking.rejectReason : null }).banner;

  const onGetHelp = () =>
    Alert.alert("Get help", `Support chat is coming soon. For now, contact ${vendorName} about order ${ref}.`);
  const onStore = () => {
    if (!vendor) return;
    router.push({ pathname: "/storefront/[vendorId]", params: { vendorId: order.vendorId } });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={6}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <Icon name="arrowLeft" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Order details
        </Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Outcome */}
        <View style={[styles.card, styles.hero]}>
          <View style={[styles.outcome, { backgroundColor: delivered ? colors.success : colors.error }]}>
            <Icon name={delivered ? "check" : "close"} size={28} color={colors.white} weight="semibold" />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <Text style={styles.meta}>
            {`Order ${ref}${Number.isFinite(placed) ? ` \u00b7 placed ${when(placed)}` : ""}`}
          </Text>
        </View>

        {/* Store */}
        <Pressable
          onPress={onStore}
          disabled={!vendor}
          accessibilityRole="button"
          accessibilityLabel={`${vendorName}, view store`}
          style={({ pressed }) => [styles.card, styles.row, pressed && styles.pressed]}
        >
          <View style={styles.thumb}>
            {vendor?.logo ? (
              <Image source={vendor.logo} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
            ) : (
              <Icon name="store" size={22} color={colors.text} />
            )}
          </View>
          <View style={styles.flex}>
            <Text style={styles.strong} numberOfLines={1}>
              {vendorName}
            </Text>
            {vendor && addressLine(vendor) ? (
              <Text style={styles.muted} numberOfLines={1}>
                {addressLine(vendor)}
              </Text>
            ) : null}
          </View>
          {vendor ? <Icon name="chevronRight" size={16} color={colors.textMuted} /> : null}
        </Pressable>

        {/* Delivery to */}
        <View style={[styles.card, styles.row]}>
          <View style={styles.thumb}>
            <Icon name="location" size={22} color={colors.text} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.label}>Delivery to</Text>
            <Text style={styles.strong} numberOfLines={2}>
              {order.dropoff.label || "Drop-off pin"}
            </Text>
            {order.instructions ? (
              <Text style={styles.muted} numberOfLines={2}>
                {order.instructions}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Items + receipt */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {`${order.itemCount} ${order.itemCount === 1 ? "item" : "items"}`}
          </Text>
          {order.items.map((item, i) => {
            const image = item.productId ? getItemsByIds([item.productId])[0]?.image : undefined;
            return (
              <View key={`${item.productId ?? item.name}-${i}`} style={styles.itemRow}>
                <View style={styles.itemThumb}>
                  {image ? (
                    <Image source={image} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
                  ) : (
                    <Icon name="orders" size={18} color={colors.imagePlaceholderIcon} />
                  )}
                </View>
                <View style={styles.flex}>
                  <Text style={styles.itemName}>{`${item.qty}\u00d7 ${item.name}`}</Text>
                  {item.options.map((o) => (
                    <Text key={o.id} style={styles.muted}>
                      {o.priceMinor > 0 ? `${o.label} (+${formatMinorFixed(o.priceMinor)})` : o.label}
                    </Text>
                  ))}
                  {item.note ? <Text style={styles.muted}>{`Note: ${item.note}`}</Text> : null}
                </View>
                <Text style={styles.amount}>{formatMinorFixed(item.lineTotalMinor)}</Text>
              </View>
            );
          })}
          <View style={styles.divider} />
          <Price label="Subtotal" value={order.itemsTotalMinor} />
          <Price label="Service fee" value={order.serviceFeeMinor} />
          <Price label="Delivery fee" value={order.deliveryFeeMinor} />
          {order.tipMinor > 0 ? <Price label="Rider support" value={order.tipMinor} /> : null}
          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <Text style={styles.total}>Total</Text>
            <Text style={styles.total}>{formatMinorFixed(order.totalMinor)}</Text>
          </View>
          {!delivered ? <Text style={styles.notCharged}>You weren&apos;t charged for this order.</Text> : null}
        </View>

        <View style={styles.actions}>
          {canReorder(status) ? (
            <ReorderButton
              large
              label="Reorder"
              busy={reorder.busyId === order.orderId}
              onPress={() => void reorder.start(order.orderId)}
            />
          ) : null}
          <Pressable
            onPress={onGetHelp}
            accessibilityRole="button"
            accessibilityLabel="Get help"
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>Get help</Text>
          </Pressable>
        </View>
      </ScrollView>
      {reorder.sheet}
    </View>
  );
}

function Price({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.priceRow}>
      <Text style={styles.priceLabel}>{label}</Text>
      <Text style={styles.priceValue}>{formatMinorFixed(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  header: {
    height: 52,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: fontFamily.bold,
    fontSize: 17,
    color: colors.text,
  },
  flex: {
    flex: 1,
  },
  card: {
    marginTop: 10,
    marginHorizontal: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: colors.white,
  },
  hero: {
    marginTop: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    alignItems: "center",
    paddingVertical: 24,
  },
  outcome: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginTop: 12,
    fontFamily: fontFamily.bold,
    fontSize: 24,
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: "center",
  },
  meta: {
    marginTop: 8,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  strong: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  muted: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  cardTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.text,
  },
  itemRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  itemThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.imagePlaceholder,
    alignItems: "center",
    justifyContent: "center",
  },
  itemName: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    color: colors.text,
  },
  amount: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: colors.text,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
    marginVertical: 12,
  },
  priceRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
  priceValue: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.text,
  },
  total: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.text,
  },
  notCharged: {
    marginTop: 8,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.success,
  },
  actions: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  secondary: {
    marginTop: 10,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: colors.text,
  },
  pressed: {
    opacity: 0.7,
  },
});
