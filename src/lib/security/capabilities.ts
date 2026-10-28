// Capability checks for native security features (Docs/security/hardening.md).
//
// App Store Expo Go ships only its bundled native modules, so every native
// protection is gated: a feature is used only when it is implemented here,
// the app is NOT running in Expo Go, and its module is present. Missing
// modules never throw; the feature simply reports false and the app keeps
// working. These are hardening signals for the server, never the control
// itself: authorization stays in RLS / grants / SECURITY DEFINER SQL.
//
// Constants.executionEnvironment (SDK 58 expo-constants):
//   storeClient = Expo Go or a development build (expo-dev-client)
//   standalone  = a release build
//   bare        = a project with its own native directories
// Constants.expoGoConfig is populated only inside Expo Go.
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

export function isExpoGo(): boolean {
  return (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient &&
    Constants.expoGoConfig != null
  );
}

export function isReleaseBuild(): boolean {
  return !__DEV__ && Constants.executionEnvironment === ExecutionEnvironment.Standalone;
}

export type NativeProtections = {
  // expo-screen-capture (included in Expo Go): FLAG_SECURE on Android only.
  // Off on iOS: its screenshot block re-parents the key window's layer into a
  // secure UITextField canvas, and on iOS 27 that canvas renders black once
  // the keyboard opens (the OTP screen went black behind the keyboard; see
  // expo/expo#48985 for the same layer trick black-screening the app).
  screenCapture: boolean;
  // iOS App Attest / Android Play Integrity (@expo/app-integrity): not
  // installed. Expo Go would attest Expo Go, not this app, so it stays false
  // there even once installed.
  appIntegrity: false;
  // TLS public-key pinning: not adopted (pin rotation risk), needs a native
  // module in a development / release build.
  tlsPinning: false;
  // Jailbreak / root detection: not installed; a soft risk signal only.
  rootDetection: false;
};

export function nativeProtections(): NativeProtections {
  return {
    screenCapture: Platform.OS === "android",
    appIntegrity: false,
    tlsPinning: false,
    rootDetection: false,
  };
}
