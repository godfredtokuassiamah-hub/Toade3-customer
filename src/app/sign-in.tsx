import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Keyboard,
  StyleSheet,
  Text,
  type TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthHeader } from "../components/auth/AuthHeader";
import { EmailField } from "../components/auth/EmailField";
import {
  EMAIL_ERROR_MESSAGE,
  useEmailFeedback,
} from "../components/auth/useEmailFeedback";
import { getLanguageName, LanguageSheet } from "../components/language";
import { KeyboardAwareScreen } from "../components/ui/KeyboardAwareScreen";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { errorHaptic } from "../lib/haptics";
import {
  isValidEmail,
  normalizeEmail,
  suggestEmail,
} from "../lib/validation/email";
import { requestEmailCode } from "../services/auth";
import { colors, text } from "../theme";

const RADIUS = 24;
// Sheet top sits at y207 of the 874pt-tall mock.
const HEADER_RATIO = 207 / 874;
const AUTOFOCUS_DELAY_MS = 400;
const REQUEST_ERROR =
  "We couldn't send the code. Check your connection and try again.";

export default function SignIn() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const inputRef = useRef<TextInput>(null);
  const buttonRef = useRef<View>(null);

  const {
    email,
    setEmail,
    showError,
    shakeKey,
    flagIfInvalid,
    onFocus,
    onBlur,
  } = useEmailFeedback();
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  // Selected language code for the header pill.
  const [languageCode, setLanguageCode] = useState("EN");
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);

  const onOpenLanguage = () => {
    Keyboard.dismiss();
    setLanguageSheetOpen(true);
  };

  const valid = isValidEmail(email);
  const suggestion = suggestEmail(email);

  // Header row needs at least status bar + row + some breathing room.
  const headerHeight = Math.max(
    Math.round(height * HEADER_RATIO),
    insets.top + 120,
  );

  // Sheet entrance: slide up + fade in.
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = reducedMotion
      ? 1
      : withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
  }, [enter, reducedMotion]);
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 24 }],
  }));

  // Autofocus after the entrance, unless a screen reader is on (let it read
  // the title first).
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((on) => {
        if (cancelled || on) return;
        timer = setTimeout(() => inputRef.current?.focus(), AUTOFOCUS_DELAY_MS);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleChange = (next: string) => {
    setEmail(next);
    setRequestError(null);
  };

  const submit = async () => {
    if (loading) return;
    if (!flagIfInvalid()) return;
    const normalized = normalizeEmail(email);
    Keyboard.dismiss();
    setLoading(true);
    setRequestError(null);
    try {
      await requestEmailCode(normalized);
      // push so back returns here to change the email. sentAt starts the
      // resend cooldown from this send.
      router.push({
        pathname: "/verify-code",
        params: { email: normalized, sentAt: String(Date.now()) },
      });
    } catch {
      setRequestError(REQUEST_ERROR);
      errorHaptic();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAwareScreen bounces={false} revealRef={buttonRef}>
        <AuthHeader
          height={headerHeight + RADIUS}
          languageCode={languageCode}
          languageName={getLanguageName(languageCode)}
          onOpenLanguage={onOpenLanguage}
        />
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 24 },
            sheetStyle,
          ]}
        >
          <Text style={text.title} accessibilityRole="header">
            Your next meal starts here.
          </Text>
          <Text style={[text.subtitle, styles.subtitle]}>
            Enter your email to sign in or create your Toade3 account.
          </Text>
          <View style={styles.field}>
            <EmailField
              inputRef={inputRef}
              value={email}
              onChangeText={handleChange}
              onSubmit={submit}
              onFocus={onFocus}
              onBlur={onBlur}
              showError={showError}
              errorMessage={EMAIL_ERROR_MESSAGE}
              suggestion={suggestion}
              onAcceptSuggestion={() => {
                if (suggestion) handleChange(suggestion);
              }}
              shakeKey={shakeKey}
              editable={!loading}
            />
          </View>
          {/* revealRef target: kept above the keyboard on short screens. */}
          <View ref={buttonRef} collapsable={false} style={styles.button}>
            <PrimaryButton
              label="Send code"
              onPress={submit}
              disabled={!valid}
              loading={loading}
            />
          </View>
          {requestError ? (
            <Text
              style={[text.caption, styles.status, { color: colors.error }]}
              accessibilityLiveRegion="polite"
            >
              {requestError}
            </Text>
          ) : null}
        </Animated.View>
      </KeyboardAwareScreen>
      <LanguageSheet
        visible={languageSheetOpen}
        selectedCode={languageCode}
        onSelect={setLanguageCode}
        onClose={() => setLanguageSheetOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  sheet: {
    flexGrow: 1,
    marginTop: -RADIUS,
    backgroundColor: colors.white,
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    paddingHorizontal: 14,
    paddingTop: 32,
  },
  subtitle: {
    marginTop: 4,
  },
  field: {
    marginTop: 20,
  },
  button: {
    marginTop: 26,
  },
  status: {
    marginTop: 12,
  },
});
