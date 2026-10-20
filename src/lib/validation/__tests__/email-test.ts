// TypeScript 6 no longer auto-includes @types/*, so pull in jest globals here
// rather than adding a `types` array to tsconfig.
/// <reference types="jest" />
import {
  isValidEmail,
  looksComplete,
  normalizeEmail,
  suggestEmail,
} from "../email";

// 64 + 1 + 63 + 1 + 63 + 1 + 58 + 4 = 255 chars.
const TOO_LONG = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(58)}.com`;

describe("isValidEmail", () => {
  test.each([
    "",
    "   ",
    "a",
    "a@b",
    "a@b.c",
    "a@@b.com",
    "a@b@c.com",
    "a b@c.com",
    ".a@b.com",
    "a.@b.com",
    "a..b@c.com",
    "a@b..com",
    "a@-b.com",
    "a@b-.com",
    "a@.com",
    "@b.com",
    "a@b.com.",
    "a@b.c0m",
    "a@b.123",
    `${"a".repeat(65)}@b.com`,
    TOO_LONG,
  ])("rejects %j", (value) => {
    expect(isValidEmail(value)).toBe(false);
  });

  test.each([
    "kofi.mensah@ug.edu.gh",
    "a+tag@gmail.com",
    "Name@Example.CO",
    "  user@mail.com  ",
    "first_last-1@sub-domain.example.org",
    `${"a".repeat(64)}@b.com`,
  ])("accepts %j", (value) => {
    expect(isValidEmail(value)).toBe(true);
  });

  test("the over-length case really is 255 chars", () => {
    expect(TOO_LONG.length).toBe(255);
  });
});

describe("normalizeEmail", () => {
  test("trims and lowercases", () => {
    expect(normalizeEmail("  Name@Example.CO ")).toBe("name@example.co");
  });
});

describe("looksComplete", () => {
  test.each([
    ["abc", false],
    ["abc@", false],
    ["abc@gm", false],
    ["abc@gma", true],
  ])("%j -> %s", (value, expected) => {
    expect(looksComplete(value)).toBe(expected);
  });
});

describe("suggestEmail", () => {
  test.each([
    ["kofi@gmial.com", "kofi@gmail.com"],
    ["a@yaho.com", "a@yahoo.com"],
    ["a@gmail.co", "a@gmail.com"],
    ["a@hotmial.com", "a@hotmail.com"],
    ["A@GMIAL.COM", "A@gmail.com"],
    ["a@gmail.com", null],
    ["a@ug.edu.gh", null],
    ["gmial.com", null],
  ])("%j -> %j", (value, expected) => {
    expect(suggestEmail(value)).toBe(expected);
  });
});
