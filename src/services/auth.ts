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

// Thrown when Supabase rate-limits sending or verifying a code.
export class RateLimitedError extends Error {
  constructor() {
    super("Rate limited");
    this.name = "RateLimitedError";
  }
}

export function isRateLimitedError(e: unknown): boolean {
  return (
    e instanceof RateLimitedError ||
    (e as { name?: unknown } | null)?.name === "RateLimitedError"
  );
}

// Sends a 6-digit code (the email template must include {{ .Token }}).
// Creates the account on first sign-in.
export async function requestEmailCode(email: string): Promise<void> {
  // Dev login: no email is sent; the code comes from .env.
  if (isDevLoginEmail(email)) return;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (!error) return;
  if (classifyAuthError(error) === "rate_limited") throw new RateLimitedError();
  throw error;
}

// Verifies the code and stores the session (via the client's storage).
export async function verifyEmailCode(
  email: string,
  code: string,
): Promise<void> {
  if (isDevLoginEmail(email)) {
    if (!isDevLoginCode(code)) throw new InvalidCodeError();
    startDevSession();
    return;
  }
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "email",
  });
  if (error) {
    const kind = classifyAuthError(error);
    if (kind === "invalid_code") throw new InvalidCodeError();
    if (kind === "rate_limited") throw new RateLimitedError();
    throw error;
  }
  if (!data.session) throw new Error("Verification returned no session");
}

// Signed-in user's id from the locally stored session, or null.
export async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user.id ?? null;
}
