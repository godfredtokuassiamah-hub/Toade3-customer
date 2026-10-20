import { useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors, text } from "../../theme";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

// Full-width brand button. Grey + inert while disabled, animates to orange
// (~200 ms) when enabled, and shows a spinner while loading.
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
}: Props) {
  const reducedMotion = useReducedMotion();
  const enabled = useSharedValue(disabled ? 0 : 1);

  useEffect(() => {
    const target = disabled ? 0 : 1;
    enabled.value = reducedMotion ? target : withTiming(target, { duration: 200 });
  }, [disabled, reducedMotion, enabled]);

  const fillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      enabled.value,
      [0, 1],
      [colors.disabledFill, colors.primary],
    ),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      enabled.value,
      [0, 1],
      [colors.disabledText, colors.white],
    ),
  }));

  const inert = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inert, busy: loading }}
      style={({ pressed }) => [style, pressed && !inert && styles.pressed]}
    >
      <Animated.View style={[styles.button, fillStyle]}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Animated.Text style={[text.button, labelStyle]}>{label}</Animated.Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
