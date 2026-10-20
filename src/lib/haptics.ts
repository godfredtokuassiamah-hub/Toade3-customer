import * as Haptics from "expo-haptics";

// Fire-and-forget haptics that never throw or leave unhandled rejections
// (web without the Vibration API, missing hardware, etc.).
// iOS ignores haptics in Low Power Mode, when System Haptics are off in
// Settings, or during dictation. Android uses Vibrator; the VIBRATE
// permission is added automatically by expo-haptics.

export function errorHaptic(): void {
  try {
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Error,
    ).catch(() => {});
  } catch {
    // Haptics unavailable; nothing to do.
  }
}

export function selectionHaptic(): void {
  try {
    void Haptics.selectionAsync().catch(() => {});
  } catch {
    // Haptics unavailable; nothing to do.
  }
}

export function successHaptic(): void {
  try {
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
  } catch {
    // Haptics unavailable; nothing to do.
  }
}

export function lightHaptic(): void {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  } catch {
    // Haptics unavailable; nothing to do.
  }
}
