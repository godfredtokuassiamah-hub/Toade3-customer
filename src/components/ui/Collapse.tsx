import { type ReactNode, useEffect } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type Props = {
  visible: boolean;
  children: ReactNode;
  duration?: number;
};

// Animates height + opacity open/closed so content below doesn't jump.
// Children are measured off-flow (absolute), so their natural height is known
// even while the container is collapsed.
export function Collapse({ visible, children, duration = 180 }: Props) {
  const reducedMotion = useReducedMotion();
  const open = useSharedValue(visible ? 1 : 0);
  const contentHeight = useSharedValue(0);

  useEffect(() => {
    const target = visible ? 1 : 0;
    open.value = reducedMotion ? target : withTiming(target, { duration });
  }, [visible, reducedMotion, duration, open]);

  const onLayout = (e: LayoutChangeEvent) => {
    contentHeight.value = e.nativeEvent.layout.height;
  };

  const style = useAnimatedStyle(() => ({
    height: contentHeight.value * open.value,
    opacity: open.value,
  }));

  return (
    <Animated.View
      style={[styles.clip, style]}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
      pointerEvents={visible ? "box-none" : "none"}
    >
      <View style={styles.content} onLayout={onLayout}>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden",
  },
  content: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
});
