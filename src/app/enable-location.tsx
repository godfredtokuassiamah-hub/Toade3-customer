import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
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

import { primeUserLocation } from "../components/home/useUserLocation";
import { Icon } from "../components/ui/Icon";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { withTimeout } from "../lib/auth/profileCompletion";
import { lightHaptic } from "../lib/haptics";
import {
  describeCoords,
  getDeviceCoords,
  readPermission,
  requestPermission,
} from "../services/deviceLocation";
import { saveCurrentLocation } from "../services/profile";
import { colors, fontFamily, text } from "../theme";

const CAPTURE_TIMEOUT_MS = 15000;
const BLOCKED = "Location is turned off for Toade3.";
const LOCATING = "Finding your location…";

// checking: reading the permission on mount (renders nothing extra).
// prompt: the normal screen. locating: capturing + saving, then Home.
// blocked: permission permanently denied; offer Settings.
type Mode = "checking" | "prompt" | "locating" | "blocked";

// Setup step 3 of 3 (optional). Reached with dismissAll() + replace() from
// complete-address, so it's the only route (gestureEnabled: false). Every
// path ends on Home: granted, denied, failed, or "Not now".
export default function EnableLocation() {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [mode, setMode] = useState<Mode>("checking");
  const modeRef = useRef<Mode>("checking");
  const navigated = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const setModeBoth = useCallback((m: Mode) => {
    modeRef.current = m;
    if (mounted.current) setMode(m);
  }, []);

  const goHome = useCallback(() => {
    if (navigated.current) return;
    navigated.current = true;
    if (router.canDismiss()) router.dismissAll();
    router.replace("/home");
  }, []);

  // Fix + label + save, bounded; any failure still goes Home.
  const capture = useCallback(async () => {
    if (modeRef.current === "locating" || navigated.current) return;
    setModeBoth("locating");
    AccessibilityInfo.announceForAccessibility(LOCATING);
    try {
      await withTimeout(
        (async () => {
          const coords = await getDeviceCoords({ timeoutMs: 10000 });
          const place = await describeCoords(coords);
          const label = place?.shortLabel ?? null;
          primeUserLocation(label, coords);
          await saveCurrentLocation({ lat: coords.lat, lng: coords.lng, label });
        })(),
        CAPTURE_TIMEOUT_MS,
      );
    } catch {
      // Location is optional; Home falls back to the saved address.
    }
    goHome();
  }, [goHome, setModeBoth]);

  // Already granted (e.g. via "Use my current location"): skip the prompt.
  useEffect(() => {
    let cancelled = false;
    void readPermission().then((perm) => {
      if (cancelled) return;
      if (perm.granted) void capture();
      else setModeBoth("prompt");
    });
    return () => {
      cancelled = true;
    };
  }, [capture, setModeBoth]);

  // Back from Settings with location turned on: capture.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" || modeRef.current !== "blocked") return;
      void readPermission().then((perm) => {
        if (perm.granted) void capture();
      });
    });
    return () => sub.remove();
  }, [capture]);

  const onEnable = async () => {
    if (modeRef.current !== "prompt") return;
    const perm = await requestPermission();
    if (!mounted.current) return;
    if (perm.granted) {
      void capture();
    } else if (!perm.canAskAgain) {
      setModeBoth("blocked");
      AccessibilityInfo.announceForAccessibility(
        `${BLOCKED} You can turn it on in Settings or continue without location.`,
      );
    } else {
      goHome();
    }
  };

  const onNotNow = () => {
    lightHaptic();
    goHome();
  };

  // Entrance: fade + slide up.
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = reducedMotion
      ? 1
      : withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
  }, [enter, reducedMotion]);
  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 24 }],
  }));

  const locating = mode === "locating" || mode === "checking";
  const blocked = mode === "blocked";

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <StatusBar style="dark" />
      <Animated.View style={[styles.content, enterStyle]}>
        <View style={styles.iconCircle}>
          <Icon name="navigation" size={40} color={colors.primary} filled />
        </View>
        <Text style={[text.title, styles.title]} accessibilityRole="header">
          Enable location
        </Text>
        <Text style={[text.subtitle, styles.body]}>
          Toade3 uses your location to show nearby campus vendors and get your
          order to the right spot.
        </Text>
        {mode === "locating" ? (
          <View style={styles.locating} accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[text.caption, styles.muted]}>{LOCATING}</Text>
          </View>
        ) : null}
        {blocked ? (
          <Text style={[text.caption, styles.notice]} accessibilityRole="alert">
            {`${BLOCKED} You can turn it on in Settings.`}
          </Text>
        ) : null}
      </Animated.View>
      <Animated.View style={[styles.actions, enterStyle]}>
        {blocked ? (
          <PrimaryButton
            label="Open settings"
            accessibilityLabel="Open Settings to turn on location"
            onPress={() => void Linking.openSettings()}
          />
        ) : (
          <PrimaryButton
            label="Enable location"
            onPress={() => void onEnable()}
            disabled={mode === "checking"}
            loading={mode === "locating"}
          />
        )}
        <Pressable
          onPress={onNotNow}
          disabled={locating}
          accessibilityRole="button"
          accessibilityState={{ disabled: locating }}
          accessibilityLabel={blocked ? "Continue without location" : "Not now"}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={[styles.secondaryLabel, locating && styles.secondaryDisabled]}>
            {blocked ? "Continue without location" : "Not now"}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginTop: 24,
    fontSize: 22,
    textAlign: "center",
  },
  body: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 340,
  },
  locating: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  muted: {
    color: colors.textMuted,
  },
  notice: {
    marginTop: 20,
    color: colors.error,
    textAlign: "center",
  },
  actions: {
    gap: 8,
  },
  secondary: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  secondaryDisabled: {
    color: colors.disabledText,
  },
  pressed: {
    opacity: 0.7,
  },
});
