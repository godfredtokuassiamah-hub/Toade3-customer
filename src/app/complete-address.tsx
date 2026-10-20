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
import { AddressConfirmCard } from "../components/profile/AddressConfirmCard";
import {
  AddressSearchField,
  type LocationNotice,
} from "../components/profile/AddressSearchField";
import { Collapse } from "../components/ui/Collapse";
import { FloatingLabelInput } from "../components/ui/FloatingLabelInput";
import { KeyboardAwareScreen } from "../components/ui/KeyboardAwareScreen";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { withTimeout } from "../lib/auth/profileCompletion";
import { errorHaptic, selectionHaptic, successHaptic } from "../lib/haptics";
import { useDeliveryAddress } from "../lib/location/DeliveryAddressContext";
import { buildAddress } from "../lib/location/geocode";
import type { LatLng, PlaceSuggestion } from "../lib/places/types";
import {
  describeCoords,
  getDeviceCoords,
  getLastKnownCoords,
  readPermission,
  requestPermission,
} from "../services/deviceLocation";
import { saveAddress } from "../services/profile";
import { colors, text } from "../theme";

// Same frame as complete-profile (copied, not imported).
const RADIUS = 24;
const HEADER_RATIO = 207 / 874;
const AUTOFOCUS_DELAY_MS = 400;
const BIAS_MAX_AGE_MS = 30 * 60 * 1000;
const LOCATE_TIMEOUT_MS = 20000;

const LOCATION_OFF = "Location is off. Search for your address instead.";
const NOT_FOUND = "Couldn't find your address. Search for it instead.";
const SAVE_ERROR =
  "We couldn't save your address. Check your connection and try again.";

// Setup step 2 of 3: delivery address. Reached with dismissAll() + replace()
// from complete-profile, verify-code or the splash, so it's the only route
// (gestureEnabled: false in the root layout; Android back leaves the app).
export default function CompleteAddress() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { rememberAddress } = useDeliveryAddress();
  const searchRef = useRef<TextInput>(null);
  const buttonRef = useRef<View>(null);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PlaceSuggestion | null>(null);
  const [details, setDetails] = useState("");
  const [bias, setBias] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState<LocationNotice | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [languageCode, setLanguageCode] = useState("EN");
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);

  const mounted = useRef(true);
  const savingRef = useRef(false);
  const locatingRef = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Bias suggestions to the device's last known position, without prompting.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const perm = await readPermission();
      if (!perm.granted) return;
      const coords = await getLastKnownCoords(BIAS_MAX_AGE_MS);
      if (!cancelled && coords) setBias(coords);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  // Autofocus the search after the entrance, unless a screen reader is on.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((on) => {
        if (cancelled || on) return;
        timer = setTimeout(() => searchRef.current?.focus(), AUTOFOCUS_DELAY_MS);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const showNotice = (message: string, canOpenSettings: boolean) => {
    setLocationNotice({ message, canOpenSettings });
    AccessibilityInfo.announceForAccessibility(message);
  };

  const onSelect = (place: PlaceSuggestion) => {
    Keyboard.dismiss();
    setSelected(place);
    setSaveError(null);
    setLocationNotice(null);
  };

  const onUseCurrentLocation = async () => {
    if (locatingRef.current || savingRef.current) return;
    Keyboard.dismiss();
    locatingRef.current = true;
    setLocating(true);
    setLocationNotice(null);
    try {
      const perm = await requestPermission();
      if (!mounted.current) return;
      if (!perm.granted) {
        showNotice(LOCATION_OFF, !perm.canAskAgain);
        return;
      }
      const place = await withTimeout(
        (async () => {
          const coords = await getDeviceCoords({ timeoutMs: 10000 });
          if (mounted.current) setBias(coords);
          return describeCoords(coords);
        })(),
        LOCATE_TIMEOUT_MS,
      );
      if (!mounted.current) return;
      if (!place) {
        showNotice(NOT_FOUND, false);
        return;
      }
      setSelected(place);
      setSaveError(null);
      selectionHaptic();
      AccessibilityInfo.announceForAccessibility(`Address found: ${place.title}`);
    } catch {
      if (mounted.current) showNotice(NOT_FOUND, false);
    } finally {
      locatingRef.current = false;
      if (mounted.current) setLocating(false);
    }
  };

  const onChangeAddress = () => {
    setSelected(null);
    setSaveError(null);
    setTimeout(() => {
      if (mounted.current) searchRef.current?.focus();
    }, 50);
  };

  const onOpenLanguage = () => {
    Keyboard.dismiss();
    setLanguageSheetOpen(true);
  };

  const submit = async () => {
    if (savingRef.current || !selected) return;
    Keyboard.dismiss();
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await saveAddress({
        label: selected.title,
        fullAddress: selected.fullAddress,
        lat: selected.lat,
        lng: selected.lng,
        placeId: selected.id,
        details: details.trim() || null,
      });
      if (!mounted.current) return;
      successHaptic();
      // One tap away in the location picker's recents; not made active so
      // the Home top bar can show the live location.
      void rememberAddress(
        buildAddress(selected.lat, selected.lng, selected.title, selected.subtitle),
      ).catch(() => {});
      if (router.canDismiss()) router.dismissAll();
      router.replace("/enable-location");
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
            Where should we deliver?
          </Text>
          <Text style={[text.subtitle, styles.subtitle]}>
            Search for your hall, street or a landmark near you.
          </Text>
          <View style={styles.field}>
            {selected ? (
              <>
                <AddressConfirmCard
                  place={selected}
                  onChange={onChangeAddress}
                  disabled={saving}
                />
                <View style={styles.details}>
                  <FloatingLabelInput
                    label="Apartment, floor, landmark (optional)"
                    value={details}
                    onChangeText={(v) => {
                      setDetails(v);
                      setSaveError(null);
                    }}
                    onSubmitEditing={() => void submit()}
                    editable={!saving}
                    autoCapitalize="sentences"
                    returnKeyType="done"
                    submitBehavior="blurAndSubmit"
                    maxLength={120}
                    accessibilityHint="Helps the rider find you"
                    testID="address-details-input"
                  />
                </View>
              </>
            ) : (
              <AddressSearchField
                query={query}
                onChangeQuery={(v) => {
                  setQuery(v);
                  setSaveError(null);
                }}
                bias={bias}
                onSelect={onSelect}
                onUseCurrentLocation={() => void onUseCurrentLocation()}
                locating={locating}
                locationNotice={locationNotice}
                editable={!saving}
                inputRef={searchRef}
              />
            )}
          </View>
          {/* revealRef target: kept above the keyboard on short screens. */}
          <View ref={buttonRef} collapsable={false} style={styles.button}>
            <PrimaryButton
              label="Continue"
              onPress={() => void submit()}
              disabled={!selected}
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
  details: {
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
