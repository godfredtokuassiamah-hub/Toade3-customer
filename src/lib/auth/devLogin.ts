// DEV-ONLY login that skips Supabase so the app can be used before the
// Supabase project's email OTP is configured.
//
// Active only when ALL hold:
//   - __DEV__ (dev server / Expo Go). Production builds strip this, so the
//     values below are never read or bundled in a release.
//   - EXPO_PUBLIC_DEV_LOGIN_EMAIL and EXPO_PUBLIC_DEV_LOGIN_CODE are set in
//     .env (gitignored).
// Signing in with that email sends nothing; entering that code "verifies"
// and opens Home with a local, in-memory profile. Nothing is written to
// Supabase. The dev session ends when the app restarts.
//
// TODO(auth): remove once real email OTP works on the Supabase project.
import type { Profile } from "../../services/profile";

const DEV_EMAIL = __DEV__
  ? process.env.EXPO_PUBLIC_DEV_LOGIN_EMAIL?.trim().toLowerCase()
  : undefined;
const DEV_CODE = __DEV__ ? process.env.EXPO_PUBLIC_DEV_LOGIN_CODE?.trim() : undefined;

export function isDevLoginEmail(email: string): boolean {
  return !!DEV_EMAIL && !!DEV_CODE && email.trim().toLowerCase() === DEV_EMAIL;
}

export function isDevLoginCode(code: string): boolean {
  return !!DEV_CODE && code === DEV_CODE;
}

let devProfile: Profile | null = null;

export function startDevSession(): void {
  // Name + phone only, so dev login goes through the address step.
  devProfile = {
    full_name: "Toade3 Tester",
    phone: "+233200000000",
    country_code: "+233",
    address_label: null,
    address_full: null,
    address_details: null,
    address_lat: null,
    address_lng: null,
    address_place_id: null,
    location_lat: null,
    location_lng: null,
    location_label: null,
    location_updated_at: null,
  };
}

export function isDevSession(): boolean {
  return devProfile !== null;
}

export function getDevProfile(): Profile | null {
  return devProfile;
}

// Shallow-merges into the dev profile; no-op without a dev session.
export function updateDevProfile(patch: Partial<Profile>): void {
  if (!devProfile) return;
  devProfile = { ...devProfile, ...patch };
}
