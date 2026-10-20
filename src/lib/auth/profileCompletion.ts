// Pure profile-completion helpers (no RN / Supabase imports).

export type ProfileSummary = {
  full_name: string | null;
  phone: string | null;
  // Optional so older callers/fixtures without the column still type-check.
  address_label?: string | null;
};

export type PostAuthRoute = "/home" | "/complete-profile" | "/complete-address";

const filled = (v: string | null | undefined) =>
  typeof v === "string" && v.trim() !== "";

// Step 1 (details): a row with a non-blank name and phone.
export function hasProfileDetails(p: ProfileSummary | null | undefined): boolean {
  return !!p && filled(p.full_name) && filled(p.phone);
}

// Step 2 (address): a non-blank address label.
export function hasAddress(p: ProfileSummary | null | undefined): boolean {
  return !!p && filled(p.address_label);
}

// New or incomplete: no row, or a blank name, phone or address.
// Location (step 3) is optional and never counts.
export function isProfileComplete(p: ProfileSummary | null | undefined): boolean {
  return hasProfileDetails(p) && hasAddress(p);
}

export function routeForProfile(
  p: ProfileSummary | null | undefined,
): PostAuthRoute {
  if (!hasProfileDetails(p)) return "/complete-profile";
  if (!hasAddress(p)) return "/complete-address";
  return "/home";
}

export class TimeoutError extends Error {
  constructor() {
    super("Timed out");
    this.name = "TimeoutError";
  }
}

// Rejects with TimeoutError if `promise` hasn't settled within `ms`.
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
