import { Tabs } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { CartBar } from "../../components/cart/CartBar";
import { FloatingTabBar } from "../../components/navigation/FloatingTabBar";
import { TabBarScrollProvider } from "../../components/navigation/TabBarScrollContext";
// Side effect: starts the query cache (focus / online managers, persister).
import "../../lib/backend/queryClient";
import { startCartSync } from "../../services/cartSync";
import { colors } from "../../theme";

// Bottom tabs with the custom floating glass capsule. The provider shares the
// bar's compaction state with Home's scroll handler. Screens stay mounted
// once visited (default lazy, no unmount/popToTop), so each tab keeps its
// scroll position. Android back from any other tab returns to Home first,
// then exits. Switching tabs cross-fades the scenes (opacity only, no layout
// move); the bar renders outside the scenes, so the fade never touches the
// glass. Reduced Motion switches instantly.
export default function TabsLayout() {
  const reducedMotion = useReducedMotion();
  // Background server-cart sync (never blocks the local cart).
  useEffect(() => startCartSync(), []);
  return (
    <TabBarScrollProvider>
      <View style={styles.fill}>
      <Tabs
        initialRouteName="home"
        backBehavior="firstRoute"
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.white },
          animation: reducedMotion ? "none" : "fade",
        }}
        tabBar={(props) => <FloatingTabBar {...props} />}
      >
        <Tabs.Screen name="home" />
        <Tabs.Screen name="stores" />
        <Tabs.Screen name="map" />
        <Tabs.Screen name="orders" />
        <Tabs.Screen name="account" />
      </Tabs>
      {/* Floating cart bar above every tab's scene and the tab bar; absolute
          with box-none, so only the pill itself takes touches. */}
      <CartBar placement="tabs" />
      </View>
    </TabBarScrollProvider>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
