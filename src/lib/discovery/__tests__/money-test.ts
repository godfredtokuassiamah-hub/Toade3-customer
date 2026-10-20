/// <reference types="jest" />
import {
  formatMinor,
  formatMinorFixed,
  formatOpenMax,
  minorToText,
  parseGhsToMinor,
  PRICE_FORMAT_ERROR,
  priceSummary,
} from "../money";

describe("parseGhsToMinor (string parsing, integer pesewas)", () => {
  test.each([
    ["45", 4500],
    ["45.5", 4550],
    ["45.50", 4550],
    ["0.1", 10],
    ["0.07", 7],
    ["50.00", 5000],
    [" 12 ", 1200],
    ["12,5", 1250],
    ["1000000", 100000000],
  ])("%s -> %d", (input, expected) => {
    expect(parseGhsToMinor(input)).toEqual({ ok: true, value: expected });
  });

  test("blank is unbounded (null)", () => {
    expect(parseGhsToMinor("")).toEqual({ ok: true, value: null });
    expect(parseGhsToMinor("   ")).toEqual({ ok: true, value: null });
  });

  test.each(["45.555", "-1", "abc", "1e3", "45.", ".5", "4 5", "12.3.4", "GHS 50"])(
    "%s -> error",
    (input) => {
      expect(parseGhsToMinor(input)).toEqual({ ok: false, error: PRICE_FORMAT_ERROR });
    },
  );

  test("no float artefacts", () => {
    // 0.29 * 100 = 28.999999999999996 in floating point.
    expect(parseGhsToMinor("0.29")).toEqual({ ok: true, value: 29 });
    expect(parseGhsToMinor("1.15")).toEqual({ ok: true, value: 115 });
  });
});

describe("formatting", () => {
  test("formatMinor / fixed / open max / text", () => {
    expect(formatMinor(4500)).toBe("GHS 45");
    expect(formatMinor(4550)).toBe("GHS 45.50");
    expect(formatMinor(120000)).toBe("GHS 1,200");
    expect(formatMinorFixed(4500)).toBe("GHS 45.00");
    expect(formatMinorFixed(7)).toBe("GHS 0.07");
    expect(formatOpenMax(12000)).toBe("GHS 120+");
    expect(minorToText(4550)).toBe("45.50");
    expect(minorToText(5000)).toBe("50");
  });

  test("priceSummary", () => {
    expect(priceSummary(null, null)).toBe("Any price");
    expect(priceSummary(null, 5000)).toBe("Up to GHS 50");
    expect(priceSummary(1000, null)).toBe("From GHS 10");
    expect(priceSummary(1000, 5000)).toBe("GHS 10 – GHS 50");
  });
});
