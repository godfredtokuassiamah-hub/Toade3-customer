// Order confirmation, opened by checkout after place_order succeeds: order
// number, status, items and the server total. Minimal on purpose; the
// Orders tab (another tool) owns order history and tracking.
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "../../components/ui/Icon";
import { useOrder } from "../../hooks/useMyOrders";
import { formatMinorFixed } from "../../lib/discovery/money";
import type { OrderStatus } from "../../services/orders";
import { colors, fontFamily } from "../../theme";

const SIDE = 16;

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Waiting for the store to accept",
  accepted: "Accepted by the store",
  preparing: "Being prepared",
  ready: "Ready for pickup by your rider",
  out_for_delivery: "On the way",
  delivered: "Delivered",
  rejected: "Declined by the store",
  cancelled: "Cancelled",
};

export default function OrderConfirmation() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isPending, isError } = useOrder(id);

  const goHome = () => router.navigate("/home");

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        {isPending ? (
          <ActivityIndicator style={styles.loading} color={colors.primary} accessibilityLabel="Loading order" />
        ) : !order ? (
          <Text style={styles.muted} accessibilityRole="alert">
            {isError ? "Couldn't load this order. It was placed; check Orders shortly." : "Order not found."}
          </Text>
        ) : (
          <>
            <View style={styles.check}>
              <Icon name="check" size={32} color={colors.white} weight="semibold" />
            </View>
            <Text style={styles.title} accessibilityRole="header">
              Order placed
            </Text>
            {order.orderNumber != null ? (
              <Text style={styles.number}>Order #{order.orderNumber}</Text>
            ) : null}
            <Text style={styles.status} accessibilityLiveRegion="polite">
              {STATUS_LABEL[order.status]}
            </Text>
            {__DEV__ && order.mock ? (
              <Text style={styles.mock}>Mock order (dev): the ordering backend isn&apos;t deployed yet.</Text>
            ) : null}

            <Text style={styles.section} accessibilityRole="header">
              From {order.vendorName}
            </Text>
            {order.items.map((item, index) => (
              <View key={`${item.productId ?? item.name}-${index}`} style={styles.itemRow}>
                <Text style={styles.qty}>{item.qty}×</Text>
                <View style={styles.flex}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.options.length > 0 ? (
                    <Text style={styles.muted}>{item.options.map((o) => o.label).join(", ")}</Text>
                  ) : null}
                  {item.note ? <Text style={styles.muted}>Note: {item.note}</Text> : null}
                </View>
                <Text style={styles.amount}>{formatMinorFixed(item.lineTotalMinor)}</Text>
              </View>
            ))}

            <View style={styles.divider} />
            <Row label="Subtotal" value={order.itemsTotalMinor} />
            <Row label="Delivery fee" value={order.deliveryFeeMinor} />
            <Row label="Service charge" value={order.serviceFeeMinor} />
            {order.tipMinor > 0 ? <Row label="Rider support" value={order.tipMinor} /> : null}
            <Row label="Total" value={order.totalMinor} bold />
          </>
        )}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          onPress={goHome}
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>Back to Home</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.bold]}>{formatMinorFixed(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    paddingHorizontal: SIDE,
    paddingTop: 32,
    paddingBottom: 24,
  },
  loading: {
    marginTop: 80,
  },
  check: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  title: {
    marginTop: 16,
    textAlign: "center",
    fontFamily: fontFamily.bold,
    fontSize: 22,
    color: colors.text,
  },
  number: {
    marginTop: 4,
    textAlign: "center",
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  status: {
    marginTop: 6,
    textAlign: "center",
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: colors.primary,
  },
  mock: {
    marginTop: 8,
    textAlign: "center",
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  section: {
    marginTop: 24,
    marginBottom: 8,
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.text,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
  },
  qty: {
    minWidth: 28,
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  flex: {
    flex: 1,
  },
  itemName: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  muted: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.textMuted,
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
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 30,
    alignItems: "center",
  },
  summaryLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
  summaryValue: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: colors.text,
  },
  bold: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.text,
  },
  footer: {
    paddingHorizontal: SIDE,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  button: {
    minHeight: 56,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: colors.white,
  },
  pressed: {
    opacity: 0.7,
  },
});
