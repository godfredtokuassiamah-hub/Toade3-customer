// One error type for "too many requests", from the client throttle or the
// server (Supabase Auth 429, PostgREST 429 raised by ratelimit.check()).
// Pure: no Supabase import.
//
// Server contract (supabase/migrations/0009_rate_limits.sql):
//   HTTP 429, header Retry-After: <seconds>, body
//   { code: "T3429", message: "RATE_LIMITED",
//     details: "{\"action\":\"order.place\",\"retry_after\":42}", hint }
// On PostgREST < 12 the PGRST raise isn't parsed: the code is "PGRST" and
// the message is the JSON text, so a quoted "RATE_LIMITED" also matches.

export const RATE_LIMIT_CODE = "T3429";
export const RATE_LIMITED = "RATE_LIMITED";

const RATE_LIMIT_CODES = new Set([
  RATE_LIMIT_CODE,
  "PT429",
  // Supabase Auth (@supabase/auth-js ErrorCode).
  "over_email_send_rate_limit",
  "over_request_rate_limit",
]);

export type RateLimitSource = "client" | "server";

export class RateLimitedError extends Error {
  readonly retryAfterMs: number | null;
  readonly source: RateLimitSource;

  constructor(opts?: { retryAfterMs?: number | null; source?: RateLimitSource }) {
    super("Rate limited");
    this.name = "RateLimitedError";
    this.retryAfterMs = opts?.retryAfterMs ?? null;
    this.source = opts?.source ?? "server";
  }
}

// Name check too: Babel-transpiled `extends Error` can break instanceof.
export function isRateLimitedError(e: unknown): boolean {
  return (
    e instanceof RateLimitedError ||
    (e as { name?: unknown } | null)?.name === "RateLimitedError"
  );
}

type PayloadLike = { status?: unknown; code?: unknown; message?: unknown };

// True for any server / client rate-limit error shape. `status` is the HTTP
// status when the caller has it separately (supabase-js `{ error, status }`).
export function isRateLimitPayload(e: unknown, status?: number): boolean {
  if (status === 429) return true;
  if (e === null || typeof e !== "object") return false;
  if (isRateLimitedError(e)) return true;
  const p = e as PayloadLike;
  if (p.status === 429) return true;
  if (typeof p.code === "string" && RATE_LIMIT_CODES.has(p.code)) return true;
  if (typeof p.message === "string") {
    const m = p.message.trim();
    if ((m.split(/[\s:]/)[0] ?? "") === RATE_LIMITED) return true;
    if (m.includes(`"${RATE_LIMITED}"`)) return true;
  }
  return false;
}

// Server hint in ms from `details` ({"retry_after": seconds}), or the
// RateLimitedError's own value; null when absent.
export function retryAfterMsFromPayload(e: unknown): number | null {
  if (e === null || typeof e !== "object") return null;
  if (isRateLimitedError(e)) {
    const v = (e as { retryAfterMs?: unknown }).retryAfterMs;
    return typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : null;
  }
  const raw = (e as { details?: unknown }).details;
  let details: unknown = raw;
  if (typeof raw === "string") {
    try {
      details = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const seconds = (details as { retry_after?: unknown } | null)?.retry_after;
  const n = typeof seconds === "string" ? Number(seconds) : seconds;
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, n * 1000) : null;
}
