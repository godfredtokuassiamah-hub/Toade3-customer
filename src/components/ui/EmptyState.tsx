// Shared empty-state scaffold for screens with no content yet (Orders,
// Favourites, and future empty screens).
//
// It renders a soft, animated multi-colour gradient wash across the TOP of
// the page only (orange -> blue -> yellow, fading to the white page
// background), with the illustration + copy centred below it. The wash drifts
// slowly and loops; Reduce Motion freezes it. The gradient sits behind the
// content and never blocks touches.
//
// Usage:
//   <EmptyState
//     image={require(".../empty-orders.png")}
//     title="No orders yet"
//     body="When you place an order, it shows up here..."
//   >
//     {optional extra content, e.g. a button}
//   </EmptyState>
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type ReactNode, useEffect } from "react";
import {
  type ImageSourcePropType,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { colors, fontFamily } from "../../theme";

// Height of the coloured wash at the top, as a fraction of the screen height.
const WASH_RATIO = 0.42;
const ILLUSTRATION = 120;
// Blended brand-ish hues: orange, blue, yellow. Alpha kept low so the wash
// stays transparent over the white page.
const ORANGE = "rgba(232,104,42,0.28)"; // colors.primary tinted
const BLUE = "rgba(21,34,68,0.16)"; // colors.navy tinted
const YELLOW = "rgba(252,181,1,0.30)"; // Toade3 yellow tinted

type EmptyStateProps = {
  image: ImageSourcePropType;
  title: string;
  body: string;
  /** Optional extra content rendered under the body (e.g. a button). */
  children?: ReactNode;
  /** Extra bottom padding, e.g. the floating tab bar clearance on tab screens. */
  bottomInset?: number;
};

export function EmptyState({ image, title, body, children, bottomInset = 0 }: EmptyStateProps) {
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const washHeight = Math.round(height * WASH_RATIO);

  // Drift the wash horizontally and vertically in a slow loop. `drift` runs
  // 0 -> 1 -> 0 forever; the animated style maps it to a few points of
  // translation and a gentle scale, so the blend feels alive without moving
  // enough to read as sliding.
  const drift = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      drift.value = 0.5;
      return;
    }
    drift.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [reduceMotion, drift]);

  const washStyle = useAnimatedStyle(() => {
    const t = drift.value;
    return {
      transform: [
        { translateX: -16 + t * 32 },
        { translateY: -10 + t * 20 },
        { scale: 1.08 + t * 0.06 },
      ],
      opacity: 0.9 + t * 0.1,
    };
  });

  return (
    <View style={styles.root}>
      {/* Top gradient wash, behind content, non-interactive. */}
      <View
        style={[styles.washClip, { height: washHeight }]}
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <Animated.View style={[StyleSheet.absoluteFill, washStyle]}>
          {/* Diagonal blend of the three hues. */}
          <LinearGradient
            colors={[ORANGE, BLUE, YELLOW]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.9 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Vertical fade to the white page so only the top is tinted. */}
          <LinearGradient
            colors={["rgba(255,255,255,0)", "rgba(255,255,255,1)"]}
            locations={[0.35, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>

      <View style={[styles.content, { paddingBottom: bottomInset }]}>
        <Image
          source={image}
          style={styles.illustration}
          contentFit="contain"
          // Decorative: the title below says the same thing.
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.body}>{body}</Text>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  washClip: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  illustration: {
    width: ILLUSTRATION,
    height: ILLUSTRATION,
  },
  title: {
    marginTop: 16,
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.text,
    textAlign: "center",
  },
  body: {
    marginTop: 8,
    maxWidth: 300,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: "center",
  },
});
