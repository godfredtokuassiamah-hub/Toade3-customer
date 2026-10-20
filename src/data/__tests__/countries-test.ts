/// <reference types="jest" />
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  filterCountries,
  flagFromIso2,
  getCountryByIso2,
} from "../countries";

describe("countries", () => {
  test("Ghana is first and the default", () => {
    expect(COUNTRIES[0].iso2).toBe("GH");
    expect(DEFAULT_COUNTRY.iso2).toBe("GH");
    expect(DEFAULT_COUNTRY.dialCode).toBe("+233");
    expect(DEFAULT_COUNTRY.flag).toBe("\u{1F1EC}\u{1F1ED}");
    expect(COUNTRIES[1].iso2).toBe("NG");
  });

  test("iso2 codes are unique and well-formed", () => {
    const codes = COUNTRIES.map((c) => c.iso2);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(c).toMatch(/^[A-Z]{2}$/);
  });

  test("dial codes are E.164 calling codes", () => {
    for (const c of COUNTRIES) expect(c.dialCode).toMatch(/^\+\d{1,4}$/);
  });

  test("flagFromIso2", () => {
    expect(flagFromIso2("ng")).toBe("\u{1F1F3}\u{1F1EC}");
    expect(flagFromIso2("x")).toBe("");
  });

  test("getCountryByIso2", () => {
    expect(getCountryByIso2("gh")?.name).toBe("Ghana");
    expect(getCountryByIso2("ZZ")).toBeUndefined();
  });

  test.each([
    ["", COUNTRIES.length],
    ["gha", 1],
    ["GHANA", 1],
    ["cote", 1],
    ["gb", 1],
  ])("filter %p -> %i result(s)", (q, n) => {
    expect(filterCountries(COUNTRIES, q)).toHaveLength(n);
  });

  test("dial code search with or without +", () => {
    expect(filterCountries(COUNTRIES, "+234").map((c) => c.iso2)).toEqual([
      "NG",
    ]);
    expect(filterCountries(COUNTRIES, "234").map((c) => c.iso2)).toEqual([
      "NG",
    ]);
    expect(filterCountries(COUNTRIES, "+1").map((c) => c.iso2)).toEqual(
      expect.arrayContaining(["US", "CA"]),
    );
  });

  test("no match -> empty", () => {
    expect(filterCountries(COUNTRIES, "atlantis")).toHaveLength(0);
  });
});
