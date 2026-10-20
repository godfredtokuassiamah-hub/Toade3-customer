// Two-handle price slider over the histogram (gesture-handler + reanimated).
//
// - One Pan on the whole chart; the nearest handle is picked on touch-down.
//   activeOffsetX / failOffsetY: a vertical drag fails the pan, so the
//   sheet's ScrollView keeps scrolling.
// - Handle positions and the range label update on the UI thread; the draft
//   (and therefore the preview fetch) changes only on gesture end.
// - Far left = null ("Any minimum"), far right = null ("No limit").
// - Handles are accessible "adjustable" elements: increment/decrement steps
//   one bucket edge.
// - Reduce Motion: JS-driven position changes jump instead of springing.
//
// WORKLET RULES (a JS error thrown on the UI thread aborts the app on iOS):
// no default params; worklets only read captured shared values and LOCAL
// primitives copied in the component body (never module constants or
// helpers); JS is called only via scheduleOnRN with primitive arguments.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { formatMinor, formatOpenMax } from "../../lib/discovery/money";
import type { PriceFacet } from "../../lib/discovery/types";
import { colors, fontFamily } from "../../theme";
import { HISTOGRAM_HEIGHT, PriceHistogram } from "./PriceHistogram";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const HANDLE = 28;
const TOUCH_HEIGHT = 48;
// Handles glide to typed/tile/reset values without overshoot (no spring).
const SETTLE = { duration: 200, easing: Easing.out(Easing.cubic) };

type Props = {
  price: PriceFacet;
  // Current valid draft bounds (pesewas, null = unbounded).
  min: number | null;
  max: number | null;
  // Gesture end: the moved handle's new bound.
  onCommit: (handle: "min" | "max", value: number | null) => void;
  // Screen reader step.
  onStep: (handle: "min" | "max", dir: 1 | -1) => void;
};

function rangeText(min: number | null, max: number | null, hi: number): string {
  const left = min == null ? "Any minimum" : formatMinor(min);
  const right = max == null ? `No limit (${formatOpenMax(hi)})` : formatMinor(max);
  return `${left} – ${right}`;
}

