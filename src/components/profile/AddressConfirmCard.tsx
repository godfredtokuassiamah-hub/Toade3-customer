import { Pressable, StyleSheet, Text, View } from "react-native";

import type { PlaceSuggestion } from "../../lib/places/types";
import { colors, fontFamily } from "../../theme";
import { Icon } from "../ui/Icon";

type Props = {
  place: PlaceSuggestion;
  onChange: () => void;
  disabled?: boolean;
};

// The chosen delivery address with a "Change" action.
export function AddressConfirmCard({ place, onChange, disabled = false }: Props) {
  const label = place.subtitle
    ? `Delivery address, ${place.title}, ${place.subtitle}`
    : `Delivery address, ${place.title}`;
  return (
    <View style={styles.card}>
      <View style={styles.info} accessible accessibilityLabel={label}>
        <View style={styles.tile}>
          <Icon name="pin" size={20} color={colors.primary} />
        </View>
        <View style={styles.texts}>
          <Text style={styles.title} numberOfLines={2}>
            {place.title}
          </Text>
          {place.subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {place.subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <Pressable
        onPress={onChange}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Change address"
        accessibilityState={{ disabled }}
        style={({ pressed }) => [styles.change, pressed && styles.pressed]}
      >
        <Text style={[styles.changeLabel, disabled && styles.changeDisabled]}>
          Change
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 4,
    gap: 8,
  },
  info: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tile: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
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
  change: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  changeLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.primary,
  },
  changeDisabled: {
    color: colors.disabledText,
  },
  pressed: {
    opacity: 0.7,
  },
});
