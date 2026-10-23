/// <reference types="jest" />
import {
  computeBackoffDelay,
  parseRetryAfter,
  retryWithBackoff,
  sleep,
} from "../backoff";

describe("computeBackoffDelay (full jitter)", () => {
  test("random 0 -> 0 ms", () => {
    expect(computeBackoffDelay(3, { random: () => 0 })).toBe(0);
  });

  test("random ~1 -> just under min(cap, base * 2^attempt)", () => {
    const r = () => 0.999;
    expect(computeBackoffDelay(0, { baseMs: 500, capMs: 8000, random: r })).toBe(499);
    expect(computeBackoffDelay(1, { baseMs: 500, capMs: 8000, random: r })).toBe(999);
    expect(computeBackoffDelay(2, { baseMs: 500, capMs: 8000, random: r })).toBe(1998);
  });

  test("never exceeds the cap, even for huge attempts", () => {
    for (const attempt of [5, 10, 100, 10_000]) {
      const d = computeBackoffDelay(attempt, { baseMs: 1000, capMs: 8000, random: () => 0.999 });
      expect(d).toBeLessThan(8000);
      expect(d).toBeGreaterThanOrEqual(7990);
    }
  });

  test("stays inside [0, ceiling) for real randomness", () => {
    for (let i = 0; i < 200; i++) {
      const d = computeBackoffDelay(2, { baseMs: 100, capMs: 1000 });
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(400);
    }
  });

  test("negative / NaN attempts behave like attempt 0", () => {
    expect(computeBackoffDelay(-3, { baseMs: 500, random: () => 0.5 })).toBe(250);
    expect(computeBackoffDelay(Number.NaN, { baseMs: 500, random: () => 0.5 })).toBe(250);
  });
});

describe("parseRetryAfter", () => {
  const now = Date.parse("2026-01-01T00:00:00Z");

  test("delta-seconds", () => {
    expect(parseRetryAfter("3", now)).toBe(3000);
    expect(parseRetryAfter(" 0 ", now)).toBe(0);
  });

  test("HTTP-date", () => {
    expect(parseRetryAfter("Thu, 01 Jan 2026 00:00:05 GMT", now)).toBe(5000);
  });

  test("a past date clamps to 0", () => {
    expect(parseRetryAfter("Wed, 31 Dec 2025 23:59:00 GMT", now)).toBe(0);
  });

  test("clamps to maxMs", () => {
    expect(parseRetryAfter("3600", now)).toBe(60_000);
    expect(parseRetryAfter("3600", now, 10_000)).toBe(10_000);
  });

  test("invalid / missing / negative -> null", () => {
    expect(parseRetryAfter(undefined, now)).toBeNull();
    expect(parseRetryAfter(null, now)).toBeNull();
    expect(parseRetryAfter("", now)).toBeNull();
    expect(parseRetryAfter("soon", now)).toBeNull();
    expect(parseRetryAfter("-5", now)).toBeNull();
    expect(parseRetryAfter("1.5", now)).toBeNull();
  });
});

describe("retryWithBackoff", () => {
  const noSleep = jest.fn((_ms: number) => Promise.resolve());
  beforeEach(() => noSleep.mockClear());

  test("returns the first success without sleeping", async () => {
    const fn = jest.fn(() => Promise.resolve("ok"));
    await expect(retryWithBackoff(fn, { maxAttempts: 3, shouldRetry: () => true, sleep: noSleep })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(noSleep).not.toHaveBeenCalled();
  });

  test("retries until success", async () => {
    const fn = jest
      .fn<Promise<string>, [number]>()
      .mockRejectedValueOnce(new Error("a"))
      .mockResolvedValueOnce("ok");
    await expect(
      retryWithBackoff(fn, { maxAttempts: 3, shouldRetry: () => true, sleep: noSleep, random: () => 0 }),
    ).resolves.toBe("ok");
    expect(fn.mock.calls.map((c) => c[0])).toEqual([0, 1]);
  });

  test("stops at maxAttempts and rethrows the last error", async () => {
    const fn = jest.fn((attempt: number) => Promise.reject(new Error(`fail ${attempt}`)));
    await expect(
      retryWithBackoff(fn, { maxAttempts: 3, shouldRetry: () => true, sleep: noSleep }),
    ).rejects.toThrow("fail 2");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(noSleep).toHaveBeenCalledTimes(2);
  });

  test("no retry when shouldRetry is false", async () => {
    const fn = jest.fn(() => Promise.reject(new Error("400")));
    await expect(
      retryWithBackoff(fn, { maxAttempts: 5, shouldRetry: () => false, sleep: noSleep }),
    ).rejects.toThrow("400");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("Retry-After wins when larger than the computed delay", async () => {
    const fn = jest.fn<Promise<string>, [number]>().mockRejectedValueOnce(new Error("429")).mockResolvedValueOnce("ok");
    await retryWithBackoff(fn, {
      maxAttempts: 2,
      shouldRetry: () => true,
      retryAfterMs: () => 4000,
      sleep: noSleep,
      random: () => 0.5,
    });
    expect(noSleep).toHaveBeenCalledWith(4000, undefined);
  });

  test("computed delay wins when larger than Retry-After", async () => {
    const fn = jest.fn<Promise<string>, [number]>().mockRejectedValueOnce(new Error("429")).mockResolvedValueOnce("ok");
    await retryWithBackoff(fn, {
      maxAttempts: 2,
      shouldRetry: () => true,
      retryAfterMs: () => 10,
      sleep: noSleep,
      baseMs: 1000,
      random: () => 0.5,
    });
    expect(noSleep).toHaveBeenCalledWith(500, undefined);
  });

  test("AbortError is never retried", async () => {
    const abort = Object.assign(new Error("Aborted"), { name: "AbortError" });
    const fn = jest.fn(() => Promise.reject(abort));
    await expect(
      retryWithBackoff(fn, { maxAttempts: 3, shouldRetry: () => true, sleep: noSleep }),
    ).rejects.toBe(abort);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("an already-aborted signal stops before the first call", async () => {
    const c = new AbortController();
    c.abort();
    const fn = jest.fn(() => Promise.resolve("x"));
    await expect(
      retryWithBackoff(fn, { maxAttempts: 3, shouldRetry: () => true, signal: c.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fn).not.toHaveBeenCalled();
  });

  test("aborting during the backoff sleep stops the loop", async () => {
    const c = new AbortController();
    const fn = jest.fn(() => Promise.reject(new Error("503")));
    const p = retryWithBackoff(fn, {
      maxAttempts: 3,
      shouldRetry: () => true,
      signal: c.signal,
      baseMs: 60_000,
      random: () => 0.5,
    });
    await Promise.resolve();
    c.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("sleep", () => {
  test("resolves after the delay", async () => {
    jest.useFakeTimers();
    try {
      const done = jest.fn();
      const p = sleep(1000).then(done);
      jest.advanceTimersByTime(999);
      await Promise.resolve();
      expect(done).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      await p;
      expect(done).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