export function PriceRangeSlider({ price, min, max, onCommit, onStep }: Props) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const minX = useSharedValue(0);
  const maxX = useSharedValue(0);
  const active = useSharedValue(0);

  const lo = price.min ?? 0;
  const hi = price.max ?? 0;
  const span = hi - lo;
  const usable = width > 0 && span > 0;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(Math.round(e.nativeEvent.layout.width));
  }, []);

  // JS -> UI: place handles for the draft values (typed, tile, reset).
  useEffect(() => {
    if (width <= 0) return;
    let a: number;
    let b: number;
    if (span > 0) {
      const toX = (v: number) => Math.max(0, Math.min(width, ((v - lo) / span) * width));
      a = min == null ? 0 : toX(min);
      b = max == null ? width : toX(max);
    } else {
      // One distinct price (or none): highlight only if it is in range.
      const inRange = price.min != null && (min == null || price.min >= min) && (max == null || price.min <= max);
      a = inRange ? 0 : width + 1;
      b = width;
    }
    if (reduceMotion) {
      minX.set(a);
      maxX.set(b);
    } else {
      minX.set(withTiming(a, SETTLE));
      maxX.set(withTiming(b, SETTLE));
    }
  }, [width, lo, span, min, max, price.min, reduceMotion, minX, maxX]);

  const commit = useCallback(
    (handle: number, value: number) => onCommit(handle === 1 ? "min" : "max", value < 0 ? null : value),
    [onCommit],
  );

  const pan = useMemo(() => {
    // Local primitive copies for the worklets.
    const w = width;
    const low = lo;
    const range = span;
    const high = hi;
    return Gesture.Pan()
      .enabled(usable)
      .activeOffsetX([-8, 8])
      .failOffsetY([-12, 12])
      .onBegin((e) => {
        const dMin = Math.abs(e.x - minX.get());
        const dMax = Math.abs(e.x - maxX.get());
        if (dMin < dMax) active.set(1);
        else if (dMax < dMin) active.set(2);
        else active.set(e.x < minX.get() ? 1 : 2);
      })
      .onUpdate((e) => {
        const x = Math.min(w, Math.max(0, e.x));
        if (active.get() === 1) minX.set(Math.min(x, maxX.get()));
        else if (active.get() === 2) maxX.set(Math.max(x, minX.get()));
      })
      .onEnd(() => {
        const handle = active.get();
        if (handle === 1) {
          const x = minX.get();
          let v = -1;
          if (x > 0.5) {
            v = Math.round((low + (x / w) * range) / 100) * 100;
            v = Math.max(low, Math.min(high, v));
          }
          scheduleOnRN(commit, 1, v);
        } else if (handle === 2) {
          const x = maxX.get();
          let v = -1;
          if (x < w - 0.5) {
            v = Math.round((low + (x / w) * range) / 100) * 100;
            v = Math.max(low, Math.min(high, v));
          }
          scheduleOnRN(commit, 2, v);
        }
      })
      .onFinalize(() => {
        active.set(0);
      });
  }, [width, lo, span, hi, usable, minX, maxX, active, commit]);

  // Live range label, formatted inline on the UI thread.
  const labelW = width;
  const labelLow = lo;
  const labelRange = span;
  const labelHigh = Math.round(hi / 100);
  const labelProps = useAnimatedProps(() => {
    if (labelW <= 0 || labelRange <= 0) return {} as TextInputProps;
    const a = minX.get();
    const b = maxX.get();
    const left = a <= 0.5 ? "Any minimum" : "GHS " + Math.round((labelLow + (a / labelW) * labelRange) / 100);
    const right =
      b >= labelW - 0.5
        ? "No limit (GHS " + labelHigh + "+)"
        : "GHS " + Math.round((labelLow + (b / labelW) * labelRange) / 100);
    return { text: left + " – " + right } as unknown as TextInputProps;
  });

  const half = HANDLE / 2;
  const minHandleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: minX.get() - half }],
  }));
  const maxHandleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: maxX.get() - half }],
  }));
  const fillStyle = useAnimatedStyle(() => ({
    left: minX.get(),
    width: Math.max(0, maxX.get() - minX.get()),
  }));

  const onA11y = useCallback(
    (handle: "min" | "max") => (e: AccessibilityActionEvent) => {
      if (e.nativeEvent.actionName === "increment") onStep(handle, 1);
      else if (e.nativeEvent.actionName === "decrement") onStep(handle, -1);
    },
    [onStep],
  );

  if (price.buckets.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No prices to compare</Text>
      </View>
    );
  }

  const staticLabel = rangeText(min, max, hi);

  return (
    <View>
      {usable ? (
        <AnimatedTextInput
          editable={false}
          defaultValue={staticLabel}
          animatedProps={labelProps}
          style={styles.liveLabel}
          accessible={false}
          importantForAccessibility="no"
          underlineColorAndroid="transparent"
        />
      ) : null}
      <GestureDetector gesture={pan}>
        <View style={styles.chart} collapsable={false}>
          <View onLayout={onLayout}>
            <PriceHistogram buckets={price.buckets} lo={lo} hi={hi} width={width} minX={minX} maxX={maxX} />
            <View style={styles.touch}>
              <View style={styles.track} />
              {usable ? (
                <>
                  <Animated.View style={[styles.fill, fillStyle]} />
                  <Animated.View
                    style={[styles.handle, minHandleStyle]}
                    accessible
                    accessibilityRole="adjustable"
                    accessibilityLabel="Minimum price"
                    accessibilityValue={{ text: min == null ? "Any minimum" : formatMinor(min) }}
                    accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
                    onAccessibilityAction={onA11y("min")}
                    hitSlop={10}
                  />
                  <Animated.View
                    style={[styles.handle, maxHandleStyle]}
                    accessible
                    accessibilityRole="adjustable"
                    accessibilityLabel="Maximum price"
                    accessibilityValue={{ text: max == null ? `No limit, ${formatOpenMax(hi)}` : formatMinor(max) }}
                    accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
                    onAccessibilityAction={onA11y("max")}
                    hitSlop={10}
                  />
                </>
              ) : null}
            </View>
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  liveLabel: {
    padding: 0,
    marginBottom: 10,
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.text,
  },
  chart: {
    // Room for the handle overhang at both ends.
    paddingHorizontal: HANDLE / 2,
  },
  touch: {
    height: TOUCH_HEIGHT,
    justifyContent: "center",
  },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "#E5E5E5",
  },
  fill: {
    position: "absolute",
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  handle: {
    position: "absolute",
    left: 0,
    top: (TOUCH_HEIGHT - HANDLE) / 2,
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#CFCFCF",
    shadowColor: "#000000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  empty: {
    height: HISTOGRAM_HEIGHT,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: colors.textMuted,
  },
});
