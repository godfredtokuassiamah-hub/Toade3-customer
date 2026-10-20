// "Item prices near you": lightweight View bars from the REAL price buckets
// of the last discovery preview (never decorative). Bars overlapping the
// chosen interval are orange, the rest light grey. Highlighting follows the
// slider handles on the UI thread.
//
// Worklet rules (a throwing UI-thread worklet aborts the app on iOS): no
// default params, only captured shared values and local primitives.
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { type SharedValue, useAnimatedStyle } from "react-native-reanimated";

import type { PriceBucket } from "../../lib/discovery/types";
import { colors } from "../../theme";

export const HISTOGRAM_HEIGHT = 64;

type BarProps = {
  left: number;
  width: number;
  height: number;
  isLast: boolean;
  minX: SharedValue<number>;
  maxX: SharedValue<number>;
};

const Bar = memo(function Bar({ left, width, height, isLast, minX, maxX }: BarProps) {
  // Local primitives only: the worklet captures these, never module objects.
  const onColor: string = colors.primary;
  const offColor = "#E5E5E5";
  const right = left + width;
  const last = isLast;
  const style = useAnimatedStyle(() => {
    const lo = minX.get();
    const hi = maxX.get();
    const aboveMin = last ? right >= lo : right > lo;
    const on = aboveMin && left <= hi;
    return { backgroundColor: on ? onColor : offColor };
  });
  return <Animated.View style={[styles.bar, { left, width: Math.max(1, width - 2), height }, style]} />;
});

export const PriceHistogram = memo(function PriceHistogram({
  buckets,
  lo,
  hi,
  width,
  minX,
  maxX,
}: {
  buckets: PriceBucket[];
  lo: number;
  hi: number;
  width: number;
  minX: SharedValue<number>;
  maxX: SharedValue<number>;
}) {
  if (width <= 0 || buckets.length === 0) return <View style={styles.box} />;
  const span = hi - lo;
  const peak = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <View style={styles.box} accessible={false} importantForAccessibility="no-hide-descendants">
      {buckets.map((b, i) => {
        // One distinct price: a single full-width bucket.
        const left = span > 0 ? ((b.lower - lo) / span) * width : 0;
        const w = span > 0 ? ((b.upper - b.lower) / span) * width : width;
        const h = b.count === 0 ? 0 : Math.max(3, Math.round((b.count / peak) * HISTOGRAM_HEIGHT));
        return (
          <Bar
            key={`${b.lower}-${b.upper}`}
            left={left}
            width={w}
            height={h}
            isLast={i === buckets.length - 1}
            minX={minX}
            maxX={maxX}
          />
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  box: {
    height: HISTOGRAM_HEIGHT,
  },
  bar: {
    position: "absolute",
    bottom: 0,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
});
