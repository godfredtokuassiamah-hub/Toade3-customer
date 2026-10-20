import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fontFamily } from "../../theme";
import { CheckCircle } from "../ui/CheckCircle";
import type { Language } from "./languages";

type Props = {
  language: Language;
  selected: boolean;
  onPress: () => void;
};

// Brand light orange, matching the primary selection colour.
const SELECTED_BG = colors.selectionBg;

export function LanguageRow({ language, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={`${language.name}, ${language.nativeName}`}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.badge, selected && styles.badgeSelected]}>
        <Text style={[styles.code, selected && styles.codeSelected]}>
          {language.code}
        </Text>
      </View>
      <View style={styles.names}>
        <Text
          style={[styles.name, selected && styles.nameSelected]}
          numberOfLines={1}
        >
          {language.name}
        </Text>
        <Text
          // RTL script inside an LTR row: set the paragraph direction so the
          // text shapes/orders correctly, but keep it aligned with the column.
          style={[styles.native, language.rtl && styles.rtl]}
          numberOfLines={1}
        >
          {language.nativeName}
        </Text>
      </View>
      {selected ? <CheckCircle size={22} color={colors.selection} /> : null}
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
    backgroundColor: SELECTED_BG,
  },
  pressed: {
    opacity: 0.85,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeSelected: {
    backgroundColor: colors.selection,
  },
  code: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.text,
  },
  codeSelected: {
    color: colors.white,
  },
  names: {
    flex: 1,
  },
  name: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  nameSelected: {
    color: colors.selection,
  },
  native: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
    color: colors.textSecondary,
  },
  rtl: {
    writingDirection: "rtl",
    textAlign: "left",
  },
});
