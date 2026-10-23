// Supabase email OTP auth. Callers pass an already-normalized email
// (normalizeEmail output from src/lib/validation/email).
//
// Product note: the blueprint (Docs/Toade3_Customer_App_End_to_End_Architecture.pdf
// §4) specified phone OTP + Google. This build deliberately uses email OTP
// for auth and collects an unverified phone number on the profile.
import { classifyAuthError } from "../lib/auth/authErrors";
import {
  isDevLoginCode,
  isDevLoginEmail,
  startDevSession,
} from "../lib/auth/devLogin";
import { inFlight, sendCodeCooldown, verifyBucket } from "../lib/security/clientLimits";
import {
  isRateLimitedError,
  RateLimitedError,
  retryAfterMsFromPayload,
} from "../lib/security/rateLimitError";
import { supabase } from "../lib/supabase";

// Thrown by verifyEmailCode when the code is wrong or expired.
export class InvalidCodeError extends Error {
  constructor() {
    super("Invalid verification code");
    this.name = "InvalidCodeError";
  }
}

// Name check too: Babel-transpiled `extends Error` can break instanceof.
export function isInvalidCodeError(e: unknown): boolean {
  return (
    e instanceof InvalidCodeError ||
    (e as { name?: unknown } | null)?.name === "InvalidCodeError"
  );
}

// Thrown when sending or verifying a code is rate-limited: by Supabase Auth
// (authoritative, 429) or by the client throttle below (UX only).
export { RateLimitedError, isRateLimitedError };

// Sends a 6-digit code (the email template must include {{ .Token }}).
// Creates the account on first sign-in.
//
// Client throttle (load reduction, not security; Supabase Auth enforces the
// real limit): one send per email per RESEND_COOLDOWN_MS, concurrent sends
// for the same email share one request, and a failed (non-429) send frees
// the cooldown. Never retried automatically: each call sends an email.
export async function requestEmailCode(email: string): Promise<void> {
  // Dev login: no email is sent; the code comes from .env.
  if (isDevLoginEmail(email)) return;
  await inFlight.run(`auth.sendCode:${email}`, async () => {
    if (!sendCodeCooldown.tryTake(email)) {
      throw new RateLimitedError({
        source: "client",
        retryAfterMs: sendCodeCooldown.msUntilAvailable(email),
      });
    }
    let error: unknown;
    try {
      ({ error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      }));
    } catch (e) {
      sendCodeCooldown.reset(email);
      throw e;
    }
    if (!error) return;
    if (classifyAuthError(error) === "rate_limited") {
      throw new RateLimitedError({ source: "server", retryAfterMs: retryAfterMsFromPayload(error) });
    }
    sendCodeCooldown.reset(email);
    throw error;
  });
}

// Verifies the code and stores the session (via the client's storage).
// Client throttle: 5 quick tries per email, then one every 12 s; identical
// concurrent verifies share one request. Never retried (single-use code).
export async function verifyEmailCode(
  email: string,
  code: string,
): Promise<void> {
  if (isDevLoginEmail(email)) {
    if (!isDevLoginCode(code)) throw new InvalidCodeError();
    startDevSession();
    return;
  }
  await inFlight.run(`auth.verify:${email}:${code}`, async () => {
    if (!verifyBucket.tryTake(email)) {
      throw new RateLimitedError({
        source: "client",
        retryAfterMs: verifyBucket.msUntilAvailable(email),
      });
    }
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    if (error) {
      const kind = classifyAuthError(error);
      if (kind === "invalid_code") throw new InvalidCodeError();
      if (kind === "rate_limited") {
        throw new RateLimitedError({ source: "server", retryAfterMs: retryAfterMsFromPayload(error) });
      }
      throw error;
    }
    if (!data.session) throw new Error("Verification returned no session");
  });
}

// Signed-in user's id from the locally stored session, or null.
export async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user.id ?? null;
}
