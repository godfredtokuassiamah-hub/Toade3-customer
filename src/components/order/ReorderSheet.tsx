// "Order again" flow (Uber Eats / Bolt Food style), shared by the Orders tab
// and the completed-order receipt.
//
// start(orderId): loads the order, rebuilds the cart against today's catalog
// (lib/orders/reorder), then shows a review sheet:
//   - ready:   items + today's subtotal, what changed (sold out, new price,
//              removed option), and a note when it replaces the current
//              cart. "Add to cart" replaces the cart and opens checkout,
//              where the server prices the order again.
//   - blocked: why (store closed / gone / nothing left) + View store.
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getItemsByIds, getVendorById } from "../../data/mock/catalog";
import { getOptionGroups } from "../../data/mock/itemOptions";
import { qk } from "../../lib/backend/queryKeys";
import { queryClient } from "../../lib/backend/queryClient";
import { addToCart, cartCount, clearCart, getCart, lineTotal, newLineId } from "../../lib/cart/cartStore";
import { formatMinorFixed } from "../../lib/discovery/money";
import { vendorOpenAt } from "../../lib/discovery/predicate";
import { errorHaptic, lightHaptic, successHaptic } from "../../lib/haptics";
import { blockedText, changeText, planReorder, type ReorderPlan } from "../../lib/orders/reorder";
import { getOrder } from "../../services/orders";
import { colors, fontFamily } from "../../theme";
import { BottomSheet } from "../ui/BottomSheet";

type Next = { kind: "checkout" } | { kind: "store"; vendorId: string } | null;

