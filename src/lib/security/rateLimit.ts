// Server-side rate-limit table and the pure fixed-window decision, shared
// with the SQL limiter in supabase/migrations/0009_rate_limits.sql
// (rateLimitSql-test.ts keeps SERVER_RATE_LIMITS equal to the SQL seed
// between RATE_LIMITS_BEGIN / RATE_LIMITS_END).
//
// Reuse in a future Edge Function (Deno): this file and ./tokenBucket.ts
// have no React Native imports and only relative imports, so the owner of
// supabase/functions/** can copy them into supabase/functions/_shared/.
// An in-isolate bucket is NOT authoritative (isolates are short-lived and
// run in parallel); for authority call
//   select public.ratelimit_consume('<subject>', '<action>')
// with the service key BEFORE doing the work, and refuse with HTTP 429 +
// Retry-After when it returns allowed = false. Never call it from the app.

export type ServerRateLimit = { readonly max: number; readonly windowSeconds: number };

// Authoritative values live in ratelimit.limits; this mirror is for tests,
// docs and client copy only.
export const SERVER_RATE_LIMITS = {
  "order.place": { max: 5, windowSeconds: 60 },
  "order.cancel": { max: 10, windowSeconds: 60 },
  "profile.write": { max: 10, windowSeconds: 60 },
  "cart.write": { max: 60, windowSeconds: 60 },
} as const satisfies Record<string, ServerRateLimit>;

export type ServerRateLimitAction = keyof typeof SERVER_RATE_LIMITS;

export type FixedWindowState = { windowStart: number; hits: number };

export type FixedWindowDecision = {
  allowed: boolean;
  // Count for this window INCLUDING this request.
  hits: number;
  windowStart: number;
  // 0 when allowed; otherwise ms until the window resets (>= 1).
  retryAfterMs: number;
};

// Same algorithm as ratelimit.hit(): window = floor(now / w) * w; the
// request is allowed while hits <= max. A fixed window can admit up to
// 2 * max across a window boundary; that's accepted for these limits.
// Note: ratelimit.check() raises on deny, which rolls the increment back;
// ratelimit_consume() keeps it. Persist `hits` (or not) to match.
export function decideFixedWindow(
  state: FixedWindowState | null,
  nowMs: number,
  max: number,
  windowMs: number,
): FixedWindowDecision {
  if (!(windowMs > 0)) throw new Error("windowMs must be > 0");
  const windowStart = Math.floor(nowMs / windowMs) * windowMs;
  const prior = state && state.windowStart === windowStart ? state.hits : 0;
  const hits = prior + 1;
  const allowed = hits <= max;
  return {
    allowed,
    hits,
    windowStart,
    retryAfterMs: allowed ? 0 : Math.max(1, windowStart + windowMs - nowMs),
  };
}
