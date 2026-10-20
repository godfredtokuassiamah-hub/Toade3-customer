import { type Ref, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { colors, fontFamily, text } from "../../theme";
import { Collapse } from "../ui/Collapse";

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
const FIELD_HEIGHT = 56;
const BORDER = 1.5;
const INNER_HEIGHT = FIELD_HEIGHT - BORDER * 2;
const LABEL_SIZE = 15;
const LABEL_LINE = 20;
const LABEL_SCALE = 11 / LABEL_SIZE;
// Label top (transformOrigin is top-left): centred at rest, near the top when lifted.
const LABEL_REST_Y = (INNER_HEIGHT - LABEL_LINE) / 2;
const LABEL_UP_Y = 7;
const ANIM = { duration: 180, easing: Easing.out(Easing.cubic) };
// Focus stroke fades from fully transparent orange so it never greys mid-way.
const STROKE_OFF = "rgba(232,104,42,0)";

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
  const reducedMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const lifted = focused || value.length > 0;

  const shift = useSharedValue(0);
  const focus = useSharedValue(0);
  const lift = useSharedValue(lifted ? 1 : 0);
  const error = useSharedValue(showError ? 1 : 0);

  useEffect(() => {
    const t = focused ? 1 : 0;
    focus.value = reducedMotion ? t : withTiming(t, ANIM);
  }, [focused, reducedMotion, focus]);

  useEffect(() => {
    const t = lifted ? 1 : 0;
    lift.value = reducedMotion ? t : withTiming(t, ANIM);
  }, [lifted, reducedMotion, lift]);

  useEffect(() => {
    error.value = showError ? 1 : 0;
  }, [showError, error]);

  // ~300 ms horizontal shake.
  useEffect(() => {
    if (shakeKey === 0 || reducedMotion) return;
    shift.value = withSequence(
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 50 }),
      withTiming(-3, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [shakeKey, reducedMotion, shift]);

  // Keep the last hint text while it collapses so it doesn't vanish mid-animation.
  // (Adjust-state-during-render pattern; no ref writes in render.)
  const [lastSuggestion, setLastSuggestion] = useState(suggestion);
  if (suggestion && suggestion !== lastSuggestion) setLastSuggestion(suggestion);
  const shownSuggestion = suggestion ?? lastSuggestion;

  const fieldStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shift.value }],
    backgroundColor: interpolateColor(
      focus.value,
      [0, 1],
      [colors.inputFill, colors.inputFillFocused],
    ),
    // Error stroke wins over the focus stroke.
    borderColor:
      error.value === 1
        ? colors.error
        : interpolateColor(focus.value, [0, 1], [STROKE_OFF, colors.primary]),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(lift.value, [0, 1], [LABEL_REST_Y, LABEL_UP_Y]) },
      { scale: interpolate(lift.value, [0, 1], [1, LABEL_SCALE]) },
    ],
  }));

  return (
    <View>
      <Animated.View style={[styles.field, fieldStyle]}>
        <Animated.Text
          style={[styles.label, labelStyle]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no"
          numberOfLines={1}
        >
          {LABEL}
        </Animated.Text>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          onFocus={() => {
            setFocused(true);
            onFocus?.();
          }}
          onBlur={() => {
            setFocused(false);
            onBlur();
          }}
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
          cursorColor={colors.primary}
          selectionColor={colors.primary}
          accessibilityLabel={LABEL}
          accessibilityHint={showError ? errorMessage : undefined}
          style={styles.input}
        />
      </Animated.View>
      <Collapse visible={showError}>
        <Text style={[text.caption, styles.error]} accessibilityRole="alert">
          {errorMessage}
        </Text>
      </Collapse>
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
  field: {
    height: FIELD_HEIGHT,
    borderRadius: 10,
    borderWidth: BORDER,
    overflow: "hidden",
  },
  label: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 0,
    transformOrigin: "left top",
    fontFamily: fontFamily.regular,
    fontSize: LABEL_SIZE,
    lineHeight: LABEL_LINE,
    color: colors.placeholder,
  },
  // Fixed line height + explicit vertical padding: typed text sits under the
  // lifted label and never moves while typing.
  input: {
    height: INNER_HEIGHT,
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 6,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
    textAlignVertical: "center",
  },
  error: {
    paddingTop: 8,
    color: colors.error,
  },
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
