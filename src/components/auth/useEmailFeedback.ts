import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";

import { errorHaptic, selectionHaptic } from "../../lib/haptics";
import {
  isValidEmail,
  looksComplete,
  normalizeEmail,
} from "../../lib/validation/email";

export const EMAIL_ERROR_MESSAGE =
  "Enter a valid email address, like name@example.com";

const DEBOUNCE_MS = 900;

// Owns the email value plus the "wrong email" feedback:
// - error haptic + shake + red border + inline error + screen-reader
//   announcement on (a) Go while invalid, (b) blur while non-empty and
//   invalid, (c) a ~900 ms pause on a complete-looking but invalid value
//   (once per focus session); at most one buzz/shake per distinct invalid
//   value;
// - a light tick once per invalid -> valid transition;
// - nothing is shown until the user has interacted.
export function useEmailFeedback() {
  const [email, setEmailState] = useState("");
  const [showError, setShowError] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const lastBuzzed = useRef<string | null>(null);
  // The typing-pause trigger fires at most once per focus session, so slow
  // typers aren't nagged; blur and Go still flag every new invalid value.
  const pauseFlagged = useRef(false);
  const wasValid = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => clearTimer, []);

  // Returns true when the value is valid.
  const flag = (value: string): boolean => {
    const n = normalizeEmail(value);
    if (isValidEmail(n)) return true;
    if (n === "") return false;
    setShowError(true);
    if (lastBuzzed.current !== n) {
      lastBuzzed.current = n;
      errorHaptic();
      setShakeKey((k) => k + 1);
      // Announce on both platforms: the error Text stays mounted inside an
      // animated collapse, so a live region wouldn't fire reliably.
      AccessibilityInfo.announceForAccessibility(EMAIL_ERROR_MESSAGE);
    }
    return false;
  };

  const setEmail = (next: string) => {
    setEmailState(next);
    clearTimer();
    const valid = isValidEmail(next);
    if (valid) {
      setShowError(false);
      if (!wasValid.current) selectionHaptic();
    } else if (!pauseFlagged.current && looksComplete(next)) {
      timer.current = setTimeout(() => {
        timer.current = null;
        pauseFlagged.current = true;
        flag(next);
      }, DEBOUNCE_MS);
    }
    wasValid.current = valid;
  };

  const flagIfInvalid = (): boolean => {
    clearTimer();
    return flag(email);
  };

  const onFocus = () => {
    pauseFlagged.current = false;
  };

  const onBlur = () => {
    clearTimer();
    if (email.trim() !== "") flag(email);
  };

  return {
    email,
    setEmail,
    showError,
    shakeKey,
    flagIfInvalid,
    onFocus,
    onBlur,
  };
}
