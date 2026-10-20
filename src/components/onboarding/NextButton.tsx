import { Pressable, StyleSheet } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { Icon } from "../ui/Icon";

type Props = {
  onPress: () => void;
  // Current slide colour, interpolated while paging.
  color: SharedValue<string>;
  accessibilityLabel?: string;
};

export function NextButton({
  onPress,
  color,
  accessibilityLabel = "Next",
}: Props) {
  const fillStyle = useAnimatedStyle(() => ({
    backgroundColor: color.value,
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Animated.View style={[styles.button, fillStyle]}>
        <Icon name="arrowRight" size={20} color="#FFFFFF" weight="medium" />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.85,
  },
});
