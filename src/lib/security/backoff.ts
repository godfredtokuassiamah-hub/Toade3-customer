// Exponential backoff with full jitter, Retry-After parsing and a bounded
// retry loop. Pure: no React Native imports, globals limited to Math, Date,
// setTimeout and AbortSignal, relative imports only, so the same file also
// runs in a Deno Edge Function.
//
// RETRY POLICY: only wrap calls that are safe to repeat (GET, or a
// set-to-value PATCH / whole-state upsert). Never wrap a non-idempotent
// write (place_order, cancel_order, sending an OTP email, verifying a
// single-use code) unless it carries an idempotency key.

export const DEFAULT_BACKOFF_BASE_MS = 500;
export const DEFAULT_BACKOFF_CAP_MS = 8000;
export const DEFAULT_RETRY_AFTER_MAX_MS = 60_000;

export type BackoffOptions = {
  baseMs?: number;
  capMs?: number;
  // Returns [0, 1). Injected in tests.
  random?: () => number;
};

// "Full jitter": a uniform delay in [0, min(cap, base * 2^attempt)).
// attempt 0 = the delay before the first retry.
export function computeBackoffDelay(attempt: number, opts: BackoffOptions = {}): number {
  const base = Math.max(0, opts.baseMs ?? DEFAULT_BACKOFF_BASE_MS);
  const cap = Math.max(0, opts.capMs ?? DEFAULT_BACKOFF_CAP_MS);
  const random = opts.random ?? Math.random;
  const a = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0;
  // 2 ** 31 already exceeds any sensible cap; avoids Infinity.
  const ceiling = Math.min(cap, base * 2 ** Math.min(a, 31));
  const r = Math.min(Math.max(random(), 0), 1);
  return Math.floor(r * ceiling);
}

// Retry-After header (RFC 9110): delay-seconds or an HTTP-date. Returns the
// wait in ms clamped to [0, maxMs], or null when missing / unparseable.
export function parseRetryAfter(
  value: string | null | undefined,
  nowMs: number,
  maxMs: number = DEFAULT_RETRY_AFTER_MAX_MS,
): number | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (v === "") return null;
  let ms: number;
  if (/^\d+$/.test(v)) {
    ms = Number(v) * 1000;
  } else if (/[a-z]/i.test(v)) {
    // HTTP-date, e.g. "Wed, 21 Oct 2015 07:28:00 GMT". The letter check
    // keeps Date.parse from reading "-5" as a year.
    const at = Date.parse(v);
    if (!Number.isFinite(at)) return null;
    ms = at - nowMs;
  } else {
    return null;
  }
  if (!Number.isFinite(ms)) return null;
  return Math.min(Math.max(0, ms), Math.max(0, maxMs));
}

export function abortError(): Error {
  const e = new Error("Aborted");
  e.name = "AbortError";
  return e;
}

function isAbortError(e: unknown): boolean {
  return (e as { name?: unknown } | null)?.name === "AbortError";
}

// setTimeout-based sleep that rejects with AbortError when `signal` aborts.
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, Math.max(0, ms));
    signal?.addEventListener("abort", onAbort);
  });
}

export type RetryOptions = BackoffOptions & {
  // Total attempts including the first (1 = no retry).
  maxAttempts: number;
  // Decides per error; AbortError is never retried regardless.
  shouldRetry: (e: unknown, attempt: number) => boolean;
  // Server hint (e.g. Retry-After) in ms; the larger of hint and backoff wins.
  retryAfterMs?: (e: unknown) => number | null;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  signal?: AbortSignal;
};

export async function retryWithBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const max = Math.max(1, Math.floor(opts.maxAttempts));
  const wait = opts.sleep ?? sleep;
  for (let attempt = 0; ; attempt++) {
    if (opts.signal?.aborted) throw abortError();
    try {
      return await fn(attempt);
    } catch (e) {
      if (attempt + 1 >= max || isAbortError(e) || !opts.shouldRetry(e, attempt)) throw e;
      const computed = computeBackoffDelay(attempt, opts);
      const hinted = opts.retryAfterMs?.(e) ?? null;
      await wait(hinted != null ? Math.max(computed, hinted) : computed, opts.signal);
    }
  }
}