export function useReorder() {
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<ReorderPlan | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Existing cart when the sheet opened (reorder replaces it).
  const [existing, setExisting] = useState<{ count: number; vendor: string | null }>({ count: 0, vendor: null });
  const next = useRef<Next>(null);

  const start = useCallback(
    async (orderId: string) => {
      if (busyId) return;
      lightHaptic();
      setBusyId(orderId);
      try {
        const order = await queryClient.fetchQuery({
          queryKey: qk.order(orderId),
          queryFn: () => getOrder(orderId),
          staleTime: 10_000,
        });
        if (!order) throw new Error("ORDER_NOT_FOUND");
        const vendor = getVendorById(order.vendorId);
        const p = planReorder(order, {
          vendor,
          vendorOpen: vendor ? vendorOpenAt(vendor, new Date()) : false,
          item: (id) => getItemsByIds([id])[0],
          groups: (item) => getOptionGroups(item.item_id, item.category_ids),
          newLineId,
        });
        const cart = getCart();
        setExisting({ count: cartCount(cart), vendor: cart.lines[0]?.vendorName ?? null });
        setVendorId(vendor ? order.vendorId : null);
        setPlan(p);
        setVisible(true);
      } catch {
        errorHaptic();
        Alert.alert("Couldn't reorder", "Check your connection and try again.");
      } finally {
        setBusyId(null);
      }
    },
    [busyId],
  );

  const close = () => setVisible(false);

  const confirm = () => {
    if (plan?.kind !== "ready") return;
    // One store per cart: reorder starts a fresh cart with these lines.
    clearCart();
    for (const line of plan.lines) addToCart(line, false);
    successHaptic();
    next.current = { kind: "checkout" };
    setVisible(false);
  };

  const viewStore = () => {
    if (!vendorId) return;
    next.current = { kind: "store", vendorId };
    setVisible(false);
  };

  // Navigate only after the exit animation.
  const onClosed = () => {
    const n = next.current;
    next.current = null;
    setPlan(null);
    if (n?.kind === "checkout") router.push("/checkout");
    else if (n?.kind === "store") router.push({ pathname: "/storefront/[vendorId]", params: { vendorId: n.vendorId } });
  };

  const fmt = (m: number) => formatMinorFixed(m);
  let body = null;
  if (plan?.kind === "ready") {
    const subtotal = plan.lines.reduce((s, l) => s + lineTotal(l), 0);
    const count = plan.lines.reduce((s, l) => s + l.qty, 0);
    body = (
      <>
        <Text style={styles.title} accessibilityRole="header">
          Order again from {plan.vendorName}
        </Text>
        <Text style={styles.sub}>
          {`${count} ${count === 1 ? "item" : "items"} \u00b7 ${fmt(subtotal)}`}
        </Text>
        <View style={styles.lines}>
          {plan.lines.map((l) => (
            <View key={l.lineId} style={styles.lineRow}>
              <Text style={styles.qty}>{l.qty}\u00d7</Text>
              <View style={styles.flex}>
                <Text style={styles.lineName} numberOfLines={1}>
                  {l.name}
                </Text>
                {l.options.length > 0 ? (
                  <Text style={styles.muted} numberOfLines={1}>
                    {l.options.map((o) => o.label).join(", ")}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.amount}>{fmt(lineTotal(l))}</Text>
            </View>
          ))}
        </View>
        {plan.changes.length > 0 ? (
          <View style={styles.changes} accessibilityLiveRegion="polite">
            <Text style={styles.changesTitle}>A few things changed</Text>
            {plan.changes.map((c, i) => (
              <Text key={i} style={styles.change}>
                {`\u2022 ${changeText(c, fmt)}`}
              </Text>
            ))}
          </View>
        ) : null}
        <Text style={styles.note}>
          {existing.count > 0
            ? `This replaces the ${existing.count} ${existing.count === 1 ? "item" : "items"} in your cart${existing.vendor ? ` from ${existing.vendor}` : ""}. `
            : ""}
          Prices are today&apos;s; delivery is worked out at checkout.
        </Text>
        <Pressable
          onPress={confirm}
          accessibilityRole="button"
          accessibilityLabel={`Add to cart, ${fmt(subtotal)}`}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>{`Add to cart \u00b7 ${fmt(subtotal)}`}</Text>
        </Pressable>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Not now"
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>Not now</Text>
        </Pressable>
      </>
    );
  } else if (plan?.kind === "blocked") {
    body = (
      <>
        <Text style={styles.title} accessibilityRole="header">
          Can&apos;t reorder right now
        </Text>
        <Text style={styles.sub}>{blockedText(plan.reason, plan.vendorName)}</Text>
        {plan.changes.length > 0 ? (
          <View style={styles.changes}>
            {plan.changes.map((c, i) => (
              <Text key={i} style={styles.change}>
                {`\u2022 ${changeText(c, fmt)}`}
              </Text>
            ))}
          </View>
        ) : null}
        {vendorId && plan.reason !== "store-unavailable" ? (
          <Pressable
            onPress={viewStore}
            accessibilityRole="button"
            accessibilityLabel={`View ${plan.vendorName}`}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>View store</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="OK"
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>OK</Text>
        </Pressable>
      </>
    );
  }

  const sheet = (
    <BottomSheet
      visible={visible}
      onClose={close}
      onClosed={onClosed}
      backdrop="dim"
      fitContent
      accessibilityLabel="Order again"
    >
      <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, 16) }]}>{body}</View>
    </BottomSheet>
  );

  return { start, busyId, sheet };
}

// Small "Reorder" pill, used by cards and the receipt.
export function ReorderButton({
  onPress,
  busy,
  label = "Reorder",
  large = false,
}: {
  onPress: () => void;
  busy: boolean;
  label?: string;
  large?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy }}
      hitSlop={6}
      style={({ pressed }) => [large ? styles.primary : styles.pill, (pressed || busy) && styles.pressed]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={large ? colors.white : colors.text} />
      ) : (
        <Text style={large ? styles.primaryText : styles.pillText}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  flex: {
    flex: 1,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
  },
  sub: {
    marginTop: 4,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  lines: {
    marginTop: 14,
    gap: 10,
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  qty: {
    minWidth: 26,
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.text,
  },
  lineName: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: colors.text,
  },
  muted: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  amount: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: colors.text,
  },
  changes: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    gap: 4,
  },
  changesTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: colors.text,
  },
  change: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },
  note: {
    marginTop: 12,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  primary: {
    marginTop: 16,
    minHeight: 52,
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
    marginTop: 4,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  pill: {
    minHeight: 36,
    minWidth: 92,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: colors.text,
  },
  pressed: {
    opacity: 0.7,
  },
});
