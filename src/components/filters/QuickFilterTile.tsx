import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fontFamily } from "../../theme";
import { Icon, type IconName } from "../ui/Icon";

// Rounded square shortcut tile (icon above label). Selection is derived by
// the caller from the shared draft; the tile has no state of its own.
export const QuickFilterTile = memo(function QuickFilterTile({
  id,
  label,
  icon,
  selected,
  disabled = false,
  caption,
  onPress,
}: {
  id: string;
  label: string;
  icon: IconName;
  selected: boolean;
  disabled?: boolean;
  caption?: string;
  onPress: (id: string) => void;
}) {
  return (
    <Pressable
      testID={`quick-filter-${id}`}
      onPress={() => onPress(id)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={caption ? `${label}, ${caption}` : label}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.tile,
        selected && styles.selected,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} size={26} color={disabled ? colors.disabledText : selected ? colors.primary : colors.text} />
      <View>
        <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    backgroundColor: colors.white,
    padding: 14,
    justifyContent: "space-between",
    gap: 12,
  },
  selected: {
    borderWidth: 1.5,
    borderColor: colors.text,
    backgroundColor: colors.primaryLight,
  },
  disabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.75,
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.text,
  },
  labelDisabled: {
    color: colors.disabledText,
  },
  caption: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
});
