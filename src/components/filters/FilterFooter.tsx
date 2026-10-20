// Pinned footer: "Reset filters" (left) and the orange "Show {count} items"
// action. While a newer preview is pending the old exact count is hidden:
// "Show results" + a small "Updating count". Loading never disables Reset.
import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fontFamily } from "../../theme";

export const FilterFooter = memo(function FilterFooter({
  label,
  updating,
  applying,
  resetDisabled,
  onReset,
  onApply,
  bottomPadding,
}: {
  label: string;
  updating: boolean;
  applying: boolean;
  resetDisabled: boolean;
  onReset: () => void;
  onApply: () => void;
  bottomPadding: number;
}) {
  return (
    <View style={[styles.footer, { paddingBottom: bottomPadding }]}>
      <Pressable
        onPress={onReset}
        disabled={resetDisabled}
        accessibilityRole="button"
        accessibilityLabel="Reset filters"
        accessibilityState={{ disabled: resetDisabled }}
        hitSlop={8}
        style={({ pressed }) => [styles.reset, pressed && styles.pressed]}
      >
        <Text style={[styles.resetText, resetDisabled && styles.resetDisabled]}>Reset filters</Text>
      </Pressable>
      <Pressable
        onPress={onApply}
        accessibilityRole="button"
        accessibilityLabel={updating ? `${label}, updating count` : label}
        accessibilityState={{ busy: applying || updating }}
        style={({ pressed }) => [styles.apply, pressed && styles.applyPressed]}
      >
        {applying ? <ActivityIndicator color={colors.white} size="small" /> : null}
        <View style={styles.applyText}>
          <Text style={styles.applyLabel}>{label}</Text>
          {updating ? <Text style={styles.updating}>Updating count</Text> : null}
        </View>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingTop: 12,
    paddingHorizontal: 20,
    // Transparent: sits on the sheet's translucent glass surface.
    backgroundColor: "transparent",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  reset: {
    minHeight: 48,
    justifyContent: "center",
  },
  resetText: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
    textDecorationLine: "underline",
  },
  resetDisabled: {
    color: colors.disabledText,
  },
  pressed: {
    opacity: 0.7,
  },
  apply: {
    flexShrink: 1,
    minHeight: 52,
    minWidth: 150,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 8,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  applyPressed: {
    opacity: 0.85,
  },
  applyText: {
    flexShrink: 1,
    alignItems: "center",
  },
  applyLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.white,
    textAlign: "center",
  },
  updating: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: colors.white,
    opacity: 0.9,
  },
});
