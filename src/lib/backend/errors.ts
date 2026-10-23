// Stable backend error codes and the mapping from Supabase / PostgREST /
// fetch errors onto them. Pure (unit-tested): no Supabase import.
//
// The SQL functions (supabase/migrations/0007_order_functions.sql) raise
//   raise exception '<CODE>' using errcode = 'T3xxx', detail = '<json>';
// PostgREST returns that as { code: 'T3xxx', message: '<CODE>', details }
// (HTTP 400). We match the message first, then the SQLSTATE.
//
// Rate limits (supabase/migrations/0009_rate_limits.sql) come back as HTTP
// 429 { code: 'T3429', message: 'RATE_LIMITED', details: '{"retry_after":n}' }
// and map to RATE_LIMITED. It is deliberately NOT a business code: the
// checkout keeps its idempotency key (an earlier attempt may have created
// the order) and queries never retry it (shouldRetry retries NETWORK only).
import { RATE_LIMIT_MESSAGE } from "../auth/authErrors";
import { isRateLimitPayload, RATE_LIMIT_CODE } from "../security/rateLimitError";

export { RATE_LIMIT_CODE };

export type BusinessErrorCode =
  | "NOT_AUTHENTICATED"
  | "ITEM_UNAVAILABLE"
  | "OPTION_INVALID"
  | "REQUIRED_OPTION_MISSING"
  | "MIXED_VENDORS"
  | "OUT_OF_RADIUS"
  | "OVER_WEIGHT"
  | "STALE_VERSION"
  | "NOT_CANCELLABLE"
  | "INVALID_INPUT"
  | "VENDOR_UNAVAILABLE"
  | "ORDER_NOT_FOUND";

export type BackendErrorCode =
  | BusinessErrorCode
  // Table / function not deployed yet (42P01, 42883, PGRST202, PGRST205, 404).
  | "BACKEND_MISSING"
  // Fetch failed / timed out / aborted: the server was never reached.
  | "NETWORK"
  // 401 / 403 / Postgres 42501 (RLS or grant refused).
  | "FORBIDDEN"
  // HTTP 429 / T3429 / PT429 (server rate limit, 0009). Retryable later.
  | "RATE_LIMITED"
  | "UNKNOWN";

// Keep in sync with the SQLSTATE comment block in 0007_order_functions.sql.
export const SQLSTATE_BY_CODE: Readonly<Record<BusinessErrorCode, string>> = {
  NOT_AUTHENTICATED: "T3001",
  ITEM_UNAVAILABLE: "T3002",
  OPTION_INVALID: "T3003",
  REQUIRED_OPTION_MISSING: "T3004",
  MIXED_VENDORS: "T3005",
  OUT_OF_RADIUS: "T3006",
  OVER_WEIGHT: "T3007",
  STALE_VERSION: "T3008",
  NOT_CANCELLABLE: "T3009",
  INVALID_INPUT: "T3010",
  VENDOR_UNAVAILABLE: "T3011",
  ORDER_NOT_FOUND: "T3012",
};

const BUSINESS_CODES = new Set<string>(Object.keys(SQLSTATE_BY_CODE));
const CODE_BY_SQLSTATE = new Map<string, BusinessErrorCode>(
  (Object.entries(SQLSTATE_BY_CODE) as [BusinessErrorCode, string][]).map(([c, s]) => [s, c]),
);

// "Relation / function does not exist" in Postgres and PostgREST's schema cache.
export const MISSING_BACKEND_CODES: readonly string[] = ["42P01", "42883", "PGRST202", "PGRST205"];

const NETWORK_MESSAGE =
  /network request failed|failed to fetch|fetcherror|aborterror|timeouterror|load failed|network error|timed out/i;

export class BackendError extends Error {
  readonly code: BackendErrorCode;
  // HTTP status when known (0 = no response).
  readonly status?: number;
  // Raw Postgres / PostgREST code when known.
  readonly rawCode?: string;
  readonly details?: string;

