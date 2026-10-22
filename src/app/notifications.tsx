// Notifications screen (root stack route above the tabs). Opened from the
// bell in the Home top bar. Until the notification engine lands, it shows the
// shared animated-gradient empty state (src/components/ui/EmptyState.tsx).
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { searchStyles } from "../components/search/searchStyles";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { colors, fontFamily } from "../theme";

// Empty-state illustration from Icons8 (img.icons8.com id q83D9p2dPS2W).
// Icons8 requires attribution (a link to icons8.com in the app's credits)
// or a paid licence before release.
const EMPTY_ILLUSTRATION = require("../../assets/icons/notifications/empty-notifications.png");

export default function Notifications() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <EmptyState
        image={EMPTY_ILLUSTRATION}
        title="No notifications yet"
        body="Updates about your orders and account will show up here."
      />
      {/* Transparent top bar over the gradient wash. */}
      <View style={[styles.topBar, { paddingTop: insets.top }]} pointerEvents="box-none">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={4}
          style={({ pressed }) => [styles.iconButton, pressed && searchStyles.pressed]}
        >
          <Icon name="arrowLeft" size={20} color={colors.text} weight="medium" />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Notifications
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 8,
    backgroundColor: "transparent",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    color: colors.text,
  },
});
