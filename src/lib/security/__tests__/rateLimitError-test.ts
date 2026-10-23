/// <reference types="jest" />
import {
  isRateLimitedError,
  isRateLimitPayload,
  RATE_LIMIT_CODE,
  RateLimitedError,
  retryAfterMsFromPayload,
} from "../rateLimitError";

describe("RateLimitedError", () => {
  test("no-arg construction keeps the old shape", () => {
    const e = new RateLimitedError();
    expect(e.name).toBe("RateLimitedError");
    expect(e.message).toBe("Rate limited");
    expect(e.retryAfterMs).toBeNull();
    expect(e.source).toBe("server");
    expect(isRateLimitedError(e)).toBe(true);
  });

  test("carries source and retryAfterMs", () => {
    const e = new RateLimitedError({ source: "client", retryAfterMs: 1234 });
    expect(e.source).toBe("client");
    expect(retryAfterMsFromPayload(e)).toBe(1234);
  });

  test("name check works without instanceof", () => {
    expect(isRateLimitedError({ name: "RateLimitedError" })).toBe(true);
    expect(isRateLimitedError(new Error("x"))).toBe(false);
    expect(isRateLimitedError(null)).toBe(false);
  });
});

describe("isRateLimitPayload", () => {
  const PGRST_JSON =
    '{"code":"T3429","message":"RATE_LIMITED","details":"{\\"action\\":\\"order.place\\",\\"retry_after\\":42}","hint":"Too many requests"}';

  test.each([
    ["HTTP 429 via status arg", {}, 429],
    ["status field 429", { status: 429 }, undefined],
    ["T3429 (PostgREST 12+ parsed body)", { code: RATE_LIMIT_CODE, message: "RATE_LIMITED" }, undefined],
    ["PT429", { code: "PT429", message: "Too Many Requests" }, undefined],
    ["message head", { code: "", message: "RATE_LIMITED: order.place" }, undefined],
    ["PostgREST < 12 fallback", { code: "PGRST", message: PGRST_JSON }, 400],
    ["auth email send", { code: "over_email_send_rate_limit" }, undefined],
    ["auth request", { code: "over_request_rate_limit", status: 400 }, undefined],
    ["RateLimitedError", new RateLimitedError(), undefined],
  ])("%s -> true", (_label, payload, status) => {
    expect(isRateLimitPayload(payload, status)).toBe(true);
  });

  test.each([
    ["business error", { code: "T3010", message: "INVALID_INPUT" }, 400],
    ["server error", { code: "XX000", message: "boom" }, 500],
    ["forbidden", { code: "42501", message: "permission denied" }, 403],
    ["rate word inside other text", { message: "not RATE_LIMITED_HERE" }, undefined],
    ["null", null, undefined],
    ["string", "RATE_LIMITED", undefined],
  ])("%s -> false", (_label, payload, status) => {
    expect(isRateLimitPayload(payload, status)).toBe(false);
  });
});

describe("retryAfterMsFromPayload", () => {
  test("reads retry_after seconds from JSON details", () => {
    expect(retryAfterMsFromPayload({ details: '{"action":"order.place","retry_after":42}' })).toBe(42_000);
  });

  test("accepts an object or numeric string", () => {
    expect(retryAfterMsFromPayload({ details: { retry_after: "3" } })).toBe(3000);
  });

  test("null when absent or malformed", () => {
    expect(retryAfterMsFromPayload({ details: "not json" })).toBeNull();
    expect(retryAfterMsFromPayload({ details: '{"x":1}' })).toBeNull();
    expect(retryAfterMsFromPayload({})).toBeNull();
    expect(retryAfterMsFromPayload(null)).toBeNull();
  });

  test("negative clamps to 0", () => {
    expect(retryAfterMsFromPayload({ details: '{"retry_after":-4}' })).toBe(0);
  });
});
