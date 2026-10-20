import { Image } from "expo-image";
import { memo } from "react";
import { Pressable, StyleSheet, useWindowDimensions } from "react-native";

import type { Banner } from "../../data/mock/home";
import { colors } from "../../theme";

const SIDE_PADDING = 14;

// Full-width promo artwork; the text is baked into the image, so the label
// carries it for screen readers.
export const PromoBanner = memo(function PromoBanner({
  banner,
}: {
  banner: Banner;
}) {
  const { width } = useWindowDimensions();

  return (
    <Pressable
      // TODO(promo): open the promotion.
      onPress={() => {}}
      accessibilityRole="button"
      accessibilityLabel={banner.accessibilityLabel}
      style={({ pressed }) => [
        styles.banner,
        { width: width - SIDE_PADDING * 2, aspectRatio: banner.aspectRatio },
        pressed && styles.pressed,
      ]}
    >
      <Image
        source={banner.image}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
        recyclingKey={banner.id}
        accessible={false}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  banner: {
    alignSelf: "center",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.imagePlaceholder,
  },
  pressed: {
    opacity: 0.9,
  },
});
