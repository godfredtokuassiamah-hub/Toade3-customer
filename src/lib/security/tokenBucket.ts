// Per-key token bucket with lazy refill and an injected clock. Pure (no
// React Native imports), Deno-portable.
//
// Client-side buckets are UX / load reduction only: a modified client or a
// script ignores them. Server enforcement lives in the `ratelimit` schema
// (supabase/migrations/0009_rate_limits.sql) and Supabase Auth limits.

export type TokenBucket = {
  // Takes `cost` tokens for `key` when available; false (nothing taken) otherwise.
  tryTake(key?: string, cost?: number): boolean;
  // ms until `cost` tokens are available for `key` (0 = now).
  msUntilAvailable(key?: string, cost?: number): number;
  // Forget one key, or every key when omitted.
  reset(key?: string): void;
};

export type TokenBucketOptions = {
  capacity: number;
  // Tokens added per millisecond (e.g. 1 / 12_000 = one token every 12 s).
  refillPerMs: number;
  now?: () => number;
  // Keys tracked before full buckets are pruned (bounds memory).
  maxKeys?: number;
};

const DEFAULT_KEY = "";
// Float tolerance: 12_000 * (1 / 12_000) may land just under 1.
const EPSILON = 1e-9;

type State = { tokens: number; at: number };

export function createTokenBucket(opts: TokenBucketOptions): TokenBucket {
  const { capacity, refillPerMs } = opts;
  if (!(capacity >= 1) || !Number.isFinite(capacity)) throw new Error("capacity must be >= 1");
  if (!(refillPerMs > 0) || !Number.isFinite(refillPerMs)) throw new Error("refillPerMs must be > 0");
  const now = opts.now ?? (() => Date.now());
  const maxKeys = opts.maxKeys ?? 500;
  const state = new Map<string, State>();

  const current = (key: string): State => {
    const t = now();
    const s = state.get(key);
    if (!s) return { tokens: capacity, at: t };
    // A clock that moves backwards never adds tokens.
    const tokens = Math.min(capacity, s.tokens + Math.max(0, t - s.at) * refillPerMs);
    return { tokens, at: Math.max(t, s.at) };
  };

  const prune = () => {
    if (state.size <= maxKeys) return;
    for (const key of [...state.keys()]) {
      if (current(key).tokens >= capacity - EPSILON) state.delete(key);
    }
  };

  return {
    tryTake(key = DEFAULT_KEY, cost = 1) {
      const c = current(key);
      if (c.tokens + EPSILON < cost) {
        state.set(key, c);
        return false;
      }
      state.set(key, { tokens: Math.max(0, c.tokens - cost), at: c.at });
      prune();
      return true;
    },
    msUntilAvailable(key = DEFAULT_KEY, cost = 1) {
      const c = current(key);
      if (c.tokens + EPSILON >= cost) return 0;
      return Math.ceil((cost - c.tokens) / refillPerMs);
    },
    reset(key) {
      if (key === undefined) state.clear();
      else state.delete(key);
    },
  };
}

// One action per `ms` per key (capacity 1, full refill after `ms`).
export function createCooldown(ms: number, now?: () => number): TokenBucket {
  if (!(ms > 0)) throw new Error("cooldown must be > 0 ms");
  return createTokenBucket({ capacity: 1, refillPerMs: 1 / ms, now });
}
