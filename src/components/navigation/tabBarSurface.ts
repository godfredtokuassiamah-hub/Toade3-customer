// Which material the floating tab bar uses on this device, plus every tuning
// token for it. No native imports so jest can load it.
export type TabBarSurfaceMode = "glass" | "blur" | "frosted" | "opaque";

// - opaque: Reduce Transparency is on (wins over everything).
// - glass: iOS with native Liquid Glass (iOS 26+ and the API present).
// - blur: older iOS, BlurView under a light white overlay.
// - frosted: Android/web; layered translucent fill + sheen + edges, no
//   BlurView (Android blur needs a BlurTargetView around every tab scene and
//   re-blurs a scrolling image feed every frame).
export function resolveTabBarSurface({
  os,
  liquidGlass,
  reduceTransparency,
}: {
  os: string;
  liquidGlass: boolean;
  reduceTransparency: boolean;
}): TabBarSurfaceMode {
  if (reduceTransparency) return "opaque";
  if (os === "ios" && liquidGlass) return "glass";
  if (os === "ios") return "blur";
  return "frosted";
}

// Tuned by reasoning; confirm against bright banners and dark food photos on
// device.
export const TAB_BAR_SURFACE = {
  // Neutral, never orange, and low alpha: a heavy white tint turned the glass
  // into a flat white capsule on white scenes.
  glassTint: "rgba(255,255,255,0.12)",
  // Hairline all around every translucent mode, so the capsule has an edge
  // even over a pure white scene.
  outline: "rgba(17,17,17,0.10)",
  // 1px light rim along the upper edge.
  highlight: "rgba(255,255,255,0.95)",
  // Vertical top-down sheen (expo-linear-gradient).
  sheen: [
    "rgba(255,255,255,0.55)",
    "rgba(255,255,255,0.08)",
    "rgba(255,255,255,0)",
  ],
  sheenLocations: [0, 0.45, 1],
  // Softer on real glass: the material already has its own specular.
  glassSheen: ["rgba(255,255,255,0.28)", "rgba(255,255,255,0)"],
  blurTint: "systemThinMaterialLight",
  blurIntensity: 60,
  blurOverlay: "rgba(255,255,255,0.45)",
  // Slightly cool off-white so the capsule separates from #FFFFFF scenes.
  frostedFill: "rgba(250,250,252,0.86)",
  // Sliding selection pill on glass gets a white droplet rim.
  glassPillBorder: "rgba(255,255,255,0.7)",
  // CSS boxShadow on every platform: drawn only outside the capsule.
  // (elevation shows through a translucent fill as grey; iOS shadow* props on
  // a transparent view shadow the icons instead of the capsule.)
  shadow: "0px 8px 22px rgba(0,0,0,0.16)",
  opaqueFill: "#FFFFFF",
  opaqueBorder: "rgba(17,17,17,0.10)",
} as const;
