// Translucent frosted-glass surface of the P12 Filters sheet (bottom ->
// top): material (GlassView iOS 26+ / BlurView older iOS / none), a plain
// white fill, a 1px top highlight and a hairline outline. Top corners only.
//
// Crash-safe layout (crash-glass-storage-plan.md): this layer is static.
// Fixed radius, no animated props/styles, no createAnimatedComponent. Its
// parent (the sheet wrapper) only ever animates a transform, never opacity,
// size or radius; that is the same pattern the floating tab bar uses
// (transform on a wrapper around static glass). The Reduce Motion fade is
// applied to the content sibling and the plain fill/edge views, and to the
// glass via its native glassEffectStyle transition, never as opacity on a
// material or its ancestor. (Older-iOS BlurView therefore appears at once
// under Reduce Motion.)
import { BlurView } from "expo-blur";
import { GlassView } from "expo-glass-effect";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import type { TabBarSurfaceMode } from "../navigation/tabBarSurface";
import { FILTERS_SHEET, FILTERS_SURFACE, resolveSheetSurface } from "./filtersSheet";
import type { FiltersSheetMotion } from "./useFiltersSheetMotion";

type Props = {
  mode: TabBarSurfaceMode;
  // Glass shown ('regular') vs hidden ('none'); flips on open/close.
  glassOn: boolean;
  reducedMotion: boolean;
  // Reduce Motion fade (opacity 0 -> 1); identity otherwise.
  fadeStyle: FiltersSheetMotion["contentStyle"];
};

const TOP = {
  borderTopLeftRadius: FILTERS_SHEET.radius,
  borderTopRightRadius: FILTERS_SHEET.radius,
} as const;

export function FiltersSheetSurface({ mode, glassOn, reducedMotion, fadeStyle }: Props) {
  const { material, fill, edges } = resolveSheetSurface(mode);
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {material === "glass" ? (
        <GlassView
          style={[styles.layer, TOP]}
          glassEffectStyle={{
            style: glassOn ? "regular" : "none",
            animate: true,
            animationDuration: reducedMotion
              ? FILTERS_SHEET.reducedGlassFadeSeconds
              : FILTERS_SHEET.glassFadeSeconds,
          }}
          colorScheme="light"
          isInteractive={false}
          tintColor={FILTERS_SURFACE.glassTint}
        />
      ) : null}
      {material === "blur" ? (
        <View style={[styles.layer, styles.clip, TOP]}>
          <BlurView
            tint={FILTERS_SURFACE.blurTint}
            intensity={FILTERS_SURFACE.blurIntensity}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}
      {/* Plain views only (no material inside), so they may fade with the
          content under Reduce Motion. */}
      <Animated.View style={[StyleSheet.absoluteFill, fadeStyle]}>
        {fill ? <View style={[styles.layer, TOP, { backgroundColor: fill }]} /> : null}
        {edges ? (
          <>
            <View style={[styles.layer, styles.highlight, TOP]} />
            <View style={[styles.layer, styles.outline, TOP]} />
          </>
        ) : null}
      </Animated.View>
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
  highlight: {
    borderTopWidth: 1,
    borderTopColor: FILTERS_SURFACE.highlight,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
  },
  outline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: FILTERS_SURFACE.outline,
  },
});
