// Remote-or-mock decision for every backend call (BACKEND_MODE in
// ./config.ts). Pure core + an injectable runner (unit-tested); the app's
// runner with the real mode / session lives in ./runner.ts.
//
// Rules:
//   mode 'mock'   -> mock, remote is never called.
//   mode 'remote' -> remote; every error propagates.
//   mode 'auto':
//     BACKEND_MISSING (42P01, 42883, PGRST202, PGRST205, 404)
//        reads  -> mock (dev and production: the backend isn't deployed)
//        writes -> mock in __DEV__ only; production throws (never fake an order)
//        and the resource is latched to mock for the rest of the session.
//     NETWORK -> mock in __DEV__ only; production throws (the query cache
//        keeps serving the last good data).
//     anything else (business T3xxx codes, 401/403, 5xx, unknown) -> throw.
//   Auth-required calls without a Supabase session (no sign-in, or the
//   dev login, which has none) -> mock in __DEV__, NOT_AUTHENTICATED otherwise.
// Every fallback is logged once per resource+reason, in __DEV__ only.
import type { BackendMode } from "./config";
import { BackendError, type BackendErrorCode, mapBackendError } from "./errors";

export type FallbackOp = "read" | "write";
export type FallbackDecision = "mock" | "throw";

export type FallbackContext = { mode: BackendMode; isDev: boolean; op: FallbackOp };

export function decideFallback(code: BackendErrorCode, ctx: FallbackContext): FallbackDecision {
  if (ctx.mode === "mock") return "mock";
  if (ctx.mode === "remote") return "throw";
  if (code === "BACKEND_MISSING") return ctx.op === "read" || ctx.isDev ? "mock" : "throw";
  if (code === "NETWORK") return ctx.isDev ? "mock" : "throw";
  return "throw";
}

export type RunnerDeps = {
  mode: BackendMode;
  isDev: boolean;
  // True when a real Supabase session exists (never for the dev login).
  hasSession: () => Promise<boolean>;
  log: (message: string) => void;
};

export type RunOptions<T> = {
  // Cache / latch / log key, e.g. "stores", "orders.place".
  resource: string;
  op: FallbackOp;
  requiresAuth?: boolean;
  remote: () => Promise<T>;
  mock: () => T | Promise<T>;
};

export type FallbackRunner = {
  run<T>(opts: RunOptions<T>): Promise<T>;
  isLatched(resource: string): boolean;
  reset(): void;
};

export function createFallbackRunner(deps: RunnerDeps): FallbackRunner {
  const latched = new Set<string>();
  const logged = new Set<string>();

  const logOnce = (resource: string, reason: string) => {
    if (!deps.isDev) return;
    const key = `${resource}:${reason}`;
    if (logged.has(key)) return;
    logged.add(key);
    deps.log(`[backend:mock] ${resource} -> local mock data (${reason})`);
  };

  return {
    async run<T>(opts: RunOptions<T>): Promise<T> {
      const { resource, op } = opts;
      if (deps.mode === "mock") {
        logOnce(resource, "BACKEND_MODE=mock");
        return opts.mock();
      }
      if (deps.mode === "auto" && latched.has(resource)) return opts.mock();
      if (opts.requiresAuth && !(await deps.hasSession())) {
        if (deps.mode === "auto" && deps.isDev) {
          logOnce(resource, "no Supabase session");
          return opts.mock();
        }
        throw new BackendError("NOT_AUTHENTICATED", "Sign in required");
      }
      try {
        return await opts.remote();
      } catch (e) {
        const err = mapBackendError(e);
        if (decideFallback(err.code, { mode: deps.mode, isDev: deps.isDev, op }) === "throw") {
          throw err;
        }
        if (err.code === "BACKEND_MISSING") latched.add(resource);
        logOnce(resource, err.rawCode ? `${err.code} ${err.rawCode}` : err.code);
        return opts.mock();
      }
    },
    isLatched: (resource) => latched.has(resource),
    reset: () => {
      latched.clear();
      logged.clear();
    },
  };
}
