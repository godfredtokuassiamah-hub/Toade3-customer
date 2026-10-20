// Material layers behind the tab bar content, one stack per surface mode
// (bottom -> top):
// - glass:   GlassView, soft sheen, top highlight, hairline outline
// - blur:    BlurView, white overlay, sheen, highlight, outline
// - frosted: translucent fill, sheen, highlight, outline
// - opaque:  nothing here (fill and border live on the surface itself)
//
// Everything is static: no animated size, radius or opacity, and no
// createAnimatedComponent around GlassView/BlurView (an animated radius on the
// native material crashed Home on scroll). Never set opacity here or on any
// parent: opacity on a GlassView or its ancestors stops the glass rendering
// (expo-glass-effect known issue, expo/expo#41024).
import { BlurView } from "expo-blur";
import { GlassView } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import { TAB_BAR_SURFACE, type TabBarSurfaceMode } from "./tabBarSurface";

type Props = {
  mode: TabBarSurfaceMode;
  // Static corner radius (half the fixed bar height).
  radius: number;
};

export function TabBarBackground({ mode, radius }: Props) {
  if (mode === "opaque") return null;
  const round = { borderRadius: radius };

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {mode === "glass" ? (
        <GlassView
          style={[styles.layer, round]}
          glassEffectStyle="regular"
          colorScheme="light"
          isInteractive={false}
          tintColor={TAB_BAR_SURFACE.glassTint}
        />
      ) : null}
      {mode === "blur" ? (
        <View style={[styles.layer, styles.clip, round]}>
          <BlurView
            tint={TAB_BAR_SURFACE.blurTint}
            intensity={TAB_BAR_SURFACE.blurIntensity}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, styles.overlay]} />
        </View>
      ) : null}
      {mode === "frosted" ? (
        <View style={[styles.layer, styles.frosted, round]} />
      ) : null}
      <View style={[styles.layer, styles.clip, round]}>
        <LinearGradient
          colors={
            mode === "glass" ? TAB_BAR_SURFACE.glassSheen : TAB_BAR_SURFACE.sheen
          }
          locations={mode === "glass" ? null : TAB_BAR_SURFACE.sheenLocations}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={[styles.layer, styles.highlight, round]} />
      <View style={[styles.layer, styles.outline, round]} />
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
  frosted: {
    backgroundColor: TAB_BAR_SURFACE.frostedFill,
  },
  highlight: {
    borderTopWidth: 1,
    borderTopColor: TAB_BAR_SURFACE.highlight,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
  },
  outline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: TAB_BAR_SURFACE.outline,
  },
});
