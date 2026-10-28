// Blocks screenshots / screen recording while a sensitive screen (OTP entry,
// checkout) is mounted. expo-screen-capture is included in Expo Go (SDK 58),
// so this works there too. Android only: FLAG_SECURE (also blanks the
// recent-apps preview). iOS is a no-op because the iOS block blacks out the
// screen once the keyboard opens (see nativeProtections in capabilities.ts).
// It does not stop a second camera, and it is a privacy measure, not access
// control.
//
// The platform choice is made once at module load, so the hook order is the
// same on every render (rules of hooks). Web has no screen-capture API.
import { usePreventScreenCapture } from "expo-screen-capture";
import { Platform } from "react-native";

import { nativeProtections } from "./capabilities";

const SENSITIVE_KEY = "toade3-sensitive";

function usePreventCapture(): void {
  usePreventScreenCapture(SENSITIVE_KEY);
}

function noop(): void {}

export const useSensitiveScreen: () => void =
  Platform.OS !== "web" && nativeProtections().screenCapture ? usePreventCapture : noop;
