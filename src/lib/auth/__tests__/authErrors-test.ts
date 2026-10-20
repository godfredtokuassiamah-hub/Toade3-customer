/// <reference types="jest" />
import { classifyAuthError } from "../authErrors";

describe("classifyAuthError", () => {
  test.each([
    [{ name: "AuthApiError", status: 403, code: "otp_expired" }, "invalid_code"],
    [{ name: "AuthApiError", status: 403 }, "invalid_code"],
    [{ name: "AuthApiError", status: 429, code: "over_email_send_rate_limit" }, "rate_limited"],
    [{ name: "AuthApiError", status: 400, code: "over_request_rate_limit" }, "rate_limited"],
    [{ status: 429 }, "rate_limited"],
    [{ name: "AuthRetryableFetchError", status: 0 }, "network"],
    [new TypeError("Network request failed"), "network"],
    [{ name: "AuthApiError", status: 400, code: "validation_failed" }, "unknown"],
    [{ name: "AuthApiError", status: 403, code: "signup_disabled" }, "unknown"],
    [new Error("boom"), "unknown"],
    [null, "unknown"],
    [undefined, "unknown"],
    ["otp_expired", "unknown"],
  ])("%p -> %s", (input, expected) => {
    expect(classifyAuthError(input)).toBe(expected);
  });
});
