/// <reference types="jest" />
import { getCountryByIso2 } from "../../../data/countries";
import { normalizePhone } from "../phone";

const GH = getCountryByIso2("GH")!;
const NG = getCountryByIso2("NG")!;
const IT = getCountryByIso2("IT")!;
const US = getCountryByIso2("US")!;

describe("normalizePhone", () => {
  test.each([
    ["0201234567"],
    ["201234567"],
    ["020 123 4567"],
    ["020-123-4567"],
    ["(020) 123.4567"],
    ["+233201234567"],
    ["+233 20 123 4567"],
    ["00233201234567"],
  ])("Ghana %p -> +233201234567", (input) => {
    expect(normalizePhone(GH, input)).toEqual({
      ok: true,
      national: "201234567",
      e164: "+233201234567",
    });
  });

  test("Nigeria strips the trunk 0", () => {
    expect(normalizePhone(NG, "08031234567")).toMatchObject({
      ok: true,
      e164: "+2348031234567",
    });
  });

  test("Italy keeps the leading 0", () => {
    expect(normalizePhone(IT, "0612345678")).toMatchObject({
      ok: true,
      e164: "+390612345678",
    });
  });

  test("US 10-digit", () => {
    expect(normalizePhone(US, "(202) 555-0123")).toMatchObject({
      ok: true,
      e164: "+12025550123",
    });
  });

  test.each([
    ["", "empty"],
    ["   ", "empty"],
    ["020abc4567", "invalid_chars"],
    ["phone", "invalid_chars"],
    ["+234201234567", "invalid_chars"], // another country's prefix
    ["12345", "too_short"],
    ["012345", "too_short"], // 0 stripped -> 5 digits
    ["123456789012345", "too_long"],
  ])("Ghana %p -> %s", (input, reason) => {
    expect(normalizePhone(GH, input)).toEqual({ ok: false, reason });
  });

  test("total E.164 length is capped at 15 digits", () => {
    // +233 (3) + 12 = 15 ok; + 13 = 16 too long.
    expect(normalizePhone(GH, "123456789012").ok).toBe(true);
    expect(normalizePhone(GH, "1234567890123")).toEqual({
      ok: false,
      reason: "too_long",
    });
  });
});
