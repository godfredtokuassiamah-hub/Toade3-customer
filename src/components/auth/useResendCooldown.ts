import { useEffect, useState } from "react";
import { AppState } from "react-native";

import {
  getResendRemainingSeconds,
  RESEND_COOLDOWN_MS,
} from "../../lib/auth/otp";

// Resend cooldown measured from a send timestamp. The 1 s interval only
// triggers re-renders; remaining time is always recomputed from `sentAt`, and
// it refreshes when the app returns to the foreground, so backgrounding
// doesn't freeze the countdown.
export function useResendCooldown(
  initialSentAt: number,
  cooldownMs: number = RESEND_COOLDOWN_MS,
) {
  const [sentAt, setSentAt] = useState(initialSentAt);
  const [now, setNow] = useState(() => Date.now());
  const remaining = getResendRemainingSeconds(sentAt, now, cooldownMs);
  const counting = remaining > 0;

  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [counting]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });
    return () => sub.remove();
  }, []);

  const restart = () => {
    const t = Date.now();
    setSentAt(t);
    setNow(t);
  };

  return { remaining, ready: remaining === 0, restart };
}
