/// <reference types="jest" />
import { BAR_H, getStorefrontLayout, HERO_H, SHEET_OVERLAP, TAB_H } from "../metrics";

describe("getStorefrontLayout", () => {
  test("iPhone 13 inset (47)", () => {
    const l = getStorefrontLayout(47);
    expect(l.barTotal).toBe(47 + BAR_H);
    expect(l.pinnedH).toBe(47 + BAR_H + TAB_H);
    expect(l.sheetTop).toBe(HERO_H - SHEET_OVERLAP);
    // Compact bar is fully in once the sheet top reaches the bar's bottom.
    expect(l.collapseEnd).toBe(HERO_H - SHEET_OVERLAP - 47 - BAR_H);
    expect(l.collapseStart).toBe(l.collapseEnd - 48);
  });

  test("thresholds never go negative for a huge inset", () => {
    const l = getStorefrontLayout(400);
    expect(l.collapseEnd).toBeGreaterThanOrEqual(1);
    expect(l.collapseStart).toBeGreaterThanOrEqual(0);
  });
});
