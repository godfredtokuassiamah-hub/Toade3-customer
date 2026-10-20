import { Tabs } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";

import { FloatingTabBar } from "../../components/navigation/FloatingTabBar";
import { TabBarScrollProvider } from "../../components/navigation/TabBarScrollContext";
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
  return (
    <TabBarScrollProvider>
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
        <Tabs.Screen name="explore" />
        <Tabs.Screen name="orders" />
        <Tabs.Screen name="account" />
      </Tabs>
    </TabBarScrollProvider>
  );
}
