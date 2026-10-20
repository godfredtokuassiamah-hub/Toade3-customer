// TypeScript 6 no longer auto-includes @types/*, so pull in jest globals here.
/// <reference types="jest" />
import type { TabBarSurfaceMode } from "../../navigation/tabBarSurface";
import {
  FILTERS_SHEET,
  FILTERS_SURFACE,
  getSheetMaxHeight,
  resolveSheetBackdrop,
  resolveSheetSurface,
  shouldDismissSheet,
} from "../filtersSheet";

function alpha(rgba: string): number {
  const match = /^rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([\d.]+)\s*\)$/.exec(rgba);
  if (!match) throw new Error(`not a white rgba() colour: ${rgba}`);
  return Number(match[1]);
}

const MODES: TabBarSurfaceMode[] = ["glass", "blur", "frosted", "opaque"];

describe("getSheetMaxHeight", () => {
  test("iPhone 13: 90% of the window wins", () => {
    expect(getSheetMaxHeight(844, 47)).toBe(760);
  });

  test("short screen: the top inset wins", () => {
    expect(getSheetMaxHeight(600, 60)).toBe(532);
  });

  test("never negative", () => {
    expect(getSheetMaxHeight(0, 47)).toBe(0);
  });
});

describe("shouldDismissSheet", () => {
  test("drag past the threshold closes", () => {
    expect(shouldDismissSheet(121, 0)).toBe(true);
  });

  test("drag under the threshold springs back", () => {
    expect(shouldDismissSheet(119, 0)).toBe(false);
  });

  test("downward flick closes", () => {
    expect(shouldDismissSheet(10, 900)).toBe(true);
  });

  test("flick without any downward travel stays", () => {
    expect(shouldDismissSheet(0, 900)).toBe(false);
  });

  test("thresholds match the shared sheet", () => {
    expect(FILTERS_SHEET.dragClose).toBe(120);
    expect(FILTERS_SHEET.flickClose).toBe(800);
    expect(FILTERS_SHEET.radius).toBe(24);
  });
});

describe("resolveSheetSurface", () => {
  test.each([
    ["glass", "glass"],
    ["blur", "blur"],
    ["frosted", "none"],
    ["opaque", "none"],
  ] as const)("%s -> %s material", (mode, material) => {
    expect(resolveSheetSurface(mode).material).toBe(material);
  });

  test("glass sheet tint is a low white tint", () => {
    const a = alpha(FILTERS_SURFACE.glassTint);
    expect(a).toBeGreaterThanOrEqual(0.2);
    expect(a).toBeLessThanOrEqual(0.35);
  });

  test("Android sheet fill is translucent white 0.85-0.9", () => {
    const fill = resolveSheetSurface("frosted").fill;
    expect(fill).not.toBeNull();
    const a = alpha(fill as string);
    expect(a).toBeGreaterThanOrEqual(0.85);
    expect(a).toBeLessThanOrEqual(0.9);
  });

  test("Reduce Transparency: solid white, no edges", () => {
    expect(resolveSheetSurface("opaque")).toEqual({ material: "none", fill: "#FFFFFF", edges: false });
  });

  test("translucent modes keep the highlight + outline edge", () => {
    for (const mode of ["glass", "blur", "frosted"] as const) {
      expect(resolveSheetSurface(mode).edges).toBe(true);
    }
  });
});

describe("motion tokens", () => {
  test("open 260-300 ms, close 200-220 ms, no spring tokens", () => {
    expect(FILTERS_SHEET.enterMs).toBeGreaterThanOrEqual(260);
    expect(FILTERS_SHEET.enterMs).toBeLessThanOrEqual(300);
    expect(FILTERS_SHEET.exitMs).toBeGreaterThanOrEqual(200);
    expect(FILTERS_SHEET.exitMs).toBeLessThanOrEqual(220);
    expect(Object.keys(FILTERS_SHEET).some((k) => /spring/i.test(k))).toBe(false);
  });
});

describe("resolveSheetBackdrop", () => {
  test.each([
    ["glass", "glass"],
    ["blur", "blur"],
    ["frosted", "none"],
    ["opaque", "none"],
  ] as const)("%s -> %s material", (mode, material) => {
    expect(resolveSheetBackdrop(mode).material).toBe(material);
  });

  test("every scrim is a white wash", () => {
    for (const mode of MODES) {
      expect(() => alpha(resolveSheetBackdrop(mode).scrimColor)).not.toThrow();
    }
  });

  test("Reduce Transparency is near-opaque white", () => {
    expect(alpha(resolveSheetBackdrop("opaque").scrimColor)).toBeGreaterThanOrEqual(0.9);
  });

  test("translucent backdrops stay light so the screen behind shows", () => {
    for (const mode of ["glass", "blur", "frosted"] as const) {
      const a = alpha(resolveSheetBackdrop(mode).scrimColor);
      expect(a).toBeGreaterThanOrEqual(0.15);
      expect(a).toBeLessThanOrEqual(0.25);
    }
  });

  test("BlurView only in the blur mode", () => {
    for (const mode of MODES) {
      if (mode !== "blur") expect(resolveSheetBackdrop(mode).material).not.toBe("blur");
    }
  });
});
