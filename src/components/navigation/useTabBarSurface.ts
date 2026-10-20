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
const IS_IOS = Platform.OS === "ios";
const LIQUID_GLASS_AVAILABLE = IS_IOS && safe(isLiquidGlassAvailable);
const GLASS_API_AVAILABLE = IS_IOS && safe(isGlassEffectAPIAvailable);
const LIQUID_GLASS = LIQUID_GLASS_AVAILABLE && GLASS_API_AVAILABLE;

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

// Dev-only: one Metro line per launch so a device run shows which material
// the bar picked and why.
let loggedSurface = false;

export function useTabBarSurface(): TabBarSurfaceMode {
  const reduceTransparency = useReduceTransparency();
  const mode = resolveTabBarSurface({
    os: Platform.OS,
    liquidGlass: LIQUID_GLASS,
    reduceTransparency,
  });

  useEffect(() => {
    if (!__DEV__ || loggedSurface) return;
    loggedSurface = true;
    console.log("[tabbar] surface", {
      os: Platform.OS,
      version: Platform.Version,
      liquidGlass: LIQUID_GLASS_AVAILABLE,
      glassApi: GLASS_API_AVAILABLE,
      reduceTransparency,
      mode,
    });
  }, [mode, reduceTransparency]);

  return mode;
}
