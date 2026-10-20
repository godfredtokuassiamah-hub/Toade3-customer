import { useEffect, useState } from "react";
import {
  AppState,
  type ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getGreeting } from "../../lib/format";
import { colors, fontFamily } from "../../theme";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";

type Props = {
  firstName: string;
  fullName: string;
  avatar?: ImageSourcePropType;
  locationLabel: string;
  // Home scroll offset; fades in the bottom hairline once content scrolls under.
  scrollY: SharedValue<number>;
};

// Pinned header (rendered outside the scroll view, so it never moves).
export function HomeTopBar({
  firstName,
  fullName,
  avatar,
  locationLabel,
  scrollY,
}: Props) {
  const insets = useSafeAreaInsets();
  const [greeting, setGreeting] = useState(() => getGreeting(new Date()));

  // Refresh when the app returns to the foreground (morning -> afternoon).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setGreeting(getGreeting(new Date()));
    });
    return () => sub.remove();
  }, []);

  const hairlineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 12], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <Avatar source={avatar} name={fullName} size={44} />
        <View style={styles.info}>
          <Pressable
            // TODO(location): open the drop-point picker.
            onPress={() => {}}
            accessibilityRole="button"
            accessibilityLabel={`Delivery location, ${locationLabel}`}
            accessibilityHint="Changes the drop point"
            hitSlop={8}
            style={({ pressed }) => [styles.location, pressed && styles.pressed]}
          >
            <Text style={styles.locationText} numberOfLines={1}>
              {locationLabel}
            </Text>
            <Icon
              name="chevronDown"
              size={14}
              color={colors.text}
              weight="semibold"
            />
          </Pressable>
          <Text style={styles.greeting} numberOfLines={1}>
            {`${greeting}, ${firstName}`}
          </Text>
        </View>
        <Pressable
          // TODO(support): open support chat.
          onPress={() => {}}
          accessibilityRole="button"
          accessibilityLabel="Support chat"
          hitSlop={4}
          style={({ pressed }) => [styles.chat, pressed && styles.pressed]}
        >
          <Icon name="chat" size={20} color={colors.primary} />
        </Pressable>
      </View>
      <Animated.View
        style={[styles.hairline, hairlineStyle]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    zIndex: 1,
  },
  row: {
    height: 60,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  info: {
    flex: 1,
    marginLeft: 10,
    marginRight: 12,
    alignItems: "flex-start",
  },
  location: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
  },
  locationText: {
    flexShrink: 1,
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  greeting: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  chat: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  hairline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: colors.hairline,
  },
});
