// Minimum / Maximum pill fields: the same two values as the slider, typed
// as GHS text (decimal keyboard). Blank = unbounded. Errors are shown per
// field and the screen focuses the errored field on Apply.
import { memo, type Ref } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { formatOpenMax } from "../../lib/discovery/money";
import type { PriceFieldErrors } from "../../lib/discovery/filterState";
import { colors, fontFamily } from "../../theme";

function Field({
  label,
  value,
  placeholder,
  error,
  caption,
  onChange,
  inputRef,
}: {
  label: string;
  value: string;
  placeholder: string;
  error?: string;
  caption?: string;
  onChange: (text: string) => void;
  inputRef: Ref<TextInput>;
}) {
  return (
    <View style={styles.field}>
      <View style={[styles.pill, error != null && styles.pillError]}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.inputRow}>
          <Text style={styles.currency}>GHS</Text>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChange}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder={placeholder}
            placeholderTextColor={colors.placeholder}
            accessibilityLabel={`${label} price in Ghana cedis`}
            accessibilityHint={placeholder}
            maxLength={10}
            style={styles.input}
          />
        </View>
      </View>
      {caption && !error ? <Text style={styles.caption}>{caption}</Text> : null}
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export const RangeFields = memo(function RangeFields({
  minText,
  maxText,
  errors,
  highestPrice,
  onMinChange,
  onMaxChange,
  minRef,
  maxRef,
}: {
  minText: string;
  maxText: string;
  errors: PriceFieldErrors;
  // Max bucket edge, shown as "GHS 150+" while Maximum is "No limit".
  highestPrice: number | null;
  onMinChange: (text: string) => void;
  onMaxChange: (text: string) => void;
  minRef: Ref<TextInput>;
  maxRef: Ref<TextInput>;
}) {
  return (
    <View style={styles.row}>
      <Field
        label="Minimum"
        value={minText}
        placeholder="Any minimum"
        error={errors.min}
        onChange={onMinChange}
        inputRef={minRef}
      />
      <Field
        label="Maximum"
        value={maxText}
        placeholder="No limit"
        error={errors.max}
        caption={maxText.trim() === "" && highestPrice != null ? formatOpenMax(highestPrice) : undefined}
        onChange={onMaxChange}
        inputRef={maxRef}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  field: {
    flex: 1,
  },
  pill: {
    minHeight: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    paddingHorizontal: 18,
    paddingVertical: 8,
    justifyContent: "center",
  },
  pillError: {
    borderColor: colors.error,
    borderWidth: 1.5,
  },
  label: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  currency: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  input: {
    flex: 1,
    paddingVertical: 2,
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  caption: {
    marginTop: 6,
    marginLeft: 18,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  error: {
    marginTop: 6,
    marginHorizontal: 6,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.error,
  },
});
