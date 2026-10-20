import { type Ref, useEffect, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { computeOtpBoxSize, sanitizeOtp } from "../../lib/auth/otp";
import { colors, fontFamily } from "../../theme";

type Props = {
  length: number;
  value: string;
  onChange: (code: string) => void;
  // Fires when the last digit is entered (typed or pasted).
  onComplete?: (code: string) => void;
  // Red strokes on every box; the false -> true edge plays the shake.
  error?: boolean;
  // Bump to play the shake on its own (no red state), e.g. on a wrong code.
  shakeKey?: number;
  // Spoken as the input's hint while `error` is set.
  errorMessage?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  testID?: string;
  inputRef?: Ref<TextInput>;
};

const BORDER = 1.5;
// Same focus stroke timing/easing as EmailField.
const ANIM = { duration: 180, easing: Easing.out(Easing.cubic) };
// Digit pop-in: rises into place with a small overshoot so each keypress
// reads clearly as "entered".
const DIGIT_IN = { duration: 240, easing: Easing.out(Easing.back(2.2)) };
// Shake timing; exported so callers can clear the code once it settles.
export const OTP_SHAKE_MS = 360;
// Focus stroke fades from fully transparent orange so it never greys mid-way.
const STROKE_OFF = "rgba(232,104,42,0)";
// Sheet horizontal padding on the auth screens (14 each side).
const FALLBACK_INSET = 28;

// Code entry as a row of boxes driven by ONE transparent TextInput laid over
// the row: a tap anywhere focuses it natively, and paste / iOS "From Mail"
// autofill work. Only the input is accessible; the boxes are visual.
export function OtpInput({
  length,
  value,
  onChange,
  onComplete,
  error = false,
  shakeKey = 0,
  errorMessage,
  disabled = false,
  autoFocus = false,
  testID,
  inputRef,
}: Props) {
  const reducedMotion = useReducedMotion();
  const { width: windowWidth } = useWindowDimensions();
  const [measured, setMeasured] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const size = computeOtpBoxSize(measured ?? windowWidth - FALLBACK_INSET, length);

  // Horizontal shake on each false -> true edge of `error` and on each
  // `shakeKey` bump (mirrors EmailField).
  const shift = useSharedValue(0);
  const prevError = useRef(error);
  const prevShakeKey = useRef(shakeKey);
  useEffect(() => {
    const errorEdge = error && !prevError.current;
    const bumped = shakeKey !== prevShakeKey.current;
    prevError.current = error;
    prevShakeKey.current = shakeKey;
    if ((errorEdge || bumped) && !reducedMotion) {
      const step = OTP_SHAKE_MS / 6;
      shift.value = withSequence(
        withTiming(-10, { duration: step }),
        withTiming(10, { duration: step }),
        withTiming(-7, { duration: step }),
        withTiming(7, { duration: step }),
        withTiming(-3, { duration: step }),
        withTiming(0, { duration: step }),
      );
    }
  }, [error, shakeKey, reducedMotion, shift]);
  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shift.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    setMeasured(e.nativeEvent.layout.width);
  };

  const handleChangeText = (t: string) => {
    const code = sanitizeOtp(t, length);
    onChange(code);
    if (code.length === length && code !== value) onComplete?.(code);
  };

  const activeIndex =
    focused && !disabled ? Math.min(value.length, length - 1) : -1;

  return (
    <View onLayout={onLayout}>
      <Animated.View
        style={[styles.row, { gap: size.gap }, rowStyle]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length }, (_, i) => (
          <OtpBox
            key={i}
            char={value[i] ?? ""}
            active={i === activeIndex}
            error={error}
            width={size.width}
            height={size.height}
            fontSize={size.fontSize}
          />
        ))}
      </Animated.View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // Keep the cursor at the end so backspace always removes the last digit.
        selection={{ start: value.length, end: value.length }}
        editable={!disabled}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoCorrect={false}
        // Native maxLength truncates the raw paste before sanitizeOtp strips
        // separators ("12 34" -> "12 3"), so allow room; sanitizeOtp caps it.
        maxLength={length * 4}
        caretHidden
        contextMenuHidden={false}
        selectionColor="transparent"
        testID={testID}
        accessibilityLabel={`Verification code, ${length} digits`}
        accessibilityHint={error ? errorMessage : undefined}
        style={styles.input}
      />
    </View>
  );
}

type BoxProps = {
  char: string;
  active: boolean;
  error: boolean;
  width: number;
  height: number;
  fontSize: number;
};

function OtpBox({ char, active, error, width, height, fontSize }: BoxProps) {
  const reducedMotion = useReducedMotion();
  const focus = useSharedValue(active ? 1 : 0);
  const appear = useSharedValue(char ? 1 : 0);
  const caret = useSharedValue(1);
  const errorValue = useSharedValue(error ? 1 : 0);
  const filled = char !== "";

  useEffect(() => {
    const t = active ? 1 : 0;
    focus.value = reducedMotion ? t : withTiming(t, ANIM);
  }, [active, reducedMotion, focus]);

  useEffect(() => {
    errorValue.value = error ? 1 : 0;
  }, [error, errorValue]);

  // Quick scale/fade in when a digit lands in this box.
  useEffect(() => {
    if (!filled) {
      appear.value = 0;
      return;
    }
    if (reducedMotion) {
      appear.value = 1;
      return;
    }
    appear.value = 0;
    appear.value = withTiming(1, DIGIT_IN);
  }, [char, filled, reducedMotion, appear]);

  // Blinking caret on the active empty box (static with reduced motion).
  const showCaret = active && !filled;
  useEffect(() => {
    cancelAnimation(caret);
    caret.value = 1;
    if (showCaret && !reducedMotion) {
      caret.value = withRepeat(
        withSequence(
          withDelay(500, withTiming(0, { duration: 0 })),
          withDelay(500, withTiming(1, { duration: 0 })),
        ),
        -1,
      );
    }
    return () => cancelAnimation(caret);
  }, [showCaret, reducedMotion, caret]);

  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      focus.value,
      [0, 1],
      [colors.inputFill, colors.inputFillFocused],
    ),
    // Error stroke wins over the focus stroke.
    borderColor:
      errorValue.value === 1
        ? colors.error
        : interpolateColor(focus.value, [0, 1], [STROKE_OFF, colors.primary]),
  }));
  const digitStyle = useAnimatedStyle(() => ({
    // Opacity is clamped because the back easing overshoots past 1.
    opacity: Math.min(1, appear.value * 1.5),
    transform: [
      { translateY: (1 - appear.value) * 10 },
      { scale: 0.5 + 0.5 * appear.value },
    ],
  }));
  const caretStyle = useAnimatedStyle(() => ({ opacity: caret.value }));

  return (
    <Animated.View style={[styles.box, { width, height }, boxStyle]}>
      {filled ? (
        <Animated.Text
          style={[
            styles.digit,
            { fontSize, lineHeight: Math.round(fontSize * 1.25) },
            digitStyle,
          ]}
        >
          {char}
        </Animated.Text>
      ) : showCaret ? (
        <Animated.View
          style={[styles.caret, { height: fontSize + 4 }, caretStyle]}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
  },
  box: {
    borderRadius: 10,
    borderWidth: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  digit: {
    fontFamily: fontFamily.semibold,
    color: colors.text,
    textAlign: "center",
  },
  caret: {
    width: 2,
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
  // Transparent input over the whole row. Near-zero (not zero) opacity keeps
  // it focusable/tappable on Android.
  input: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.011,
    color: "transparent",
    fontSize: 1,
  },
});
