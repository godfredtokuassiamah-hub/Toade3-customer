import { Image } from "expo-image";
import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fontFamily } from "../../theme";
import { CheckCircle } from "../ui/CheckCircle";
import { Icon } from "../ui/Icon";

// Icons8 location art (bundled). Attribution / licence required before release.
const CURRENT_LOCATION_ICON = require("../../../assets/icons/location/current-location.png");

type Props = {
  title: string;
  subtitle: string;
  // "current" = orange arrow tile; "address" = grey pin tile.
  variant: "current" | "address";
  selected?: boolean;
  onPress: () => void;
  accessibilityHint?: string;
  // "radio" (default): selectable list row. "button": plain action row
  // (search results), no selected state.
  role?: "radio" | "button";
  // Shows a spinner on the right and marks the row busy.
  loading?: boolean;
  disabled?: boolean;
};

// Address row (radio or button semantics). Plain View, no layout animation.
function AddressRowBase({
  title,
  subtitle,
  variant,
  selected = false,
  onPress,
  accessibilityHint,
  role = "radio",
  loading = false,
  disabled = false,
}: Props) {
  const current = variant === "current";
  const radio = role === "radio";
  const label = subtitle ? `${title}, ${subtitle}` : title;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole={radio ? "radio" : "button"}
      accessibilityState={
        radio
          ? { selected, checked: selected }
          : { busy: loading, disabled: disabled || loading }
      }
      accessibilityLabel={`${label}${radio && selected ? ", selected" : ""}`}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.tile}>
        {current ? (
          <Image
            source={CURRENT_LOCATION_ICON}
            style={styles.art}
            contentFit="contain"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : (
          <Icon name="pin" size={20} color={colors.text} />
        )}
      </View>
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : radio && selected ? (
        <CheckCircle size={22} color={colors.primary} />
      ) : null}
    </Pressable>
  );
}

export const AddressRow = memo(AddressRowBase);

const styles = StyleSheet.create({
  row: {
    minHeight: 72,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  pressed: {
    backgroundColor: colors.surfaceCard,
  },
  tile: {
    width: 48,
    height: 48,
    borderRadius: 12,
    // Soft grey for every row (was light orange on the current-location row).
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  art: {
    width: 26,
    height: 26,
  },
  texts: {
    flex: 1,
  },
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
});
