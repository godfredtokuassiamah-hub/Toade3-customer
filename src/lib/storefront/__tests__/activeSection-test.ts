/// <reference types="jest" />
import { activeSectionIndex, isLockReached, scrollTargetForSection } from "../activeSection";

describe("activeSectionIndex", () => {
  const tops = [400, 800, 1200];

  test("above the first top -> 0", () => {
    expect(activeSectionIndex(tops, 100)).toBe(0);
  });
  test("exact boundary selects that section", () => {
    expect(activeSectionIndex(tops, 800)).toBe(1);
  });
  test("between tops -> the earlier section", () => {
    expect(activeSectionIndex(tops, 1199)).toBe(1);
  });
  test("past the last top -> last", () => {
    expect(activeSectionIndex(tops, 5000)).toBe(2);
  });
  test("unmeasured (non-finite) tops are ignored", () => {
    expect(activeSectionIndex([400, Infinity, NaN, 1500], 1600)).toBe(3);
    expect(activeSectionIndex([400, Infinity], 900)).toBe(0);
  });
  test("empty tops -> 0", () => {
    expect(activeSectionIndex([], 500)).toBe(0);
  });
});

describe("scrollTargetForSection", () => {
  test("top minus pinned height", () => {
    expect(scrollTargetForSection(900, 148, 5000)).toBe(752);
  });
  test("clamped to 0", () => {
    expect(scrollTargetForSection(100, 148, 5000)).toBe(0);
  });
  test("clamped to maxScroll", () => {
    expect(scrollTargetForSection(900, 148, 600)).toBe(600);
  });
  test("negative maxScroll -> 0", () => {
    expect(scrollTargetForSection(900, 148, -10)).toBe(0);
  });
});

describe("isLockReached", () => {
  test("within 2pt", () => {
    expect(isLockReached(751, 752)).toBe(true);
    expect(isLockReached(754, 752)).toBe(false);
  });
});
