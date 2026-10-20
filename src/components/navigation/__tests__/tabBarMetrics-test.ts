// TypeScript 6 no longer auto-includes @types/*, so pull in jest globals here.
/// <reference types="jest" />
import {
  getTabBarBottom,
  getTabBarClearance,
  getTabBarHeights,
  getTabBarWidth,
  getTabCellWidth,
  getTabLabelLineHeight,
  TAB_BAR_PADDING,
  TAB_ICON_LABEL_GAP,
  TAB_ICON_SIZE,
} from "../tabBarMetrics";

describe("getTabBarWidth", () => {
  test.each([
    [402, 362],
    [360, 320],
    [500, 380],
  ])("window %p -> %p", (windowWidth, expected) => {
    expect(getTabBarWidth(windowWidth)).toBe(expected);
  });
});

describe("getTabCellWidth", () => {
  test.each([
    [402, 87.5],
    [360, 77],
  ])("window %p -> %p (>= 48)", (windowWidth, expected) => {
    const cell = getTabCellWidth(windowWidth);
    expect(cell).toBe(expected);
    expect(cell).toBeGreaterThanOrEqual(48);
  });
});

describe("getTabBarHeights", () => {
  test.each([
    [1.0, 68, 60],
    [1.3, 73, 65],
    [2.0, 74, 66],
  ])("fontScale %p -> %p / %p", (fontScale, expanded, compact) => {
    expect(getTabBarHeights(fontScale)).toEqual({ expanded, compact });
  });

  test.each([1.0, 1.3, 2.0])(
    "compact cell fits icon + gap + label at fontScale %p",
    (fontScale) => {
      const { compact } = getTabBarHeights(fontScale);
      const content =
        TAB_ICON_SIZE + TAB_ICON_LABEL_GAP + getTabLabelLineHeight(fontScale);
      expect(compact - TAB_BAR_PADDING * 2).toBeGreaterThanOrEqual(content);
      expect(compact - TAB_BAR_PADDING * 2).toBeGreaterThanOrEqual(48);
    },
  );
});

describe("getTabBarBottom", () => {
  test("inset + 12", () => {
    expect(getTabBarBottom(34)).toBe(46);
    expect(getTabBarBottom(0)).toBe(12);
  });
});

describe("getTabBarClearance", () => {
  test.each([
    [34, 1.0, 130],
    [24, 1.0, 120],
  ])("inset %p, fontScale %p -> %p", (inset, fontScale, expected) => {
    expect(getTabBarClearance(inset, fontScale)).toBe(expected);
  });
});
