import { type Ref } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { colors, fontFamily } from "../../theme";
import { Icon } from "../ui/Icon";
import { FIELD_BORDER } from "./searchStyles";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  onFocus: () => void;
  // Expanded: the magnifier becomes a back arrow that collapses the card.
  expanded: boolean;
  onBack: () => void;
  inputRef?: Ref<TextInput>;
};

export function SearchField({
  value,
  onChangeText,
  onSubmit,
  onFocus,
  expanded,
  onBack,
  inputRef,
}: Props) {
  return (
    <View style={styles.field}>
      {expanded ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          style={({ pressed }) => [styles.lead, pressed && styles.pressed]}
        >
          <Icon name="arrowLeft" size={20} color={colors.text} weight="medium" />
        </Pressable>
      ) : (
        <View style={styles.lead}>
          <Icon name="search" size={20} color={colors.text} />
        </View>
      )}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onSubmitEditing={onSubmit}
        placeholder="Search meals, groceries or stores"
        placeholderTextColor={colors.placeholder}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        enterKeyHint="search"
        accessibilityLabel="Search meals, groceries or stores"
        style={styles.input}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel="Clear search text"
          hitSlop={10}
          style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
        >
          <Icon name="clearField" size={18} color={colors.placeholder} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 56,
    borderWidth: 1.5,
    borderColor: FIELD_BORDER,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
    backgroundColor: colors.white,
  },
  lead: {
    width: 24,
    alignItems: "center",
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontFamily: fontFamily.medium,
    fontSize: 16,
    color: colors.text,
  },
  clear: {
    padding: 2,
  },
  pressed: {
    opacity: 0.6,
  },
});
