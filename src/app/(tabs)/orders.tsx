// Orders tab. Shows the "My orders" history as white drop-shadow cards
// (swipe a card left to delete it). When the list is empty it falls back to
// the shared animated-gradient empty state (src/components/ui/EmptyState.tsx).
//
// The orders are dummy data for now (src/data/mock/orders.ts); the real list
// will be driven by the authorized order source the notification engine
// defines. Reorder and tapping a card are no-ops until those flows exist.
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getTabBarClearance } from "../../components/navigation/tabBarMetrics";
import { OrderCard } from "../../components/orders/OrderCard";
import { EmptyState } from "../../components/ui/EmptyState";
import { MOCK_ORDERS, type MockOrder } from "../../data/mock/orders";
import { colors, fontFamily } from "../../theme";

// Empty-state illustration from Icons8 (img.icons8.com id 0JF1WhA0SvTr).
// Icons8 requires attribution (a link to icons8.com in the app's credits)
// or a paid licence before release.
const EMPTY_ILLUSTRATION = require("../../../assets/icons/orders/empty-orders.png");

export default function Orders() {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [orders, setOrders] = useState<MockOrder[]>(MOCK_ORDERS);

  const onDelete = useCallback((id: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }, []);
  // TODO(orders): open the order / start a reorder flow once they exist.
  const onPress = useCallback((_order: MockOrder) => {}, []);
  const onReorder = useCallback((_order: MockOrder) => {}, []);

  const bottomInset = getTabBarClearance(insets.bottom, fontScale);

  if (orders.length === 0) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <EmptyState
          image={EMPTY_ILLUSTRATION}
          title="No orders yet"
          body="When you place an order, it shows up here so you can track it and reorder in a tap."
          bottomInset={bottomInset}
        />
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: bottomInset },
        ]}
      >
        <Text style={styles.title} accessibilityRole="header">
          My orders
        </Text>
        <View style={styles.list}>
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onPress={onPress}
              onReorder={onReorder}
              onDelete={onDelete}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    paddingHorizontal: 16,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 28,
    color: colors.text,
    marginBottom: 16,
  },
  list: {
    // Cards carry their own bottom margin.
  },
});
