// Free place search + reverse geocoding via Photon (komoot), OpenStreetMap
// data, no API key. The public server is fair-use only (throttled or banned
// on heavy use, no availability guarantee): for production point
// EXPO_PUBLIC_PLACES_BASE_URL at a self-hosted Photon. A keyed provider
// (LocationIQ, Geoapify) needs only this file + a mapper swap; the UI uses
// PlaceSuggestion and doesn't change.
// Data is ODbL: the UI must show "© OpenStreetMap contributors".
import Constants from "expo-constants";
import { Platform } from "react-native";

import { mapPhotonResponse } from "../lib/places/mapPhoton";
import type { LatLng, PlaceSuggestion } from "../lib/places/types";
import { parseRetryAfter, retryWithBackoff } from "../lib/security/backoff";
import { placesBucket } from "../lib/security/clientLimits";

// Direct process.env access so Expo inlines it at build time.
export const PLACES_BASE_URL = (
  process.env.EXPO_PUBLIC_PLACES_BASE_URL?.trim() || "https://photon.komoot.io"
).replace(/\/+$/, "");

export const PLACES_MIN_CHARS = 3;
// Accra; used when the device position isn't available.
export const DEFAULT_BIAS: LatLng = { lat: 5.6037, lng: -0.187 };

const LIMIT = 6;
// Photon accepts default, de, en, fr only (other values -> HTTP 400).
const LANG = "en";
const ZOOM = 12;
const TIMEOUT_MS = 8000;
const CACHE_MAX = 30;
// GETs are idempotent: retry 429 / 503 (Photon throttling or a brief outage)
// up to 3 attempts with jittered backoff, honouring Retry-After (max 10 s).
// 500, network failures and bad JSON are not retried.
const MAX_ATTEMPTS = 3;
const RETRY_AFTER_MAX_MS = 10_000;
const RETRY_STATUSES = new Set([429, 503]);

export class PlacesError extends Error {
  // HTTP status for non-OK responses.
  status?: number;
  // Retry-After hint in ms, when the server sent one.
  retryAfterMs?: number | null;

  constructor(message = "Place lookup failed", cause?: unknown) {
    super(message);
    this.name = "PlacesError";
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

function httpError(res: Response): PlacesError {
  const e = new PlacesError(`HTTP ${res.status}`);
  e.status = res.status;
  // Test doubles may omit headers.
  const h = (res as { headers?: { get?: (name: string) => string | null } }).headers;
  e.retryAfterMs = parseRetryAfter(h?.get?.("Retry-After"), Date.now(), RETRY_AFTER_MAX_MS);
  return e;
}

function abortError(): Error {
  const e = new Error("Aborted");
  e.name = "AbortError";
  return e;
}

// Browsers forbid setting User-Agent; native fetch allows it. No Referer
// (meaningless outside a browser).
function headers(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  if (Platform.OS !== "web") {
    const version = Constants.expoConfig?.version ?? "1.0.0";
    h["User-Agent"] = `Toade3-Customer/${version} (React Native)`;
  }
  return h;
}

// GET JSON with an 8 s timeout per attempt. A caller abort rethrows
// AbortError (so latest-wins callers can ignore it); everything else is a
// PlacesError. A client-side token bucket (UX / fair-use only) caps bursts
// before any request is sent.
async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  if (signal?.aborted) throw abortError();
  if (!placesBucket.tryTake()) throw new PlacesError("Rate limited");
  return retryWithBackoff(() => getJsonOnce(url, signal), {
    maxAttempts: MAX_ATTEMPTS,
    shouldRetry: (e) => e instanceof PlacesError && e.status !== undefined && RETRY_STATUSES.has(e.status),
    retryAfterMs: (e) => (e instanceof PlacesError ? (e.retryAfterMs ?? null) : null),
    signal,
  });
}

async function getJsonOnce(url: string, signal?: AbortSignal): Promise<unknown> {
  if (signal?.aborted) throw abortError();
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    let res: Response;
    try {
      res = await fetch(url, { headers: headers(), signal: controller.signal });
    } catch (e) {
      if (signal?.aborted) throw abortError();
      throw new PlacesError(timedOut ? "Timed out" : "Network error", e);
    }
    if (!res.ok) throw httpError(res);
    try {
      return await res.json();
    } catch (e) {
      if (signal?.aborted) throw abortError();
      throw new PlacesError("Invalid response", e);
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

const round4 = (n: number) => Number(n.toFixed(4));

// Small in-memory LRU of successful searches.
const cache = new Map<string, PlaceSuggestion[]>();

export function clearPlacesCache(): void {
  cache.clear();
}

export async function searchPlaces(
  query: string,
  opts: { bias?: LatLng | null; signal?: AbortSignal; limit?: number } = {},
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < PLACES_MIN_CHARS) return [];
  const bias = opts.bias ?? DEFAULT_BIAS;
  const limit = opts.limit ?? LIMIT;
  const key = `${q.toLowerCase()}|${bias.lat.toFixed(2)},${bias.lng.toFixed(2)}|${limit}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  // lat/lon is a soft location bias, not a filter (no bbox / countrycode,
  // so other countries still show up).
  const url =
    `${PLACES_BASE_URL}/api/?q=${encodeURIComponent(q)}` +
    `&limit=${limit}&lang=${LANG}` +
    `&lat=${round4(bias.lat)}&lon=${round4(bias.lng)}&zoom=${ZOOM}`;
  const results = mapPhotonResponse(await getJson(url, opts.signal));
  cache.set(key, results);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return results;
}

// Nearest address for a point, or null when Photon has nothing there.
export async function reverseGeocode(
  lat: number,
  lng: number,
  opts: { signal?: AbortSignal } = {},
): Promise<PlaceSuggestion | null> {
  const url =
    `${PLACES_BASE_URL}/reverse?lat=${round4(lat)}&lon=${round4(lng)}` +
    `&limit=1&lang=${LANG}`;
  const [first] = mapPhotonResponse(await getJson(url, opts.signal));
  return first ?? null;
}
