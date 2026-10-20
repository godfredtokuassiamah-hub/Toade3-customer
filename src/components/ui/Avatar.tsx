import { Image } from "expo-image";
import { memo } from "react";
import { type ImageSourcePropType, StyleSheet, Text, View } from "react-native";

import { getInitials } from "../../lib/format";
import { colors, fontFamily } from "../../theme";

type Props = {
  source?: ImageSourcePropType;
  name: string;
  size?: number;
};

// Decorative profile circle: the photo when there is one, else initials.
function AvatarBase({ source, name, size = 44 }: Props) {
  const circle = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View
      style={[styles.base, circle, !source && styles.initialsBg]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {source ? (
        <Image
          source={source}
          style={circle}
          contentFit="cover"
          transition={150}
          accessible={false}
        />
      ) : (
        <Text style={[styles.initials, { fontSize: Math.round(size * 0.36) }]}>
          {getInitials(name)}
        </Text>
      )}
    </View>
  );
}

export const Avatar = memo(AvatarBase);

const styles = StyleSheet.create({
  base: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.imagePlaceholder,
  },
  initialsBg: {
    backgroundColor: colors.primaryLight,
  },
  initials: {
    fontFamily: fontFamily.semibold,
    color: colors.primary,
  },
});
