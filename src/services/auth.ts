// Auth service stub. Callers pass an already-normalized email
// (normalizeEmail output from src/lib/validation/email).
//
// TODO(auth): replace with Supabase email OTP once the client is added:
//   const { error } = await supabase.auth.signInWithOtp({ email });
//   if (error) throw error;
export async function requestEmailCode(email: string): Promise<void> {
  void email;
  await new Promise((resolve) => setTimeout(resolve, 800)); // simulated latency
}

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

// Demo code accepted by the stub until the real backend exists.
// Every other code is rejected, so the wrong-code UI (vibration, shake,
// red boxes) can be exercised with any code. Remove with the stub.
export const DEMO_VERIFICATION_CODE = "1234";

// Verify stub. Resolves after simulated latency for DEMO_VERIFICATION_CODE;
// rejects every other code with InvalidCodeError.
//
// TODO(auth): replace with Supabase once the client is added:
//   const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
//   if (error) throw error; // map invalid/expired-token errors to InvalidCodeError
// Session/profile bootstrap happens after this resolves.
export async function verifyEmailCode(
  email: string,
  code: string,
): Promise<void> {
  void email;
  await new Promise((resolve) => setTimeout(resolve, 800)); // simulated latency
  if (code !== DEMO_VERIFICATION_CODE) throw new InvalidCodeError();
}