  constructor(
    code: BackendErrorCode,
    message: string,
    extra?: { status?: number; rawCode?: string; details?: string },
  ) {
    super(message);
    this.name = "BackendError";
    this.code = code;
    this.status = extra?.status;
    this.rawCode = extra?.rawCode;
    this.details = extra?.details;
  }
}

export function isBusinessError(code: BackendErrorCode): code is BusinessErrorCode {
  return BUSINESS_CODES.has(code);
}

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  status?: unknown;
  name?: unknown;
};

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// Maps any thrown / returned error onto a BackendError. `status` is the
// HTTP status from the Supabase response when the caller has it.
export function mapBackendError(e: unknown, status?: number): BackendError {
  if (e instanceof BackendError) return e;
  if (typeof e !== "object" || e == null) {
    return new BackendError("UNKNOWN", typeof e === "string" ? e : "Unknown error", { status });
  }
  const err = e as ErrorLike;
  const rawCode = str(err.code);
  const message = str(err.message);
  const details = str(err.details) || undefined;
  const name = str(err.name);
  const httpStatus = status ?? (typeof err.status === "number" ? err.status : undefined);
  const extra = { status: httpStatus, rawCode: rawCode || undefined, details };

  // 0. Server rate limit (before business codes: T3429 is not one).
  if (isRateLimitPayload(e, httpStatus)) {
    return new BackendError("RATE_LIMITED", message || "RATE_LIMITED", extra);
  }

  // 1. Stable business code in the message (exception text), then SQLSTATE.
  const head = message.trim().split(/[\s:]/)[0] ?? "";
  if (BUSINESS_CODES.has(head)) return new BackendError(head as BusinessErrorCode, message, extra);
  const bySqlstate = CODE_BY_SQLSTATE.get(rawCode);
  if (bySqlstate) return new BackendError(bySqlstate, message, extra);

  // 2. Backend not deployed yet.
  if (MISSING_BACKEND_CODES.includes(rawCode) || httpStatus === 404) {
    return new BackendError("BACKEND_MISSING", message || "Backend not deployed", extra);
  }

  // 3. Never reached the server.
  if (
    httpStatus === 0 ||
    name === "AbortError" ||
    name === "TimeoutError" ||
    name === "FunctionsFetchError" ||
    (rawCode === "" && NETWORK_MESSAGE.test(message)) ||
    (e instanceof TypeError && NETWORK_MESSAGE.test(message))
  ) {
    return new BackendError("NETWORK", message || "Network request failed", extra);
  }

  // 4. Refused by RLS / grants / auth.
  if (rawCode === "42501" || httpStatus === 401 || httpStatus === 403) {
    return new BackendError("FORBIDDEN", message || "Not allowed", extra);
  }

  return new BackendError("UNKNOWN", message || "Unknown error", extra);
}

// Checkout copy for each code (inline under Place order).
export function friendlyOrderMessage(code: BackendErrorCode): string {
  switch (code) {
    case "ITEM_UNAVAILABLE":
      return "Some items are no longer available. Review your cart.";
    case "OUT_OF_RADIUS":
      return "This store doesn't deliver to your address yet.";
    case "OVER_WEIGHT":
      return "Your order is over the 8 kg limit. Remove some items.";
    case "MIXED_VENDORS":
      return "Your cart has items from more than one store.";
    case "OPTION_INVALID":
    case "REQUIRED_OPTION_MISSING":
      return "Some item choices changed. Review your cart.";
    case "VENDOR_UNAVAILABLE":
      return "This store isn't taking orders right now.";
    case "NOT_AUTHENTICATED":
    case "FORBIDDEN":
      return "Please sign in again to place your order.";
    case "NETWORK":
      return "Couldn't reach Toade3. Check your connection and try again.";
    case "RATE_LIMITED":
      return RATE_LIMIT_MESSAGE;
    default:
      return "Something went wrong. Please try again.";
  }
}
