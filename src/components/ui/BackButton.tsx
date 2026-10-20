import { useState } from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { Icon } from "./Icon";

const ICON_SIZE = 20;

export type BackButtonProps = {
  onPress: () => void;
  // outline: border + arrow colour. filled: fill colour (arrow is white).
  // Accepts a shared value so it can follow an animated colour.
  color?: string | SharedValue<string>;
  variant?: "outline" | "filled";
  // Diameter in dp.
  size?: number;
  accessibilityLabel?: string;
  hitSlop?: PressableProps["hitSlop"];
  // Applied to the outer Pressable.
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

// Generic circular back button with a left arrow.
export function BackButton({
  onPress,
  color = "#000000",
  variant = "outline",
  size = 60,
  accessibilityLabel = "Back",
  hitSlop = 8,
  style,
  disabled = false,
}: BackButtonProps) {
  const filled = variant === "filled";
  const animatedColor = typeof color === "string" ? null : color;

  // SymbolView's tint is a plain prop, so mirror an animated colour into
  // state on the JS thread (one small re-render per frame while paging).
  const [animatedTint, setAnimatedTint] = useState<string | null>(null);
  useAnimatedReaction(
    () => (animatedColor === null ? null : animatedColor.value),
    (current, previous) => {
      if (current !== null && current !== previous) {
        scheduleOnRN(setAnimatedTint, current);
      }
    },
  );

  const iconColor = filled
    ? "#FFFFFF"
    : typeof color === "string"
      ? color
      : animatedTint;

  const colorStyle = useAnimatedStyle(() => {
    const c = typeof color === "string" ? color : color.value;
    return filled ? { backgroundColor: c } : { borderColor: c };
  });

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={hitSlop}
      style={({ pressed }) => [style, pressed && styles.pressed]}
    >
      <Animated.View
        style={[
          styles.button,
          !filled && styles.outline,
          { width: size, height: size, borderRadius: size / 2 },
          colorStyle,
        ]}
      >
        {iconColor !== null ? (
          <Icon
            name="arrowLeft"
            size={ICON_SIZE}
            color={iconColor}
            weight="medium"
          />
        ) : (
          // First frame before the animated colour reaches JS.
          <View style={styles.iconSlot} />
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
  },
  outline: {
    borderWidth: 2,
    backgroundColor: "#FFFFFF",
  },
  iconSlot: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  pressed: {
    opacity: 0.85,
  },
});
