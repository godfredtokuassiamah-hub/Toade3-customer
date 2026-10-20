// TypeScript 6 no longer auto-includes @types/*, so pull in jest globals here.
/// <reference types="jest" />
import { resolveTabBarSurface } from "../tabBarSurface";

describe("resolveTabBarSurface", () => {
  test.each([
    ["ios", true, true, "opaque"],
    ["ios", true, false, "glass"],
    ["ios", false, false, "blur"],
    ["ios", false, true, "opaque"],
    ["android", false, false, "solid"],
    ["android", true, false, "solid"],
    ["web", false, false, "solid"],
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
