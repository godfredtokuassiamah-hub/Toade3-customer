import { useEffect, useState } from "react";

import { homeData } from "../../data/mock/home";
import { type PostAuthRoute, routeForProfile } from "../../lib/auth/profileCompletion";
import { getFirstName } from "../../lib/format";
import { fetchMyProfile } from "../../services/profile";
import type { SavedLocation } from "./useUserLocation";

type HomeUser = {
  firstName: string;
  fullName: string;
  // Set once a fetch succeeds and the profile still needs a setup step
  // (/complete-profile or /complete-address); null otherwise.
  nextRoute: Exclude<PostAuthRoute, "/home"> | null;
  // Saved delivery address line (profile.address_label).
  addressLabel: string | null;
  // Last device location saved to the profile.
  savedLocation: SavedLocation;
};

const NO_LOCATION: SavedLocation = { locationLabel: null, lat: null, lng: null };

// Real name for the Home top bar. Starts from the mock user and swaps in the
// profile once it loads; errors keep the mock (offline etc.).
export function useHomeUser(): HomeUser {
  const [user, setUser] = useState<HomeUser>({
    firstName: homeData.user.firstName,
    fullName: homeData.user.fullName,
    nextRoute: null,
    addressLabel: null,
    savedLocation: NO_LOCATION,
  });

  useEffect(() => {
    let cancelled = false;
    fetchMyProfile()
      .then((profile) => {
        if (cancelled) return;
        const fullName = profile?.full_name?.trim();
        const route = routeForProfile(profile);
        setUser((prev) => ({
          firstName: fullName ? getFirstName(fullName) : prev.firstName,
          fullName: fullName || prev.fullName,
          nextRoute: route === "/home" ? null : route,
          addressLabel: profile?.address_label?.trim() || null,
          savedLocation: {
            locationLabel: profile?.location_label?.trim() || null,
            lat: profile?.location_lat ?? null,
            lng: profile?.location_lng ?? null,
          },
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return user;
}
