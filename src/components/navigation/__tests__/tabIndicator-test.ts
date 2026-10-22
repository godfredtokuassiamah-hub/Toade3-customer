// TypeScript 6 no longer auto-includes @types/*, so pull in jest globals here.
/// <reference types="jest" />
import {
  getTabBarWidth,
  getTabCellWidth,
  TAB_BAR_PADDING,
  TAB_COUNT,
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

// Expected fallback frame, derived from the shared metrics (5 tabs).
const expectedFrame = (windowWidth: number, index: number) => {
  const cell = getTabCellWidth(windowWidth);
  return {
    x: TAB_BAR_PADDING + index * cell + TAB_PILL_INSET_X,
    width: cell - TAB_PILL_INSET_X * 2,
  };
};

const CELL_402 = getTabCellWidth(402);
const cases = [402, 360].flatMap((w) =>
  Array.from({ length: TAB_COUNT }, (_, i) => [w, i] as const),
);

describe("getIndicatorFrame", () => {
  test.each(cases)("fallback at %ppt, index %p", (w, index) => {
    const frame = getIndicatorFrame([], index, opts(w));
    const expected = expectedFrame(w, index);
    expect(frame.x).toBeCloseTo(expected.x, 6);
    expect(frame.width).toBeCloseTo(expected.width, 6);
  });

  test.each([402, 360])("the last pill ends one inset + padding from the bar edge at %ppt", (w) => {
    const last = getIndicatorFrame([], TAB_COUNT - 1, opts(w));
    expect(last.x + last.width + TAB_PILL_INSET_X + TAB_BAR_PADDING).toBeCloseTo(
      getTabBarWidth(w),
      6,
    );
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
    const layouts = [{ x: 0, width: 70 }, undefined];
    expect(getIndicatorFrame(layouts, 1, opts(402))).toEqual(expectedFrame(402, 1));
  });

  test("out-of-range index falls back without throwing", () => {
    expect(getIndicatorFrame([{ x: 0, width: 80 }], 7, opts(402)).width).toBe(
      CELL_402 - TAB_PILL_INSET_X * 2,
    );
    expect(getIndicatorFrame([], -1, opts(402)).x).toBe(TAB_BAR_PADDING + TAB_PILL_INSET_X);
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
