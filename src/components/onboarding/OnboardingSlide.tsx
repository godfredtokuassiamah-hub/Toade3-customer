import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { fontFamily } from "../../theme";
import { DEFAULT_FADE, type OnboardingSlide as Slide } from "./slides";

// Hidden ("before entrance") values.
const START_SCALE = 1.06;
const START_Y = 20;

type Props = {
  slide: Slide;
  // Page index of this slide in the pager.
  index: number;
  // Pager scroll position in pages.
  progress: SharedValue<number>;
  width: number;
  height: number;
  isActive: boolean;
};

export function OnboardingSlide({
  slide,
  index,
  progress,
  width,
  height,
  isActive,
}: Props) {
  // Card covers the top ~84% of the screen (738 / 874 in the mock).
  const cardHeight = height * 0.845;
  const fade = slide.fade === null ? null : (slide.fade ?? DEFAULT_FADE);
  const textColor = slide.textColor ?? "#FFFFFF";
  const reduceMotion = useReducedMotion();

  const active = useSharedValue(isActive);
  const photoScale = useSharedValue(START_SCALE);
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(START_Y);
  const bodyOpacity = useSharedValue(0);
  const bodyY = useSharedValue(START_Y);

  // One worklet owns every animation write (React Compiler forbids mutating
  // these shared values from an effect once a hook has captured them).
  // States: 2 = reduced motion (show), 1 = active (play entrance),
  // 0 = inactive and at least a page away (reset, never visible),
  // -1 = inactive but still on screen (hold, avoids the swipe-back blink).
  useAnimatedReaction(
    () => {
      if (reduceMotion) return 2;
      if (active.value) return 1;
      return Math.abs(progress.value - index) > 0.99 ? 0 : -1;
    },
    (state, prev) => {
      if (state === prev) return;
      if (state === 2) {
        photoScale.value = 1;
        titleOpacity.value = 1;
        titleY.value = 0;
        bodyOpacity.value = 1;
        bodyY.value = 0;
      } else if (state === 1) {
        const easing = Easing.out(Easing.cubic);
        photoScale.value = withTiming(1, { duration: 700, easing });
        titleOpacity.value = withDelay(250, withTiming(1, { duration: 500 }));
        titleY.value = withDelay(250, withTiming(0, { duration: 500, easing }));
        bodyOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));
        bodyY.value = withDelay(400, withTiming(0, { duration: 500, easing }));
      } else if (state === 0) {
        // Direct assignment also cancels any in-flight entrance.
        photoScale.value = START_SCALE;
        titleOpacity.value = 0;
        titleY.value = START_Y;
        bodyOpacity.value = 0;
        bodyY.value = START_Y;
      }
    },
    [reduceMotion, index],
  );

  // Mirror the active page into the worklet above.
  useEffect(() => {
    active.value = isActive;
  }, [isActive, active]);

  const photoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: photoScale.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    opacity: bodyOpacity.value * 0.92,
    transform: [{ translateY: bodyY.value }],
  }));

  return (
    <View style={{ width, height }}>
      <View
        style={[
          styles.card,
          { height: cardHeight, backgroundColor: slide.color },
        ]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, photoStyle]}>
          <Image
            source={slide.image}
            style={
              slide.imageFrame
                ? [styles.frame, slide.imageFrame]
                : StyleSheet.absoluteFill
            }
            contentFit={slide.imageFit ?? "cover"}
            contentPosition={slide.imagePosition}
            transition={0}
            accessible={false}
          />
        </Animated.View>
        {fade && (
          <LinearGradient
            colors={[`${slide.color}00`, slide.color]}
            locations={fade.locations}
            style={[styles.gradient, { height: fade.height }]}
            pointerEvents="none"
          />
        )}
        <View style={styles.text}>
          <Animated.Text
            style={[styles.title, { color: textColor }, titleStyle]}
            accessibilityRole="header"
          >
            {slide.title}
          </Animated.Text>
          <Animated.Text style={[styles.body, { color: textColor }, bodyStyle]}>
            {slide.body}
          </Animated.Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  frame: {
    position: "absolute",
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  text: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 40,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 32,
    lineHeight: 38,
    maxWidth: 300,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 310,
  },
});
