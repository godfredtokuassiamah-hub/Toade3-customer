// TypeScript 6 no longer auto-includes @types/*, so pull in jest globals here.
/// <reference types="jest" />
import {
  getTabCellWidth,
  TAB_BAR_PADDING,
  TAB_PILL_INSET_X,
} from "../tabBarMetrics";
import {
  getIndicatorFrame,
  isTabChange,
  layoutsEqual,
  type TabLayout,
} from "../tabIndicator";

const opts = (windowWidth: number) => ({
  padding: TAB_BAR_PADDING,
  fallbackCellWidth: getTabCellWidth(windowWidth),
  insetX: TAB_PILL_INSET_X,
});

describe("getIndicatorFrame", () => {
  test.each([
    [402, 0, 10, 79.5],
    [402, 1, 97.5, 79.5],
    [402, 2, 185, 79.5],
    [402, 3, 272.5, 79.5],
    [360, 0, 10, 69],
    [360, 1, 87, 69],
    [360, 2, 164, 69],
    [360, 3, 241, 69],
  ])("fallback at %ppt, index %p -> x %p, width %p", (w, index, x, width) => {
    expect(getIndicatorFrame([], index, opts(w))).toEqual({ x, width });
  });

  test("measured layouts override the fallback, uneven widths included", () => {
    const layouts: TabLayout[] = [
      { x: 0, width: 70 },
      { x: 70, width: 100 },
      { x: 170, width: 90 },
      { x: 260, width: 90 },
    ];
    expect(getIndicatorFrame(layouts, 1, opts(402))).toEqual({
      x: TAB_BAR_PADDING + 70 + TAB_PILL_INSET_X,
      width: 100 - TAB_PILL_INSET_X * 2,
    });
  });

  test("missing layout for the index falls back", () => {
    const layouts = [{ x: 0, width: 87.5 }, undefined];
    expect(getIndicatorFrame(layouts, 1, opts(402))).toEqual({
      x: 97.5,
      width: 79.5,
    });
  });

  test("out-of-range index falls back without throwing", () => {
    expect(getIndicatorFrame([{ x: 0, width: 80 }], 7, opts(402)).width).toBe(
      79.5,
    );
    expect(getIndicatorFrame([], -1, opts(402)).x).toBe(10);
  });

  test("width is never negative", () => {
    expect(getIndicatorFrame([{ x: 0, width: 2 }], 0, opts(402)).width).toBe(0);
  });
});

describe("isTabChange", () => {
  test("re-tapping the focused tab is not a change", () => {
    expect(isTabChange(1, 1, false)).toBe(false);
  });
  test("a different tab is a change", () => {
    expect(isTabChange(0, 2, false)).toBe(true);
  });
  test("a prevented press is not a change", () => {
    expect(isTabChange(0, 2, true)).toBe(false);
  });
});

describe("layoutsEqual", () => {
  test.each([
    [{ x: 1, width: 2 }, { x: 1, width: 2 }, true],
    [{ x: 1, width: 2 }, { x: 1, width: 3 }, false],
    [{ x: 1, width: 2 }, { x: 0, width: 2 }, false],
    [undefined, { x: 1, width: 2 }, false],
    [{ x: 1, width: 2 }, undefined, false],
    [undefined, undefined, true],
  ])("%p vs %p -> %p", (a, b, expected) => {
    expect(layoutsEqual(a, b)).toBe(expected);
  });
});
