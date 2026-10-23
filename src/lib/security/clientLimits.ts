// Client-side throttles shared by the services. UX + load reduction ONLY:
// they stop accidental spam (double taps, resend hammering, retry storms,
// Photon fair-use), not an attacker, who can skip the app entirely. The
// server limits (Supabase Auth, ratelimit schema in 0009) are authoritative.
import { RESEND_COOLDOWN_MS } from "../auth/otp";
import { createInFlight } from "./inFlight";
import { createCooldown, createTokenBucket } from "./tokenBucket";

export const CLIENT_LIMITS = {
  // Per email. Equals RESEND_COOLDOWN_MS and the Supabase per-user OTP window.
  sendCodeCooldownMs: RESEND_COOLDOWN_MS,
  // Per email: 5 quick tries, then one every 12 s.
  verifyCode: { capacity: 5, refillEveryMs: 12_000 },
  // Global: stays under the server's profile.write 10 / min.
  profileWrite: { capacity: 3, refillEveryMs: 10_000 },
  // Global (search + reverse geocode): far above debounced typing.
  places: { capacity: 20, refillEveryMs: 500 },
} as const;

const clock = () => Date.now();

export const sendCodeCooldown = createCooldown(CLIENT_LIMITS.sendCodeCooldownMs, clock);
export const verifyBucket = createTokenBucket({
  capacity: CLIENT_LIMITS.verifyCode.capacity,
  refillPerMs: 1 / CLIENT_LIMITS.verifyCode.refillEveryMs,
  now: clock,
});
export const profileWriteBucket = createTokenBucket({
  capacity: CLIENT_LIMITS.profileWrite.capacity,
  refillPerMs: 1 / CLIENT_LIMITS.profileWrite.refillEveryMs,
  now: clock,
});
export const placesBucket = createTokenBucket({
  capacity: CLIENT_LIMITS.places.capacity,
  refillPerMs: 1 / CLIENT_LIMITS.places.refillEveryMs,
  now: clock,
});

// Shared de-dupe for concurrent identical calls (keys are namespaced by action).
export const inFlight = createInFlight();

export function resetClientLimitsForTests(): void {
  sendCodeCooldown.reset();
  verifyBucket.reset();
  profileWriteBucket.reset();
  placesBucket.reset();
}
