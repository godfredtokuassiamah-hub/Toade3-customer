import { Redirect, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Keyboard,
  Pressable,
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
import { OTP_SHAKE_MS, OtpInput } from "../components/auth/OtpInput";
import { useResendCooldown } from "../components/auth/useResendCooldown";
import { getLanguageName, LanguageSheet } from "../components/language";
import { Collapse } from "../components/ui/Collapse";
import { KeyboardAwareScreen } from "../components/ui/KeyboardAwareScreen";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { RATE_LIMIT_MESSAGE } from "../lib/auth/authErrors";
import { formatCountdown, OTP_LENGTH, parseSentAt } from "../lib/auth/otp";
import { routeForProfile, withTimeout } from "../lib/auth/profileCompletion";
import { errorHaptic, lightHaptic, successHaptic } from "../lib/haptics";
import { isValidEmail, normalizeEmail } from "../lib/validation/email";
import {
  isInvalidCodeError,
  isRateLimitedError,
  requestEmailCode,
  verifyEmailCode,
} from "../services/auth";
import { fetchMyProfile } from "../services/profile";
import { colors, fontFamily, text } from "../theme";

// Same frame as sign-in (copied, not imported, so the screens stay independent).
const RADIUS = 24;
// Sheet top sits at y207 of the 874pt-tall mock.
const HEADER_RATIO = 207 / 874;
const AUTOFOCUS_DELAY_MS = 400;
// Wrong code: clear the digits right after the shake settles.
const CLEAR_DELAY_MS = OTP_SHAKE_MS + 60;

const INVALID_CODE_MESSAGE =
  "That code isn't right. Check your email and try again.";
const VERIFY_ERROR =
  "Something went wrong. Check your connection and try again.";
const RESENT_MESSAGE = "Code sent again";
const RESEND_ERROR = "We couldn't resend the code. Try again.";
const PROFILE_ERROR =
  "You're signed in, but we couldn't load your account. Check your connection and try again.";
// Post-verify profile check; past this the user gets the retry state.
const PROFILE_TIMEOUT_MS = 8000;

type ResendStatus = "sent" | "error" | null;

export default function VerifyCode() {
  const params = useLocalSearchParams<{ email?: string; sentAt?: string }>();
  // Never trust the param: normalize, then validate below.
  const rawEmail: unknown = params.email;
  const email = normalizeEmail(
    Array.isArray(rawEmail)
      ? String(rawEmail[0] ?? "")
      : typeof rawEmail === "string"
        ? rawEmail
        : "",
  );
  const emailValid = isValidEmail(email);

  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const inputRef = useRef<TextInput>(null);
  const actionsRef = useRef<View>(null);

  const [code, setCode] = useState("");
  // Bumped on a wrong code: shake only, no red state or visible message.
  const [shakeKey, setShakeKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendStatus, setResendStatus] = useState<ResendStatus>(null);
  const [resendError, setResendError] = useState(RESEND_ERROR);
  // Set once verifyOtp succeeds. The OTP is single-use, so after this only
  // the profile check is retried, never the code.
  const [signedIn, setSignedIn] = useState(false);
  const [languageCode, setLanguageCode] = useState("EN");
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);

  // Cooldown starts from the original send on sign-in.
  const [initialSentAt] = useState(() =>
    parseSentAt(params.sentAt, Date.now()),
  );
  const { remaining, ready, restart } = useResendCooldown(initialSentAt);

  const mounted = useRef(true);
  const verifyingRef = useRef(false);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  const onOpenLanguage = () => {
    Keyboard.dismiss();
    setLanguageSheetOpen(true);
  };

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
  // the title and email first).
  useEffect(() => {
    if (!emailValid) return;
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
  }, [emailValid]);

  const handleChange = (next: string) => {
    if (clearTimer.current) {
      clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
    setCode(next);
    setErrorMessage(null);
    setResendStatus(null);
  };

  // New-user detection: no name/phone -> /complete-profile, no address ->
  // /complete-address, else /home.
  // The button keeps its spinner until this resolves.
  const routeAfterAuth = async () => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setVerifying(true);
    setErrorMessage(null);
    try {
      const profile = await withTimeout(fetchMyProfile(), PROFILE_TIMEOUT_MS);
      if (!mounted.current) return;
      successHaptic();
      // Clear sign-in/verify so back on the next screen exits the app.
      if (router.canDismiss()) router.dismissAll();
      router.replace(routeForProfile(profile));
    } catch {
      if (!mounted.current) return;
      errorHaptic();
      setErrorMessage(PROFILE_ERROR);
      AccessibilityInfo.announceForAccessibility(PROFILE_ERROR);
    } finally {
      verifyingRef.current = false;
      if (mounted.current) setVerifying(false);
    }
  };

  const verify = async (c: string) => {
    if (verifyingRef.current || c.length !== OTP_LENGTH) return;
    verifyingRef.current = true;
    setVerifying(true);
    setErrorMessage(null);
    let verified = false;
    try {
      await verifyEmailCode(email, c);
      verified = true;
    } catch (err) {
      if (!mounted.current) return;
      errorHaptic();
      if (isRateLimitedError(err)) {
        setErrorMessage(RATE_LIMIT_MESSAGE);
        AccessibilityInfo.announceForAccessibility(RATE_LIMIT_MESSAGE);
      } else if (isInvalidCodeError(err)) {
        // Wrong code: vibrate + shake, then clear. No red boxes or visible
        // message; screen-reader users still hear why the code cleared.
        setShakeKey((k) => k + 1);
        AccessibilityInfo.announceForAccessibility(INVALID_CODE_MESSAGE);
        clearTimer.current = setTimeout(() => {
          clearTimer.current = null;
          setCode("");
          inputRef.current?.focus();
        }, CLEAR_DELAY_MS);
      } else {
        setErrorMessage(VERIFY_ERROR);
        AccessibilityInfo.announceForAccessibility(VERIFY_ERROR);
      }
    } finally {
      verifyingRef.current = false;
      if (mounted.current && !verified) setVerifying(false);
    }
    if (!verified || !mounted.current) return;
    setSignedIn(true);
    setResendStatus(null);
    await routeAfterAuth();
  };

  const resend = async () => {
    if (!ready || sending) return;
    setSending(true);
    setResendStatus(null);
    try {
      await requestEmailCode(email);
      if (!mounted.current) return;
      restart();
      setResendStatus("sent");
      lightHaptic();
      AccessibilityInfo.announceForAccessibility(RESENT_MESSAGE);
    } catch (err) {
      if (!mounted.current) return;
      const message = isRateLimitedError(err) ? RATE_LIMIT_MESSAGE : RESEND_ERROR;
      setResendError(message);
      setResendStatus("error");
      errorHaptic();
      AccessibilityInfo.announceForAccessibility(message);
    } finally {
      if (mounted.current) setSending(false);
    }
  };

  // Missing or invalid email (e.g. a cold deep link): back to sign-in.
  // <Redirect> replaces and is safe before the navigator is ready.
  if (!emailValid) return <Redirect href="/sign-in" />;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAwareScreen bounces={false} revealRef={actionsRef}>
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
            Check your inbox
          </Text>
          <Text style={[text.subtitle, styles.subtitle]}>
            {"We've sent a verification code to "}
            <Text style={styles.email}>{email}</Text>
          </Text>
          <View style={styles.code}>
            <OtpInput
              inputRef={inputRef}
              length={OTP_LENGTH}
              value={code}
              onChange={handleChange}
              onComplete={(c) => void verify(c)}
              shakeKey={shakeKey}
              errorMessage={errorMessage ?? undefined}
              disabled={verifying || signedIn}
              testID="otp-input"
            />
          </View>
          <Collapse visible={errorMessage !== null}>
            <Text
              style={[text.caption, styles.error]}
              accessibilityRole="alert"
            >
              {errorMessage ?? VERIFY_ERROR}
            </Text>
          </Collapse>
          {/* revealRef target: button + resend link stay above the keyboard. */}
          <View ref={actionsRef} collapsable={false} style={styles.actions}>
            <PrimaryButton
              label={signedIn ? "Try again" : "Verify and continue"}
              onPress={() =>
                void (signedIn ? routeAfterAuth() : verify(code))
              }
              disabled={!signedIn && code.length !== OTP_LENGTH}
              loading={verifying}
            />
            <View style={styles.resend}>
              {signedIn ? null : sending ? (
                <Text style={styles.resendMuted}>Sending...</Text>
              ) : ready ? (
                <Pressable
                  onPress={() => void resend()}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.resendLink}>{"Didn't receive code?"}</Text>
                </Pressable>
              ) : (
                <Text
                  style={styles.resendMuted}
                  accessibilityState={{ disabled: true }}
                >
                  Resend code in {formatCountdown(remaining)}
                </Text>
              )}
            </View>
            <Collapse visible={resendStatus !== null}>
              <Text
                style={[
                  text.caption,
                  styles.resendStatus,
                  {
                    color:
                      resendStatus === "error" ? colors.error : colors.text,
                  },
                ]}
                accessibilityLiveRegion="polite"
              >
                {resendStatus === "error" ? resendError : RESENT_MESSAGE}
              </Text>
            </Collapse>
          </View>
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
  // Actual address, darker + semibold so it stands out; wraps with the sentence.
  email: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
  },
  code: {
    marginTop: 24,
  },
  error: {
    paddingTop: 8,
    color: colors.error,
  },
  actions: {
    marginTop: 24,
  },
  resend: {
    marginTop: 16,
    minHeight: 20,
    alignItems: "center",
  },
  resendLink: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.primary,
  },
  resendMuted: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  resendStatus: {
    paddingTop: 8,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.6,
  },
});
