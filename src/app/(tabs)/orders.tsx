// Orders tab (Uber Eats / Bolt Food style), backed by the real orders
// (useMyOrders: Supabase, or the dev simulation in mock mode).
//
//   In progress   live orders on top; tap opens tracking
//   Past          newest first in day sections (Today, Yesterday, Mon 12 Oct);
//                 tap opens the receipt, Reorder rebuilds the cart
//
// Pull to refresh; while an order is in progress the list re-checks every
// 15 s, so it moves to Past on its own once delivered.
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCartBarInset } from "../../components/cart/useCartBarInset";
import { getTabBarClearance } from "../../components/navigation/tabBarMetrics";
import { useReorder } from "../../components/order/ReorderSheet";
import { OrderCard } from "../../components/orders/OrderCard";
import { EmptyState } from "../../components/ui/EmptyState";
import { useMyOrders } from "../../hooks/useMyOrders";
import { groupByDay, splitOrders } from "../../lib/orders/orderHistory";
import type { OrderSummary } from "../../services/orders";
import { colors, fontFamily } from "../../theme";

// Empty-state illustration from Icons8 (img.icons8.com id 0JF1WhA0SvTr).
// Icons8 requires attribution (a link to icons8.com in the app's credits)
// or a paid licence before release.
const EMPTY_ILLUSTRATION = require("../../../assets/icons/orders/empty-orders.png");

const POLL_MS = 15_000;

type Section = { key: string; title: string; data: OrderSummary[] };

const keyExtractor = (o: OrderSummary) => o.orderId;

export default function Orders() {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const cartInset = useCartBarInset();
  const { data, isPending, isError, refetch } = useMyOrders({ pollMs: POLL_MS });
  const reorder = useReorder();

  // "Today" / "Yesterday" titles follow the date the tab was last shown.
  const [today, setToday] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      setToday(new Date());
    }, []),
  );

  const sections = useMemo<Section[]>(() => {
    const { active, past } = splitOrders(data ?? []);
    const out: Section[] = [];
    if (active.length > 0) out.push({ key: "active", title: "In progress", data: active });
    for (const g of groupByDay(past, today)) out.push({ key: g.key, title: g.title, data: g.orders });
    return out;
  }, [data, today]);

  const [pulling, setPulling] = useState(false);
  const onRefresh = useCallback(async () => {
    setPulling(true);
    try {
      await refetch();
    } finally {
      setPulling(false);
    }
  }, [refetch]);

  const onPress = useCallback((o: OrderSummary) => {
    router.push({ pathname: "/order/[id]", params: { id: o.orderId } });
  }, []);
  const { start, busyId } = reorder;
  const onReorder = useCallback((o: OrderSummary) => void start(o.orderId), [start]);

  const bottomInset = getTabBarClearance(insets.bottom, fontScale);

  const header = (
    <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title} accessibilityRole="header">
        My orders
      </Text>
    </View>
  );

  if (isPending || (isError && !data)) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        {header}
        <View style={styles.center}>
          {isPending ? (
            <ActivityIndicator color={colors.primary} accessibilityLabel="Loading orders" />
          ) : (
            <>
              <Text style={styles.muted} accessibilityRole="alert">
                Couldn&apos;t load your orders.
              </Text>
              <Pressable
                onPress={() => void refetch()}
                accessibilityRole="button"
                accessibilityLabel="Try again"
                style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
              >
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    );
  }

  if (sections.length === 0) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <EmptyState
          image={EMPTY_ILLUSTRATION}
          title="No orders yet"
          body="When you place an order, it shows up here so you can track it and reorder in a tap."
          bottomInset={bottomInset}
        >
          <Pressable
            onPress={() => router.navigate("/home")}
            accessibilityRole="button"
            accessibilityLabel="Find something to eat"
            style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
          >
            <Text style={styles.retryText}>Find something to eat</Text>
          </Pressable>
        </EmptyState>
        <View style={[styles.floatingTitle, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <Text style={styles.title} accessibilityRole="header">
            My orders
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {header}
      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => (
          <OrderCard order={item} onPress={onPress} onReorder={onReorder} reordering={busyId === item.orderId} />
        )}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.section, section.key === "active" && styles.sectionActive]} accessibilityRole="header">
            {section.title}
          </Text>
        )}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + cartInset + 8 }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={colors.primary} />}
      />
      {reorder.sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    backgroundColor: colors.white,
  },
  floatingTitle: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 24,
    color: colors.text,
  },
  section: {
    marginTop: 18,
    marginBottom: 10,
    paddingHorizontal: 16,
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.text,
  },
  sectionActive: {
    color: colors.primary,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 24,
  },
  muted: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
  },
  retry: {
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  retryText: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.white,
  },
  pressed: {
    opacity: 0.7,
  },
});
