// Order screen, opened by checkout after place_order succeeds (placed=1) or
// later for an existing order. The Orders tab (another tool) owns history.
//
// Checkout replaces itself with this route (so back can't return to it) and
// passes placed=1: only the OrderPlacedSheet shows, over a blank screen.
// "Track order" closes the sheet and then shows the tracking screen
// (components/order/OrderTracking); Back to home, drag down, backdrop tap
// and Android back dismiss to Home.
//
// Tracking polls the order and its live timeline (order_tracking, 0010)
// every 10 s until a final status, so "Waiting for confirmation" turns into
// "Preparing order" (and Cancel locks) without a refresh. The ETA comes from
// the server; before 0010 is deployed the same model runs on the device.
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OrderPlacedSheet } from "../../components/order/OrderPlacedSheet";
import { OrderReceipt } from "../../components/order/OrderReceipt";
import { OrderTrackingView } from "../../components/order/OrderTracking";
import { useOrder, useOrderTracking } from "../../hooks/useMyOrders";
import { isOrderStatus, parseEtaParams } from "../../lib/orders/orderPlaced";
import { isTerminal } from "../../lib/orders/orderTracking";
import { localTracking } from "../../services/orders";
import { colors, fontFamily } from "../../theme";

const POLL_MS = 10_000;

export default function OrderScreen() {
  const insets = useSafeAreaInsets();
  const { id, placed, status, etaMin, etaMax } = useLocalSearchParams<{
    id: string;
    placed?: string;
    status?: string;
    etaMin?: string;
    etaMax?: string;
  }>();
  const { data: order, isPending, isError, isFetching } = useOrder(id, { pollMs: POLL_MS });
  // Live timeline + server ETA (0010). null before 0010 is deployed: the
  // same model then runs on the device from the order itself.
  const tracking = useOrderTracking(id, { pollMs: POLL_MS });
  // Checkout's server quote: only for the order-placed sheet's first frame.
  const eta = parseEtaParams(etaMin, etaMax);

  // Came straight from checkout: back goes Home (checkout was replaced).
  const fromCheckout = useRef(placed === "1").current;
  const onBack = () => {
    if (fromCheckout || !router.canGoBack()) router.dismissTo("/home");
    else router.back();
  };

  // Order-placed sheet: where to go once its exit animation finishes.
  const [sheetOpen, setSheetOpen] = useState(placed === "1");
  // Right after placing, ONLY the sheet shows; tracking appears once the
  // user picks Track order. Back to home never reveals it.
  const [detailVisible, setDetailVisible] = useState(placed !== "1");
  const nextRef = useRef<"home" | "track">("home");
  const onTrack = () => {
    nextRef.current = "track";
    setSheetOpen(false);
  };
  const onSheetHome = () => {
    nextRef.current = "home";
    setSheetOpen(false);
  };
  const onSheetClosed = () => {
    router.setParams({ placed: undefined });
    if (nextRef.current === "home") router.dismissTo("/home");
    else setDetailVisible(true);
  };

  const sheet = (
    <OrderPlacedSheet
      visible={sheetOpen}
      order={order ?? null}
      fallbackStatus={isOrderStatus(status) ? status : "pending"}
      orderId={id}
      eta={eta}
      onTrack={onTrack}
      onHome={onSheetHome}
      onClosed={onSheetClosed}
    />
  );

  if (!detailVisible) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        {sheet}
      </View>
    );
  }

  if (order) {
    const live = tracking.data ?? localTracking(order);
    // Delivered / cancelled / declined: receipt with Reorder, like Uber/Bolt.
    const finished = isTerminal(live.version >= order.version ? live.status : order.status);
    return (
      <>
        <StatusBar style="dark" />
        {finished ? (
          <OrderReceipt order={order} tracking={live} onBack={onBack} />
        ) : (
          <OrderTrackingView
            order={order}
            tracking={live}
            refreshing={(isFetching && !isPending) || tracking.isFetching}
            onBack={onBack}
          />
        )}
        {sheet}
      </>
    );
  }

  return (
    <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      {isPending ? (
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading order" />
      ) : (
        <>
          <Text style={styles.muted} accessibilityRole="alert">
            {isError ? "Couldn't load this order. It was placed; check Orders shortly." : "Order not found."}
          </Text>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>Back</Text>
          </Pressable>
        </>
      )}
      {sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 16,
  },
  muted: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 28,
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
