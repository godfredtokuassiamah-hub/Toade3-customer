// Which material the floating tab bar uses on this device, plus every tuning
// token for it. No native imports so jest can load it.
export type TabBarSurfaceMode = "glass" | "blur" | "solid" | "opaque";

// - opaque: Reduce Transparency is on (wins over everything).
// - glass: iOS with native Liquid Glass (iOS 26+ and the API present).
// - blur: older iOS, BlurView under a 72% white overlay.
// - solid: Android/web; no BlurView (Android blur would need a BlurTargetView
//   around every tab scene and re-blur a scrolling list each frame).
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
  return "solid";
}

// Tune against bright banners and dark food photos on device.
export const TAB_BAR_SURFACE = {
  // Neutral, never orange: the material should take colour from the feed.
  glassTint: "rgba(255,255,255,0.12)",
  blurIntensity: 40,
  blurOverlay: "rgba(255,255,255,0.72)",
  solidFill: "rgba(255,255,255,0.92)",
  opaqueFill: "#FFFFFF",
  highlight: "rgba(255,255,255,0.9)",
  solidBorder: "rgba(17,17,17,0.06)",
  opaqueBorder: "rgba(17,17,17,0.08)",
  shadow: { color: "#000000", opacity: 0.1, radius: 16, offsetY: 6 },
  androidElevation: 6,
} as const;
