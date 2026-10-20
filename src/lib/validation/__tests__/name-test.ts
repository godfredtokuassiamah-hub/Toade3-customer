/// <reference types="jest" />
import { isValidFullName, normalizeFullName } from "../name";

describe("normalizeFullName", () => {
  test("trims and collapses whitespace", () => {
    expect(normalizeFullName("  Ama   Serwaa\tMensah ")).toBe(
      "Ama Serwaa Mensah",
    );
  });
});

describe("isValidFullName", () => {
  test.each([
    "Ama Mensah",
    "Kwame O'Neil-Boateng",
    "Kwame O\u2019Neil",
    "\u0186kyeame", // Ɔkyeame
    "Ama Ab\u025Bna", // Abɛna
    "J. R.",
    "Zo\u00EB Ad\u00E9b\u00E1y\u1ECD\u0300", // Zoë Adébáyọ̀
    "  Ama Mensah  ",
    "Al",
    "a".repeat(80),
  ])("valid: %p", (name) => {
    expect(isValidFullName(name)).toBe(true);
  });

  test.each([
    "",
    "   ",
    " a ",
    "J.",
    "1234",
    "Ama 2",
    "-Ama",
    "a".repeat(81),
    "Ama \u{1F600}",
    "Ama@Mensah",
  ])("invalid: %p", (name) => {
    expect(isValidFullName(name)).toBe(false);
  });
});
