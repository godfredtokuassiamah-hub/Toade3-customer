// TypeScript 6 no longer auto-includes @types/*, so pull in jest globals here
// rather than adding a `types` array to tsconfig.
/// <reference types="jest" />
import {
  computeOtpBoxSize,
  formatCountdown,
  getResendRemainingSeconds,
  parseSentAt,
  sanitizeOtp,
} from "../otp";

describe("sanitizeOtp", () => {
  test.each([
    ["12a3", 4, "123"],
    ["1 2-3 4", 4, "1234"],
    ["12 34", 4, "1234"],
    ["1-2-3-4", 4, "1234"],
    ["12-34", 4, "1234"],
    ["123456", 4, "1234"], // pasted 6-digit code
    ["Your code: 9876", 4, "9876"],
    ["123456", 6, "123456"],
    ["", 4, ""],
    ["abc", 4, ""],
  ])("%p (length %p) -> %p", (input, length, expected) => {
    expect(sanitizeOtp(input, length)).toBe(expected);
  });
});

describe("getResendRemainingSeconds", () => {
  const sentAt = 1_700_000_000_000;
  test.each([
    [0, 60],
    [1, 60],
    [1000, 59],
    [55_000, 5],
    [59_001, 1],
    [60_000, 0],
    [999_999, 0],
  ])("+%pms -> %p", (elapsed, expected) => {
    expect(getResendRemainingSeconds(sentAt, sentAt + elapsed)).toBe(expected);
  });

  test("future sentAt is clamped to the full cooldown", () => {
    expect(getResendRemainingSeconds(sentAt + 120_000, sentAt)).toBe(60);
  });

  test("custom cooldown", () => {
    expect(getResendRemainingSeconds(sentAt, sentAt + 1000, 30_000)).toBe(29);
  });
});

describe("formatCountdown", () => {
  test.each([
    [59, "0:59"],
    [5, "0:05"],
    [60, "1:00"],
    [0, "0:00"],
  ])("%p -> %p", (seconds, expected) => {
    expect(formatCountdown(seconds)).toBe(expected);
  });
});

describe("parseSentAt", () => {
  const now = 1_700_000_000_000;
  test.each<[string | string[] | undefined, number]>([
    [String(now - 5000), now - 5000],
    [undefined, now],
    ["", now],
    ["abc", now],
    ["-1", now],
    [[String(now - 1000), "1"], now - 1000],
    [String(now + 10_000), now], // future
  ])("%p -> %p", (raw, expected) => {
    expect(parseSentAt(raw, now)).toBe(expected);
  });
});

describe("computeOtpBoxSize", () => {
  test("fits the mock at 4 digits", () => {
    expect(computeOtpBoxSize(374, 4)).toEqual({
      width: 56,
      height: 68,
      gap: 12,
      fontSize: 24,
    });
  });

  test("360dp screen, 4 digits keeps full size", () => {
    expect(computeOtpBoxSize(332, 4).width).toBe(56);
  });

  test("shrinks for 6 digits on 360dp", () => {
    expect(computeOtpBoxSize(332, 6).width).toBe(45);
  });

  test("8 digits uses a smaller gap", () => {
    const s = computeOtpBoxSize(332, 8);
    expect(s.gap).toBe(8);
    expect(s.width).toBeLessThanOrEqual(35);
  });

  test.each([
    [374, 4],
    [332, 4],
    [332, 6],
    [332, 8],
    [280, 8],
  ])("row fits in %p for length %p", (available, length) => {
    const s = computeOtpBoxSize(available, length);
    expect(s.width * length + s.gap * (length - 1)).toBeLessThanOrEqual(available);
  });
});
