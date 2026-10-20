// TypeScript 6 no longer auto-includes @types/*, so pull in jest globals here.
/// <reference types="jest" />
import { resolveTabBarSurface, TAB_BAR_SURFACE } from "../tabBarSurface";

function alpha(rgba: string): number {
  const match = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)$/.exec(rgba);
  if (!match) throw new Error(`not an rgba() colour: ${rgba}`);
  return Number(match[1]);
}

describe("resolveTabBarSurface", () => {
  test.each([
    ["ios", true, true, "opaque"],
    ["ios", true, false, "glass"],
    ["ios", false, false, "blur"],
    ["ios", false, true, "opaque"],
    ["android", false, false, "frosted"],
    ["android", true, false, "frosted"],
    ["web", false, false, "frosted"],
    ["android", false, true, "opaque"],
  ])(
    "os %p, liquidGlass %p, reduceTransparency %p -> %p",
    (os, liquidGlass, reduceTransparency, expected) => {
      expect(
        resolveTabBarSurface({ os, liquidGlass, reduceTransparency }),
      ).toBe(expected);
    },
  );
});

describe("TAB_BAR_SURFACE tokens", () => {
  test.each([
    "glassTint",
    "outline",
    "highlight",
    "blurOverlay",
    "frostedFill",
    "glassPillBorder",
  ] as const)("%s is translucent", (key) => {
    const a = alpha(TAB_BAR_SURFACE[key]);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(1);
  });

  // Guard against the white-out regression: a heavy white tint made the
  // Liquid Glass read as a flat white capsule.
  test("glass tint stays light", () => {
    expect(alpha(TAB_BAR_SURFACE.glassTint)).toBeLessThanOrEqual(0.2);
  });

  test("blur overlay lets the blur show through", () => {
    expect(alpha(TAB_BAR_SURFACE.blurOverlay)).toBeLessThanOrEqual(0.5);
  });

  test("sheen stops match their locations and fade out", () => {
    expect(TAB_BAR_SURFACE.sheen).toHaveLength(
      TAB_BAR_SURFACE.sheenLocations.length,
    );
    expect(alpha(TAB_BAR_SURFACE.sheen[TAB_BAR_SURFACE.sheen.length - 1])).toBe(0);
    expect(
      alpha(TAB_BAR_SURFACE.glassSheen[TAB_BAR_SURFACE.glassSheen.length - 1]),
    ).toBe(0);
  });
});
