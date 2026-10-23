/// <reference types="jest" />
import { resetClientLimitsForTests } from "../../lib/security/clientLimits";
import { RateLimitedError } from "../../lib/security/rateLimitError";
import { supabase } from "../../lib/supabase";
import { InvalidCodeError, isRateLimitedError, requestEmailCode, verifyEmailCode } from "../auth";

jest.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithOtp: jest.fn(),
      verifyOtp: jest.fn(),
      getSession: jest.fn(),
    },
  },
}));

const signInWithOtp = supabase.auth.signInWithOtp as unknown as jest.Mock;
const verifyOtp = supabase.auth.verifyOtp as unknown as jest.Mock;

const EMAIL = "user@example.com";

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  resetClientLimitsForTests();
  signInWithOtp.mockReset();
  verifyOtp.mockReset();
  signInWithOtp.mockResolvedValue({ data: {}, error: null });
  verifyOtp.mockResolvedValue({ data: { session: { access_token: "x" } }, error: null });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("requestEmailCode client throttle", () => {
  test("a second send within 60 s is refused without a network call", async () => {
    await requestEmailCode(EMAIL);
    const err = await requestEmailCode(EMAIL).catch((e: unknown) => e);
    expect(isRateLimitedError(err)).toBe(true);
    expect((err as RateLimitedError).source).toBe("client");
    expect((err as RateLimitedError).retryAfterMs).toBe(60_000);
    expect(signInWithOtp).toHaveBeenCalledTimes(1);
  });

  test("allowed again after the cooldown", async () => {
    await requestEmailCode(EMAIL);
    jest.setSystemTime(Date.now() + 60_000);
    await requestEmailCode(EMAIL);
    expect(signInWithOtp).toHaveBeenCalledTimes(2);
  });

  test("other emails are independent", async () => {
    await requestEmailCode(EMAIL);
    await requestEmailCode("other@example.com");
    expect(signInWithOtp).toHaveBeenCalledTimes(2);
  });

  test("a failed (non-429) send does not start the cooldown", async () => {
    const failure = { name: "AuthApiError", status: 500, message: "boom" };
    signInWithOtp.mockResolvedValueOnce({ data: {}, error: failure });
    await expect(requestEmailCode(EMAIL)).rejects.toBe(failure);
    await requestEmailCode(EMAIL);
    expect(signInWithOtp).toHaveBeenCalledTimes(2);
  });

  test("a thrown send does not start the cooldown", async () => {
    signInWithOtp.mockRejectedValueOnce(new TypeError("Network request failed"));
    await expect(requestEmailCode(EMAIL)).rejects.toThrow("Network request failed");
    await requestEmailCode(EMAIL);
    expect(signInWithOtp).toHaveBeenCalledTimes(2);
  });

  test("server 429 -> RateLimitedError (server), cooldown kept, never retried", async () => {
    signInWithOtp.mockResolvedValueOnce({
      data: {},
      error: { name: "AuthApiError", status: 429, code: "over_email_send_rate_limit" },
    });
    const err = await requestEmailCode(EMAIL).catch((e: unknown) => e);
    expect(isRateLimitedError(err)).toBe(true);
    expect((err as RateLimitedError).source).toBe("server");
    expect(signInWithOtp).toHaveBeenCalledTimes(1);
    const again = await requestEmailCode(EMAIL).catch((e: unknown) => e);
    expect((again as RateLimitedError).source).toBe("client");
    expect(signInWithOtp).toHaveBeenCalledTimes(1);
  });

  test("two concurrent sends share one request", async () => {
    await Promise.all([requestEmailCode(EMAIL), requestEmailCode(EMAIL)]);
    expect(signInWithOtp).toHaveBeenCalledTimes(1);
  });
});

describe("verifyEmailCode client throttle", () => {
  test("5 quick tries, then refused without a network call; refills 1 per 12 s", async () => {
    verifyOtp.mockResolvedValue({
      data: { session: null },
      error: { name: "AuthApiError", status: 403, code: "otp_expired" },
    });
    for (let i = 0; i < 5; i++) {
      await expect(verifyEmailCode(EMAIL, `00000${i}`)).rejects.toBeInstanceOf(InvalidCodeError);
    }
    const err = await verifyEmailCode(EMAIL, "000009").catch((e: unknown) => e);
    expect(isRateLimitedError(err)).toBe(true);
    expect((err as RateLimitedError).source).toBe("client");
    expect(verifyOtp).toHaveBeenCalledTimes(5);
    jest.setSystemTime(Date.now() + 12_000);
    await expect(verifyEmailCode(EMAIL, "000010")).rejects.toBeInstanceOf(InvalidCodeError);
    expect(verifyOtp).toHaveBeenCalledTimes(6);
  });

  test("never retried on failure (single-use code)", async () => {
    verifyOtp.mockResolvedValueOnce({
      data: { session: null },
      error: { name: "AuthRetryableFetchError", status: 0, message: "Network request failed" },
    });
    await expect(verifyEmailCode(EMAIL, "123456")).rejects.toMatchObject({ name: "AuthRetryableFetchError" });
    expect(verifyOtp).toHaveBeenCalledTimes(1);
  });

  test("server 429 -> RateLimitedError (server)", async () => {
    verifyOtp.mockResolvedValueOnce({
      data: { session: null },
      error: { name: "AuthApiError", status: 429, code: "over_request_rate_limit" },
    });
    const err = await verifyEmailCode(EMAIL, "123456").catch((e: unknown) => e);
    expect(isRateLimitedError(err)).toBe(true);
    expect((err as RateLimitedError).source).toBe("server");
  });

  test("identical concurrent verifies share one request", async () => {
    await Promise.all([verifyEmailCode(EMAIL, "123456"), verifyEmailCode(EMAIL, "123456")]);
    expect(verifyOtp).toHaveBeenCalledTimes(1);
  });
});
