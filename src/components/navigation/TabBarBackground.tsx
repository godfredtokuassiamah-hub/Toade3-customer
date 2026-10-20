// Material layers behind the tab bar content, one set per surface mode.
// All layers are static except their corner radius, which follows the bar
// height. Never set or animate opacity here or on any parent: opacity on a
// GlassView or its ancestors stops the glass rendering (expo-glass-effect
// known issue, expo/expo#41024).
import { BlurView } from "expo-blur";
import { GlassView } from "expo-glass-effect";
import { StyleSheet, View } from "react-native";
import Animated, { type SharedValue, useAnimatedStyle } from "react-native-reanimated";

import { TAB_BAR_SURFACE, type TabBarSurfaceMode } from "./tabBarSurface";

const AnimatedGlassView = Animated.createAnimatedComponent(GlassView);
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

type Props = {
  mode: TabBarSurfaceMode;
  // Current bar height; every layer uses height / 2 as its radius.
  height: SharedValue<number>;
};

export function TabBarBackground({ mode, height }: Props) {
  const radiusStyle = useAnimatedStyle(() => ({
    borderRadius: height.get() / 2,
  }));

  // Opaque: fill and border live on the surface itself.
  if (mode === "opaque") return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {mode === "glass" ? (
        // Native material draws its own edge highlight and depth.
        <AnimatedGlassView
          style={[styles.layer, radiusStyle]}
          glassEffectStyle="regular"
          colorScheme="light"
          isInteractive={false}
          tintColor={TAB_BAR_SURFACE.glassTint}
        />
      ) : null}
      {mode === "blur" ? (
        <>
          <AnimatedBlurView
            tint="light"
            intensity={TAB_BAR_SURFACE.blurIntensity}
            style={[styles.layer, styles.clip, radiusStyle]}
          />
          <Animated.View style={[styles.layer, styles.overlay, radiusStyle]} />
        </>
      ) : null}
      {mode === "blur" || mode === "solid" ? (
        <Animated.View style={[styles.layer, styles.highlight, radiusStyle]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    borderCurve: "continuous",
  },
  clip: {
    overflow: "hidden",
  },
  overlay: {
    backgroundColor: TAB_BAR_SURFACE.blurOverlay,
  },
  // 1px light rim along the upper edge only.
  highlight: {
    borderTopWidth: 1,
    borderTopColor: TAB_BAR_SURFACE.highlight,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
  },
});
