// White frosted-glass backdrop behind the P12 Filters sheet (bottom -> top):
// - material: GlassView (iOS 26+) / BlurView (older iOS) / nothing
//   (Android, Reduce Transparency), static and mounted for the sheet's life
// - scrim: plain Animated.View white wash; only its opacity animates
// - tap target: transparent Pressable that closes the sheet
//
// Crash lesson (crash-glass-storage-plan.md): no createAnimatedComponent
// around GlassView/BlurView, no animated props/styles on a material, and no
// opacity, size or radius change on a material or any of its ancestors
// (opacity on a GlassView or a parent also stops the glass rendering,
// expo/expo#41024). The glass fades with its own native style transition
// ('none' <-> 'clear' via glassEffectStyle.animate).
import { BlurView } from "expo-blur";
import { GlassView } from "expo-glass-effect";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { type SharedValue, useAnimatedStyle } from "react-native-reanimated";

import type { TabBarSurfaceMode } from "../navigation/tabBarSurface";
import { FILTERS_BACKDROP, FILTERS_SHEET, resolveSheetBackdrop } from "./filtersSheet";

type Props = {
  mode: TabBarSurfaceMode;
  // Glass shown ('clear') vs hidden ('none'); flips on open/close.
  glassOn: boolean;
  reducedMotion: boolean;
  // 0 -> 1 white wash opacity.
  scrim: SharedValue<number>;
  onPress: () => void;
};

export function FiltersBackdrop({ mode, glassOn, reducedMotion, scrim, onPress }: Props) {
  const { material, scrimColor } = resolveSheetBackdrop(mode);
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Decorative: the X ("Close filters"), VoiceOver escape and Android
          back cover dismissal for assistive tech. */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {material === "glass" ? (
          <GlassView
            style={StyleSheet.absoluteFill}
            glassEffectStyle={{
              // "clear" is the thinnest Liquid Glass: the screen behind
              // stays clearly visible.
              style: glassOn ? "clear" : "none",
              animate: !reducedMotion,
              animationDuration: FILTERS_SHEET.glassFadeSeconds,
            }}
            colorScheme="light"
            isInteractive={false}
            tintColor={FILTERS_BACKDROP.glassTint}
          />
        ) : null}
        {material === "blur" ? (
          <BlurView
            tint={FILTERS_BACKDROP.blurTint}
            intensity={FILTERS_BACKDROP.blurIntensity}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: scrimColor }, scrimStyle]}
        />
      </View>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onPress}
        accessible={false}
        importantForAccessibility="no"
      />
    </View>
  );
}
