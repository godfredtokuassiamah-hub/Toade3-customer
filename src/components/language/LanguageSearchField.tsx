import { StyleSheet, TextInput, View } from "react-native";

import { colors, fontFamily } from "../../theme";
import { Icon } from "../ui/Icon";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
};

export function LanguageSearchField({ value, onChangeText }: Props) {
  return (
    <View style={styles.field}>
      <Icon name="search" size={18} color={colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search..."
        placeholderTextColor={colors.placeholder}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
        accessibilityLabel="Search languages"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    height: "100%",
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 0,
  },
});
