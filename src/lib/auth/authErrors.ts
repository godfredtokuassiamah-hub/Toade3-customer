// Classifies Supabase Auth errors without importing supabase-js, so it
// unit-tests in isolation. Codes checked against @supabase/auth-js
// ErrorCode (lib/error-codes) and the Supabase error-codes docs.

export type AuthErrorKind = "invalid_code" | "rate_limited" | "network" | "unknown";

export const RATE_LIMIT_MESSAGE =
  "Too many attempts. Please wait a minute and try again.";

const RATE_LIMIT_CODES = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit",
]);

type ErrorLike = { name?: unknown; status?: unknown; code?: unknown; message?: unknown };

export function classifyAuthError(e: unknown): AuthErrorKind {
  if (e === null || typeof e !== "object") return "unknown";
  const { name, status, code, message } = e as ErrorLike;

  if (status === 429 || (typeof code === "string" && RATE_LIMIT_CODES.has(code))) {
    return "rate_limited";
  }
  // Supabase returns otp_expired (403) for both a wrong and an expired email OTP.
  if (code === "otp_expired" || (status === 403 && (code === undefined || code === null))) {
    return "invalid_code";
  }
  if (
    name === "AuthRetryableFetchError" ||
    (name === "TypeError" &&
      typeof message === "string" &&
      message.includes("Network request failed"))
  ) {
    return "network";
  }
  return "unknown";
}
