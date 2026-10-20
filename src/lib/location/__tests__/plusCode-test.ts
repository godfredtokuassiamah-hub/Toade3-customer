import { encode, shortenCode, shortPlusCode } from "../plusCode";

// Vectors from the official test_data/encoding.csv in
// github.com/google/open-location-code.
const VECTORS: [number, number, 10 | 11, string][] = [
  [20.3700625, 2.7821875, 10, "7FG49QCJ+2V"],
  [20.3701125, 2.782234375, 11, "7FG49QCJ+2VX"],
  [47.0000625, 8.0000625, 10, "8FVC2222+22"],
  [-41.2730625, 174.7859375, 10, "4VCPPQGP+Q9"],
  [-89.9999375, -179.9999375, 10, "22222222+22"],
  [1, 1, 11, "6FH32222+222"],
  [90, 1, 10, "CFX3X2X2+X2"],
  [47.0000625, 728.0000625, 10, "8FVC2222+22"],
  [-41.2730625, 1254.7859375, 10, "4VCPPQGP+Q9"],
  [47.0000625, -711.9999375, 10, "8FVC2222+22"],
  [-41.2730625, -905.2140625, 10, "4VCPPQGP+Q9"],
  [1.2, 3.4, 10, "6FH56C22+22"],
  [35.6, 3.033, 10, "8F75J22M+26"],
  [66.89, -106, 10, "95RPV2R2+22"],
  [2.5, -64.23, 11, "67JQGQ2C+222"],
];

describe("plus code encode", () => {
  it.each(VECTORS)("encodes %p,%p (%p) as %p", (lat, lng, len, expected) => {
    expect(encode(lat, lng, len)).toBe(expected);
  });

  it("defaults to 10 digits", () => {
    expect(encode(20.3700625, 2.7821875)).toBe("7FG49QCJ+2V");
  });

  it("rejects non-finite input", () => {
    expect(() => encode(Number.NaN, 0)).toThrow(RangeError);
  });
});

describe("short plus code", () => {
  it("drops the 4-character area prefix", () => {
    expect(shortenCode("7FG49QCJ+2VX")).toBe("9QCJ+2VX");
  });

  it("uses the 11-digit local form", () => {
    expect(shortPlusCode(20.3701125, 2.782234375)).toBe("9QCJ+2VX");
    // Accra: 4-char area prefix + "XXXX+XXX".
    expect(shortPlusCode(5.6037, -0.187)).toMatch(/^[2-9CFGHJMPQRVWX]{4}\+[2-9CFGHJMPQRVWX]{3}$/);
  });
});
