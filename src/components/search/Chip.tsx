import { memo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, fontFamily } from "../../theme";
import { Icon } from "../ui/Icon";

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  // Applied-filter chip: shows a trailing × and reads as "Remove …".
  removable?: boolean;
};

export const Chip = memo(function Chip({
  label,
  selected = false,
  onPress,
  removable = false,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={removable ? `Remove filter ${label}` : label}
      accessibilityState={removable ? undefined : { selected }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
      {removable ? (
        <Icon name="close" size={12} color={selected ? colors.primary : colors.text} weight="semibold" />
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  chip: {
    // 40 + hitSlop 4 on each side = 48pt target.
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#DDDDDD",
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: colors.text,
  },
  labelSelected: {
    fontFamily: fontFamily.semibold,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
});
