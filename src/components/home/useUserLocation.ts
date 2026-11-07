// Live device location label for the Home top bar. Never prompts: it only
// reads the foreground permission. When granted, refreshes on Home mount and
// on app foreground, throttled to once per LOCATION_REFRESH_MS, and saves
// the point to the profile in the background (fire-and-forget) when it moved
// > 100 m or the label changed.
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import {
  LOCATION_REFRESH_MS,
  movedEnough,
  shouldRefresh,
} from "../../lib/places/locationLabel";
import type { LatLng } from "../../lib/places/types";
import {
  type DescribedPlace,
  describeCoords,
  getDeviceCoords,
  readPermission,
} from "../../services/deviceLocation";
import { saveCurrentLocation } from "../../services/profile";

const SAVE_DISTANCE_M = 100;

type SavedPoint = { coords: LatLng; label: string | null };

// Module-level so the throttle and label survive Home remounts in the same
// JS session.
// `place` is the last described fix (null until one resolves), used by the
// "you've moved" prompt.
let cached: { label: string | null; place: DescribedPlace | null; at: number | null } = {
  label: null,
  place: null,
  at: null,
};
let lastSaved: SavedPoint | null = null;
let inFlight = false;

// Seeds the cache after another screen (enable-location) captured and saved
// the location, so Home doesn't immediately repeat the work.
export function primeUserLocation(label: string | null, coords: LatLng): void {
  cached = { label, place: cached.place, at: Date.now() };
  lastSaved = { coords, label };
}

export type SavedLocation = {
  locationLabel: string | null;
  lat: number | null;
  lng: number | null;
};

type LiveState = {
  liveLabel: string | null;
  // Described device position; null without permission or before a fix.
  livePlace: DescribedPlace | null;
  permissionGranted: boolean;
};

export function useUserLocation(saved: SavedLocation): LiveState {
  const [state, setState] = useState<LiveState>({
    liveLabel: null,
    livePlace: null,
    permissionGranted: false,
  });
  // Latest saved profile point, read inside the async refresh.
  const savedRef = useRef(saved);
  useEffect(() => {
    savedRef.current = saved;
  });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const perm = await readPermission();
      if (cancelled) return;
      setState({
        liveLabel: perm.granted ? cached.label : null,
        livePlace: perm.granted ? cached.place : null,
        permissionGranted: perm.granted,
      });
      if (!perm.granted || inFlight) return;
      if (!shouldRefresh(cached.at, Date.now(), LOCATION_REFRESH_MS)) return;
      inFlight = true;
      try {
        const coords = await getDeviceCoords({ timeoutMs: 10000 });
        const place = await describeCoords(coords);
        // Geocode failure keeps the previous label.
        const label = place?.shortLabel ?? cached.label;
        cached = { label, place: place ?? cached.place, at: Date.now() };
        if (!cancelled) {
          setState({ liveLabel: label, livePlace: cached.place, permissionGranted: true });
        }

        const s = savedRef.current;
        const prev: SavedPoint | null =
          lastSaved ??
          (s.lat != null && s.lng != null
            ? { coords: { lat: s.lat, lng: s.lng }, label: s.locationLabel }
            : null);
        const labelChanged = !!label && label !== prev?.label;
        if (!prev || movedEnough(prev.coords, coords, SAVE_DISTANCE_M) || labelChanged) {
          lastSaved = { coords, label };
          void saveCurrentLocation({ lat: coords.lat, lng: coords.lng, label }).catch(() => {
            // Retry on a later refresh.
            lastSaved = prev;
          });
        }
      } catch {
        // No fix (timeout, services off): keep the previous label.
      } finally {
        inFlight = false;
      }
    };

    void run();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void run();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return state;
}
