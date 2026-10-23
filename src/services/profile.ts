// Profile reads/writes against public.profiles (RLS: own row only).
// The handle_new_user trigger creates the row at sign-up, so writes are
// UPDATEs (never upserts: clients have no UPDATE privilege on `id`/`role`).
import {
  type PostAuthRoute,
  type ProfileSummary,
  routeForProfile,
  withTimeout,
} from "../lib/auth/profileCompletion";
import {
  getDevProfile,
  isDevSession,
  updateDevProfile,
} from "../lib/auth/devLogin";
import { mapBackendError } from "../lib/backend/errors";
import { retryWithBackoff } from "../lib/security/backoff";
import { inFlight, profileWriteBucket } from "../lib/security/clientLimits";
import {
  isRateLimitPayload,
  RateLimitedError,
  retryAfterMsFromPayload,
} from "../lib/security/rateLimitError";
import { supabase } from "../lib/supabase";
import { getCurrentUserId } from "./auth";

export type Profile = ProfileSummary & {
  country_code: string | null;
  address_label: string | null;
  address_full: string | null;
  address_details: string | null;
  address_lat: number | null;
  address_lng: number | null;
  address_place_id: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_label: string | null;
  location_updated_at: string | null;
};

const PROFILE_COLUMNS =
  "full_name, phone, country_code, address_label, address_full, address_details, " +
  "address_lat, address_lng, address_place_id, location_lat, location_lng, " +
  "location_label, location_updated_at";

export class NotSignedInError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "NotSignedInError";
  }
}

export class ProfileSaveError extends Error {
  constructor(cause?: unknown) {
    super("Couldn't save profile");
    this.name = "ProfileSaveError";
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

async function requireUserId(): Promise<string> {
  const id = await getCurrentUserId();
  if (!id) throw new NotSignedInError();
  return id;
}

// The signed-in user's profile, or null when the row doesn't exist yet.
export async function fetchMyProfile(): Promise<Profile | null> {
  if (isDevSession()) return getDevProfile();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle<Profile>();
  if (error) throw error;
  return data;
}

export type CompleteProfileInput = {
  fullName: string;
  // E.164, e.g. +233201234567.
  phone: string;
  // Dial code, e.g. +233.
  countryCode: string;
};

export async function completeProfile({
  fullName,
  phone,
  countryCode,
}: CompleteProfileInput): Promise<void> {
  if (isDevSession()) {
    updateDevProfile({ full_name: fullName, phone, country_code: countryCode });
    return;
  }
  await writeProfile({ full_name: fullName, phone, country_code: countryCode });
}

// Same UPDATE ... eq(id) pattern as completeProfile.
async function updateMyProfile(patch: Partial<Profile>): Promise<void> {
  if (isDevSession()) {
    updateDevProfile(patch);
    return;
  }
  await writeProfile(patch);
}

const PROFILE_WRITE_ATTEMPTS = 3;

type WriteRes = { data: unknown; error: unknown; status: number };

// Carries a transient response out of the retry loop.
class TransientWrite {
  readonly res: WriteRes;
  constructor(res: WriteRes) {
    this.res = res;
  }
}

// The server never answered usefully (network) or is briefly unavailable.
function isTransient(error: unknown, status?: number): boolean {
  return status === 503 || mapBackendError(error, status).code === "NETWORK";
}

// Stable de-dupe key; location_updated_at differs per call for the same spot.
function patchKey(userId: string, patch: Partial<Profile>): string {
  const entries = Object.entries(patch)
    .filter(([k]) => k !== "location_updated_at")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `profile.write:${userId}:${JSON.stringify(entries)}`;
}

// UPDATE own row. Client throttle (UX only; the server's profile.write
// trigger in 0009 is authoritative), identical concurrent saves share one
// request, and transient failures retry up to 3 attempts with jittered
// backoff: a set-to-value PATCH is idempotent. A server 429 becomes
// RateLimitedError and is never retried.
async function writeProfile(patch: Partial<Profile>): Promise<void> {
  const userId = await requireUserId();
  await inFlight.run(patchKey(userId, patch), async () => {
    if (!profileWriteBucket.tryTake()) {
      throw new RateLimitedError({
        source: "client",
        retryAfterMs: profileWriteBucket.msUntilAvailable(),
      });
    }
    let res: WriteRes;
    try {
      res = await retryWithBackoff(
        async () => {
          const r = (await supabase
            .from("profiles")
            .update(patch)
            .eq("id", userId)
            .select("id")
            .maybeSingle()) as WriteRes;
          if (r.error && isTransient(r.error, r.status)) throw new TransientWrite(r);
          return r;
        },
        {
          maxAttempts: PROFILE_WRITE_ATTEMPTS,
          shouldRetry: (e) => e instanceof TransientWrite || isTransient(e),
        },
      );
    } catch (e) {
      if (e instanceof TransientWrite) res = e.res;
      else throw new ProfileSaveError(e);
    }
    if (res.error) {
      if (isRateLimitPayload(res.error, res.status)) {
        throw new RateLimitedError({ source: "server", retryAfterMs: retryAfterMsFromPayload(res.error) });
      }
      throw new ProfileSaveError(res.error);
    }
    // No row: the trigger didn't run or RLS hid it.
    if (!res.data) throw new ProfileSaveError();
  });
}

const clip = (v: string, max: number) => v.trim().slice(0, max);

export type SaveAddressInput = {
  // Short line shown in the app, e.g. "University Avenue".
  label: string;
  fullAddress: string;
  lat: number;
  lng: number;
  // PlaceSuggestion.id ("photon:..." or "device:...").
  placeId: string;
  // Apartment, floor, landmark; blank -> null.
  details: string | null;
};

export async function saveAddress(i: SaveAddressInput): Promise<void> {
  const label = clip(i.label, 200);
  if (!label || !Number.isFinite(i.lat) || !Number.isFinite(i.lng)) {
    throw new ProfileSaveError();
  }
  await updateMyProfile({
    address_label: label,
    address_full: clip(i.fullAddress, 500) || label,
    address_details: i.details ? clip(i.details, 120) || null : null,
    address_lat: i.lat,
    address_lng: i.lng,
    address_place_id: clip(i.placeId, 100) || null,
  });
}

export type SaveLocationInput = { lat: number; lng: number; label: string | null };

export async function saveCurrentLocation(i: SaveLocationInput): Promise<void> {
  if (!Number.isFinite(i.lat) || !Number.isFinite(i.lng)) throw new ProfileSaveError();
  await updateMyProfile({
    location_lat: i.lat,
    location_lng: i.lng,
    location_label: i.label ? clip(i.label, 200) || null : null,
    location_updated_at: new Date().toISOString(),
  });
}

export type LaunchRoute = "/onboarding" | PostAuthRoute;

// Where the splash should go. No session -> onboarding. A session but a
// failed/slow profile fetch -> /home (Home re-checks and redirects to
// /complete-profile or /complete-address if needed), so an offline user
// isn't stranded.
export async function getLaunchRoute(): Promise<LaunchRoute> {
  try {
    const { data, error } = await withTimeout(supabase.auth.getSession(), 6000);
    if (error || !data.session) return "/onboarding";
  } catch {
    return "/onboarding";
  }
  try {
    return routeForProfile(await withTimeout(fetchMyProfile(), 5000));
  } catch {
    return "/home";
  }
}
