import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

import { resolveTabBarSurface, type TabBarSurfaceMode } from "./tabBarSurface";

function safe(check: () => boolean): boolean {
  try {
    return check();
  } catch {
    return false;
  }
}

// Read once: both checks are static for the app's lifetime. The API check
// guards iOS 26 betas that crash in GlassView (expo/expo#40911).
const LIQUID_GLASS =
  Platform.OS === "ios" &&
  safe(() => isLiquidGlassAvailable() && isGlassEffectAPIAvailable());

// Android resolves false; web has no such API (throws), so treat it as false.
function readReduceTransparency(): Promise<boolean> {
  try {
    return AccessibilityInfo.isReduceTransparencyEnabled().catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}

// Primed at import so the bar (mounted after splash/onboarding) starts with
// the right surface instead of flashing glass -> opaque.
let reduceTransparencyCache = false;
void readReduceTransparency().then((enabled) => {
  reduceTransparencyCache = enabled;
});

export function useReduceTransparency(): boolean {
  const [enabled, setEnabled] = useState(reduceTransparencyCache);

  useEffect(() => {
    let active = true;
    void readReduceTransparency().then((value) => {
      reduceTransparencyCache = value;
      if (active) setEnabled(value);
    });
    // iOS-only event; Android never emits it.
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      (value: boolean) => {
        reduceTransparencyCache = value;
        setEnabled(value);
      },
    );
    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  return enabled;
}

export function useTabBarSurface(): TabBarSurfaceMode {
  const reduceTransparency = useReduceTransparency();
  return resolveTabBarSurface({
    os: Platform.OS,
    liquidGlass: LIQUID_GLASS,
    reduceTransparency,
  });
}
