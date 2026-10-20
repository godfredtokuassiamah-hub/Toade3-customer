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
import { getLanguageName, LanguageSheet } from "../components/language";
import { CountryCodeSheet } from "../components/profile/CountryCodeSheet";
import { PhoneField } from "../components/profile/PhoneField";
import { Collapse } from "../components/ui/Collapse";
import { FloatingLabelInput } from "../components/ui/FloatingLabelInput";
import { KeyboardAwareScreen } from "../components/ui/KeyboardAwareScreen";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import {
  type Country,
  DEFAULT_COUNTRY,
  getCountryByIso2,
} from "../data/countries";
import { errorHaptic, successHaptic } from "../lib/haptics";
import { isValidFullName, normalizeFullName } from "../lib/validation/name";
import { normalizePhone } from "../lib/validation/phone";
import { completeProfile } from "../services/profile";
import { colors, text } from "../theme";

// Same frame as sign-in (copied, not imported, so the screens stay independent).
const RADIUS = 24;
// Sheet top sits at y207 of the 874pt-tall mock.
const HEADER_RATIO = 207 / 874;
const AUTOFOCUS_DELAY_MS = 400;

const NAME_ERROR = "Enter your full name (at least 2 letters).";
const PHONE_ERROR = "Enter a valid phone number.";
const SAVE_ERROR =
  "We couldn't save your details. Check your connection and try again.";

// First-run profile setup for new (or incomplete) accounts, step 1 of 3
// (details -> address -> location). On success: /complete-address.
// Back navigation: this screen is reached with replace() after the auth
// stack is dismissed (or from the splash), so it's the only route. Android
// hardware back follows the root default (leaves the app) and can't reach
// the OTP screen; iOS swipe-back is off (gestureEnabled: false in the root
// layout). Relaunching returns here via the splash's session check.
export default function CompleteProfile() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const nameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const buttonRef = useRef<View>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [nameTouched, setNameTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [nameShake, setNameShake] = useState(0);
  const [phoneShake, setPhoneShake] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [countrySheetOpen, setCountrySheetOpen] = useState(false);
  const [languageCode, setLanguageCode] = useState("EN");
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);

  const mounted = useRef(true);
  const savingRef = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const nameValid = isValidFullName(name);
  const phoneResult = normalizePhone(country, phone);
  const formValid = nameValid && phoneResult.ok;

  // Errors show after leaving a non-empty field, or after a submit attempt.
  const showNameError =
    !nameValid && (submitAttempted || (nameTouched && name.trim() !== ""));
  const showPhoneError =
    !phoneResult.ok &&
    (submitAttempted || (phoneTouched && phone.trim() !== ""));

  // Announce once when an error appears (the error Text stays mounted inside
  // an animated collapse, so a live region wouldn't fire reliably).
  useEffect(() => {
    if (showNameError) AccessibilityInfo.announceForAccessibility(NAME_ERROR);
  }, [showNameError]);
  useEffect(() => {
    if (showPhoneError) AccessibilityInfo.announceForAccessibility(PHONE_ERROR);
  }, [showPhoneError]);

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

  // Autofocus the name after the entrance, unless a screen reader is on.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((on) => {
        if (cancelled || on) return;
        timer = setTimeout(() => nameRef.current?.focus(), AUTOFOCUS_DELAY_MS);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const onOpenLanguage = () => {
    Keyboard.dismiss();
    setLanguageSheetOpen(true);
  };

  const onOpenCountry = () => {
    Keyboard.dismiss();
    setCountrySheetOpen(true);
  };

  const submit = async () => {
    if (savingRef.current) return;
    if (!formValid || !phoneResult.ok) {
      setSubmitAttempted(true);
      errorHaptic();
      if (!nameValid) setNameShake((k) => k + 1);
      if (!phoneResult.ok) setPhoneShake((k) => k + 1);
      return;
    }
    Keyboard.dismiss();
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await completeProfile({
        fullName: normalizeFullName(name),
        phone: phoneResult.e164,
        countryCode: country.dialCode,
      });
      if (!mounted.current) return;
      successHaptic();
      if (router.canDismiss()) router.dismissAll();
      router.replace("/complete-address");
    } catch {
      if (!mounted.current) return;
      setSaveError(SAVE_ERROR);
      errorHaptic();
      AccessibilityInfo.announceForAccessibility(SAVE_ERROR);
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
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
            Tell us about you
          </Text>
          <Text style={[text.subtitle, styles.subtitle]}>
            {"We'll use this to set up your Toade3 account and keep you posted on your orders."}
          </Text>
          <View style={styles.field}>
            <FloatingLabelInput
              label="Full name"
              inputRef={nameRef}
              value={name}
              onChangeText={(v) => {
                setName(v);
                setSaveError(null);
              }}
              onSubmitEditing={() => phoneRef.current?.focus()}
              onBlur={() => setNameTouched(true)}
              showError={showNameError}
              errorMessage={NAME_ERROR}
              shakeKey={nameShake}
              editable={!saving}
              autoCapitalize="words"
              autoCorrect={false}
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              submitBehavior="submit"
              maxLength={80}
              testID="name-input"
            />
          </View>
          <View style={styles.phone}>
            <PhoneField
              country={country}
              onOpenCountry={onOpenCountry}
              inputRef={phoneRef}
              value={phone}
              onChangeText={(v) => {
                setPhone(v);
                setSaveError(null);
              }}
              onSubmitEditing={() => void submit()}
              onBlur={() => setPhoneTouched(true)}
              showError={showPhoneError}
              errorMessage={PHONE_ERROR}
              shakeKey={phoneShake}
              editable={!saving}
            />
          </View>
          {/* revealRef target: kept above the keyboard on short screens. */}
          <View ref={buttonRef} collapsable={false} style={styles.button}>
            <PrimaryButton
              label="Continue"
              onPress={() => void submit()}
              disabled={!formValid}
              loading={saving}
            />
          </View>
          <Collapse visible={saveError !== null}>
            <Text
              style={[text.caption, styles.status]}
              accessibilityRole="alert"
            >
              {saveError ?? SAVE_ERROR}
            </Text>
          </Collapse>
        </Animated.View>
      </KeyboardAwareScreen>
      <CountryCodeSheet
        visible={countrySheetOpen}
        selectedIso2={country.iso2}
        onSelect={(iso2) => {
          const next = getCountryByIso2(iso2);
          if (next) setCountry(next);
        }}
        onClose={() => setCountrySheetOpen(false)}
      />
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
  phone: {
    marginTop: 16,
  },
  button: {
    marginTop: 26,
  },
  status: {
    paddingTop: 12,
    color: colors.error,
  },
});
