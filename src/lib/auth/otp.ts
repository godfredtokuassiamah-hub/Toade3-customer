// Pure OTP helpers (no React Native imports, so they unit-test in isolation).

// Digits in the email verification code. The mock shows 4 boxes.
// FLAG: Supabase email OTP is 6 digits by default (configurable in Supabase
// Auth settings). Either configure the backend to 4 or set this to 6; the UI
// supports 4-8.
export const OTP_LENGTH = 4;

// Wait before "Didn't receive code?" can resend.
export const RESEND_COOLDOWN_MS = 60_000;

// Keeps digits only and truncates to `length` (handles pasted/autofilled codes
// like "123 456" or "Your code: 1234").
export function sanitizeOtp(input: string, length: number): string {
  return input.replace(/\D/g, "").slice(0, length);
}

// Whole seconds left before a resend is allowed, computed from the send
// timestamp so time spent in the background is counted. A future `sentAt`
// (clock skew) is clamped to the full cooldown.
export function getResendRemainingSeconds(
  sentAt: number,
  now: number,
  cooldownMs: number = RESEND_COOLDOWN_MS,
): number {
  const full = Math.ceil(cooldownMs / 1000);
  return Math.max(0, Math.min(full, Math.ceil((sentAt + cooldownMs - now) / 1000)));
}

// m:ss, e.g. 59 -> "0:59", 5 -> "0:05", 60 -> "1:00". Callers treat 0 as ready.
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Parses the `sentAt` route param (ms epoch). Falls back to `now` when it's
// missing, malformed or in the future, so the cooldown never exceeds 60s.
export function parseSentAt(
  raw: string | string[] | undefined,
  now: number,
): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(value);
  if (value === undefined || value === "" || !Number.isFinite(n) || n <= 0 || n > now) {
    return now;
  }
  return n;
}

// Box size for a row of `length` boxes in `availableWidth`: 56x68 at most
// (mock size), shrinking on narrow screens or long codes.
export function computeOtpBoxSize(
  availableWidth: number,
  length: number,
): { width: number; height: number; gap: number; fontSize: number } {
  const gap = length > 6 ? 8 : 12;
  const width = Math.max(
    1,
    Math.min(56, Math.floor((availableWidth - gap * (length - 1)) / length)),
  );
  return {
    width,
    height: Math.round((width * 68) / 56),
    gap,
    fontSize: Math.min(24, Math.round(width * 0.43)),
  };
}
