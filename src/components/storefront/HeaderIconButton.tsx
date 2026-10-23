// Round header button for the storefront. The white circle behind the glyph
// is a separate Animated.View whose OPACITY fades out as the compact bar
// fades in (no size animation, no blur/glass view — glass crash rule).
import { memo, type ReactNode } from "react";
import { Pressable, type StyleProp, StyleSheet, type ViewStyle } from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";

import { CIRCLE } from "./metrics";

type Props = {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  circleStyle?: StyleProp<AnimatedStyle<ViewStyle>>;
  selected?: boolean;
};

function HeaderIconButtonBase({ icon, label, onPress, circleStyle, selected }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected != null ? { selected } : undefined}
      hitSlop={2}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Animated.View style={[styles.circle, circleStyle]} pointerEvents="none" />
      {icon}
    </Pressable>
  );
}

export const HeaderIconButton = memo(HeaderIconButtonBase);

const styles = StyleSheet.create({
  button: {
    width: CIRCLE,
    height: CIRCLE,
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: CIRCLE / 2,
    backgroundColor: "rgba(255,255,255,0.92)",
    boxShadow: "0px 1px 4px rgba(0,0,0,0.16)",
  },
  pressed: {
    opacity: 0.7,
  },
});
