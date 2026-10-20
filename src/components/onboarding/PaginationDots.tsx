import { StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

const INACTIVE = "#D9D9D9";
const DOT = 6;
const PILL = 40;

type Props = {
  total: number;
  // Used for the accessibility label only; visuals follow `progress`.
  activeIndex: number;
  // Scroll position in pages (0 = slide 1, 1 = slide 2, ...).
  progress: SharedValue<number>;
  activeColor: SharedValue<string>;
};

export function PaginationDots({
  total,
  activeIndex,
  progress,
  activeColor,
}: Props) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`Slide ${activeIndex + 1} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <Dot key={i} index={i} progress={progress} activeColor={activeColor} />
      ))}
    </View>
  );
}

function Dot({
  index,
  progress,
  activeColor,
}: {
  index: number;
  progress: SharedValue<number>;
  activeColor: SharedValue<string>;
}) {
  // Each dot grows into the pill as the pager approaches its page.
  const style = useAnimatedStyle(() => {
    const a = interpolate(
      progress.value,
      [index - 1, index, index + 1],
      [0, 1, 0],
      Extrapolation.CLAMP,
    );
    return {
      width: DOT + (PILL - DOT) * a,
      backgroundColor: interpolateColor(a, [0, 1], [INACTIVE, activeColor.value]),
    };
  });

  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    height: DOT,
    borderRadius: DOT / 2,
  },
});
