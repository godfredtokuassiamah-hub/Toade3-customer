import type { Ref } from "react";
import { Pressable, StyleSheet, Text, type TextInput, View } from "react-native";

import type { Country } from "../../data/countries";
import { colors, fontFamily, text } from "../../theme";
import { Collapse } from "../ui/Collapse";
import { FIELD_HEIGHT, FloatingLabelInput } from "../ui/FloatingLabelInput";
import { Icon } from "../ui/Icon";
import { spokenDialCode } from "./CountryRow";

type Props = {
  country: Country;
  onOpenCountry: () => void;
  value: string;
  onChangeText: (value: string) => void;
  onSubmitEditing: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  showError: boolean;
  errorMessage: string;
  shakeKey: number;
  inputRef?: Ref<TextInput>;
  editable?: boolean;
};

// Country-code button + phone number field on one row, error underneath.
export function PhoneField({
  country,
  onOpenCountry,
  value,
  onChangeText,
  onSubmitEditing,
  onFocus,
  onBlur,
  showError,
  errorMessage,
  shakeKey,
  inputRef,
  editable = true,
}: Props) {
  return (
    <View>
      <View style={styles.row}>
        <Pressable
          onPress={onOpenCountry}
          disabled={!editable}
          accessibilityRole="button"
          accessibilityLabel={`Country code, ${country.name}, ${spokenDialCode(country.dialCode)}`}
          accessibilityHint="Opens the country list"
          accessibilityState={{ disabled: !editable }}
          style={({ pressed }) => [
            styles.country,
            pressed && styles.pressed,
            !editable && styles.disabled,
          ]}
        >
          <Text style={styles.flag}>{country.flag}</Text>
          <Text style={styles.dial}>{country.dialCode}</Text>
          <Icon name="chevronDown" size={16} color={colors.textSecondary} />
        </Pressable>
        <View style={styles.input}>
          <FloatingLabelInput
            label="Phone number"
            inputRef={inputRef}
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmitEditing}
            onFocus={onFocus}
            onBlur={onBlur}
            showError={showError}
            shakeKey={shakeKey}
            editable={editable}
            accessibilityHint={showError ? errorMessage : undefined}
            keyboardType="phone-pad"
            inputMode="tel"
            autoComplete="tel"
            textContentType="telephoneNumber"
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            maxLength={20}
            testID="phone-input"
          />
        </View>
      </View>
      <Collapse visible={showError}>
        <Text style={[text.caption, styles.error]} accessibilityRole="alert">
          {errorMessage}
        </Text>
      </Collapse>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
  },
  country: {
    height: FIELD_HEIGHT,
    minWidth: 96,
    borderRadius: 10,
    backgroundColor: colors.inputFill,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
  flag: {
    fontSize: 20,
    lineHeight: 26,
  },
  dial: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  input: {
    flex: 1,
  },
  error: {
    paddingTop: 8,
    color: colors.error,
  },
});
