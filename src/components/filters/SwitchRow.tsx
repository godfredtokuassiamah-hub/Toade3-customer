import { memo } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";

import { colors, fontFamily } from "../../theme";

const TRACK = { false: "#DDDDDD", true: colors.primary };

export const SwitchRow = memo(function SwitchRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={TRACK}
        ios_backgroundColor={TRACK.false}
        thumbColor={colors.white}
        accessibilityLabel={label}
        accessibilityHint={hint}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
