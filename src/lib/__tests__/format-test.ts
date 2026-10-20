// TypeScript 6 no longer auto-includes @types/*, so pull in jest globals here.
/// <reference types="jest" />
import {
  formatEta,
  formatGhs,
  getFirstName,
  getGreeting,
  getInitials,
} from "../format";

describe("formatGhs", () => {
  test.each([
    [45, "GHS 45.00"],
    [40.5, "GHS 40.50"],
    [0, "GHS 0.00"],
    [1250, "GHS 1,250.00"],
    [1234567.891, "GHS 1,234,567.89"],
  ])("%p -> %p", (amount, expected) => {
    expect(formatGhs(amount)).toBe(expected);
  });
});

describe("formatEta", () => {
  test.each([
    [18, "18 mins"],
    [1, "1 min"],
  ])("%p -> %p", (minutes, expected) => {
    expect(formatEta(minutes)).toBe(expected);
  });
});

describe("getGreeting", () => {
  test.each([
    [4, 59, "Good evening"],
    [5, 0, "Good morning"],
    [11, 59, "Good morning"],
    [12, 0, "Good afternoon"],
    [16, 59, "Good afternoon"],
    [17, 0, "Good evening"],
    [23, 30, "Good evening"],
  ])("%p:%p -> %p", (hours, minutes, expected) => {
    expect(getGreeting(new Date(2025, 0, 15, hours, minutes))).toBe(expected);
  });
});

describe("getInitials", () => {
  test.each([
    ["James", "J"],
    ["james mensah", "JM"],
    ["James Mensah", "JM"],
    ["  ", ""],
  ])("%p -> %p", (name, expected) => {
    expect(getInitials(name)).toBe(expected);
  });
});

describe("getFirstName", () => {
  test.each([
    ["Ama Mensah", "Ama"],
    ["  Ama   Serwaa Mensah ", "Ama"],
    ["Kwame", "Kwame"],
    ["   ", ""],
    ["", ""],
  ])("%p -> %p", (name, expected) => {
    expect(getFirstName(name)).toBe(expected);
  });
});
