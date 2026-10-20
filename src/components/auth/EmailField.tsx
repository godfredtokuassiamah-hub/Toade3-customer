import { type Ref, useState } from "react";
import { Pressable, StyleSheet, Text, type TextInput, View } from "react-native";

import { colors, fontFamily, text } from "../../theme";
import { Collapse } from "../ui/Collapse";
import { FloatingLabelInput } from "../ui/FloatingLabelInput";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  onFocus?: () => void;
  onBlur: () => void;
  showError: boolean;
  errorMessage: string;
  suggestion: string | null;
  onAcceptSuggestion: () => void;
  // Bump to play the shake once.
  shakeKey: number;
  inputRef?: Ref<TextInput>;
  editable?: boolean;
};

const LABEL = "Email address";

export function EmailField({
  value,
  onChangeText,
  onSubmit,
  onFocus,
  onBlur,
  showError,
  errorMessage,
  suggestion,
  onAcceptSuggestion,
  shakeKey,
  inputRef,
  editable = true,
}: Props) {
  // Keep the last hint text while it collapses so it doesn't vanish mid-animation.
  // (Adjust-state-during-render pattern; no ref writes in render.)
  const [lastSuggestion, setLastSuggestion] = useState(suggestion);
  if (suggestion && suggestion !== lastSuggestion) setLastSuggestion(suggestion);
  const shownSuggestion = suggestion ?? lastSuggestion;

  return (
    <View>
      <FloatingLabelInput
        label={LABEL}
        inputRef={inputRef}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        onFocus={onFocus}
        onBlur={onBlur}
        showError={showError}
        errorMessage={errorMessage}
        shakeKey={shakeKey}
        editable={editable}
        keyboardType="email-address"
        inputMode="email"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="go"
        enablesReturnKeyAutomatically
        submitBehavior="blurAndSubmit"
        maxLength={254}
      />
      <Collapse visible={suggestion !== null}>
        {shownSuggestion ? (
          <Pressable
            onPress={onAcceptSuggestion}
            accessibilityRole="button"
            accessibilityLabel={`Use ${shownSuggestion}`}
            hitSlop={8}
            style={styles.suggestion}
          >
            <Text style={[text.caption, styles.suggestionText]}>
              Did you mean{" "}
              <Text style={styles.suggestionValue}>{shownSuggestion}</Text>?
            </Text>
          </Pressable>
        ) : null}
      </Collapse>
    </View>
  );
}

const styles = StyleSheet.create({
  suggestion: {
    paddingTop: 8,
    alignSelf: "flex-start",
  },
  suggestionText: {
    color: colors.textMuted,
  },
  suggestionValue: {
    color: colors.primary,
    // Nested Text: set the family itself so the weight is a real Manrope cut.
    fontFamily: fontFamily.semibold,
  },
});
