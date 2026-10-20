import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Country } from "../../data/countries";
import { colors, fontFamily } from "../../theme";
import { CheckCircle } from "../ui/CheckCircle";

type Props = {
  country: Country;
  selected: boolean;
  onPress: () => void;
};

// Spoken form of a dial code: "+233" -> "plus 233".
export function spokenDialCode(dialCode: string): string {
  return dialCode.replace(/^\+/, "plus ");
}

// Mirrors LanguageRow: flag, name, dial code, check when selected.
export function CountryRow({ country, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={`${country.name}, ${spokenDialCode(country.dialCode)}`}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.flag} importantForAccessibility="no">
        {country.flag}
      </Text>
      <Text
        style={[styles.name, selected && styles.nameSelected]}
        numberOfLines={1}
      >
        {country.name}
      </Text>
      <Text style={[styles.dial, selected && styles.nameSelected]}>
        {country.dialCode}
      </Text>
      <View style={styles.check}>
        {selected ? <CheckCircle size={22} color={colors.selection} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 68,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowSelected: {
    borderColor: colors.selection,
    backgroundColor: colors.selectionBg,
  },
  pressed: {
    opacity: 0.85,
  },
  flag: {
    fontSize: 24,
    lineHeight: 30,
  },
  name: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  nameSelected: {
    color: colors.selection,
  },
  dial: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  check: {
    width: 22,
    alignItems: "center",
  },
});
