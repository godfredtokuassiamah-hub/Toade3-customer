// Full-bleed cover photo behind the storefront content. Moves by transform
// only (parallax, or 1:1 under reduced motion). No vendor cover art exists
// yet, so the screen passes the vendor's first item photo (or nothing ->
// placeholder). Decorative: hidden from screen readers.
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { memo } from "react";
import { type ImageSourcePropType, StyleSheet, View, type ViewStyle } from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";

import { colors } from "../../theme";
import { Icon } from "../ui/Icon";
import { HERO_H } from "./metrics";

type Props = {
  image?: ImageSourcePropType;
  insetTop: number;
  style: AnimatedStyle<ViewStyle>;
};

function StorefrontHeroBase({ image, insetTop, style }: Props) {
  return (
    <Animated.View
      style={[styles.hero, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {image ? (
        <Image
          source={image}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          accessible={false}
        />
      ) : (
        <View style={styles.placeholder}>
          <Icon name="store" size={40} color={colors.imagePlaceholderIcon} />
        </View>
      )}
      {/* Keeps the light status bar legible over bright photos. */}
      <LinearGradient
        colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0)"]}
        style={[styles.gradient, { height: insetTop + 64 }]}
      />
    </Animated.View>
  );
}

export const StorefrontHero = memo(StorefrontHeroBase);

const styles = StyleSheet.create({
  hero: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: HERO_H,
    backgroundColor: colors.imagePlaceholder,
    overflow: "hidden",
  },
  placeholder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  gradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
});
