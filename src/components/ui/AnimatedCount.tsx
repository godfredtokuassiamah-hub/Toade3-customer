// Rolling number: on change the old value slides out and the new one slides
// in from the direction of change (increase: up from below; decrease: down
// from above) with an opacity crossfade and a 0.9 -> 1 scale. Two stacked
// layers in a fixed-size clipped box, so the parent never jitters.
//
// Each change retargets both layers from wherever they are, so rapid taps
// never glitch. Reduce Motion: instant change.
//
// Worklet rules (a throwing UI-thread worklet aborts the app on iOS): no
// default params, only captured shared values / primitives, no helper calls.
import { useLayoutEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { colors, fontFamily as fonts } from "../../theme";

type Props = {
  value: number;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  // Screen reader label for the number (default: the value itself).
  accessibilityLabel?: string;
};

const ROLL = { duration: 220, easing: Easing.bezier(0.25, 0.1, 0.25, 1) };
// Approximate advance of one tabular digit, as a fraction of the font size.
const DIGIT_RATIO = 0.64;
const MIN_DIGITS = 2;

type Slots = {
  value: number;
  texts: [number, number];
  active: 0 | 1;
  dir: 1 | -1;
  seq: number;
};

export function AnimatedCount({
  value,
  fontSize = 16,
  color = colors.text,
  fontFamily = fonts.semibold,
  accessibilityLabel,
}: Props) {
  const reducedMotion = useReducedMotion();
  // Position per layer: 0 = shown, +1 = below, -1 = above.
  const pos0 = useSharedValue(0);
  const pos1 = useSharedValue(1);

  const [slots, setSlots] = useState<Slots>(() => ({
    value,
    texts: [value, value],
    active: 0,
    dir: 1,
    seq: 0,
  }));
  // Derive the new layer texts during render so the incoming text and its
  // animation start land in the same commit.
  if (slots.value !== value) {
    const incoming: 0 | 1 = slots.active === 0 ? 1 : 0;
    const texts: [number, number] = [slots.texts[0], slots.texts[1]];
    texts[incoming] = value;
    setSlots({
      value,
      texts,
      active: incoming,
      dir: value > slots.value ? 1 : -1,
      seq: slots.seq + 1,
    });
  }

  useLayoutEffect(() => {
    if (slots.seq === 0) return;
    const inPos = slots.active === 0 ? pos0 : pos1;
    const outPos = slots.active === 0 ? pos1 : pos0;
    if (reducedMotion) {
      inPos.set(0);
      outPos.set(-slots.dir);
      return;
    }
    // Incoming snaps to its start side, then rolls in; outgoing continues
    // from its current position.
    inPos.set(withSequence(withTiming(slots.dir, { duration: 0 }), withTiming(0, ROLL)));
    outPos.set(withTiming(-slots.dir, ROLL));
  }, [slots.seq, slots.active, slots.dir, reducedMotion, pos0, pos1]);

  const height = Math.round(fontSize * 1.4);
  const digits = Math.max(MIN_DIGITS, String(value).length);
  const width = Math.ceil(digits * fontSize * DIGIT_RATIO);
  const textStyle = { fontSize, lineHeight: height, color, fontFamily };

  return (
    <View
      style={[styles.box, { width, height }]}
      accessible
      accessibilityLabel={accessibilityLabel ?? `${value}`}
    >
      <Layer pos={pos0} height={height} text={slots.texts[0]} textStyle={textStyle} />
      <Layer pos={pos1} height={height} text={slots.texts[1]} textStyle={textStyle} />
    </View>
  );
}

function Layer({
  pos,
  height,
  text,
  textStyle,
}: {
  pos: SharedValue<number>;
  height: number;
  text: number;
  textStyle: { fontSize: number; lineHeight: number; color: string; fontFamily: string };
}) {
  const h = height;
  const style = useAnimatedStyle(() => {
    const p = pos.value;
    const a = Math.min(1, Math.abs(p));
    return {
      opacity: 1 - a,
      transform: [{ translateY: p * h }, { scale: 1 - 0.1 * a }],
    };
  });
  return (
    <Animated.Text
      style={[styles.layer, textStyle, style]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {text}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  box: {
    overflow: "hidden",
  },
  layer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },
});
