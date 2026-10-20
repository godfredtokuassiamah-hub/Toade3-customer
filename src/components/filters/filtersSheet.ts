// Pure model for the P12 Filters bottom sheet, its white-glass backdrop and
// its translucent glass surface: sizing, dismiss thresholds, motion tokens
// and which layers each surface mode gets. No native imports so jest can
// load it.
import type { TabBarSurfaceMode } from "../navigation/tabBarSurface";

export const FILTERS_SHEET = {
  // Matches the app's other RADIUS 24 sheets.
  radius: 24,
  maxHeightRatio: 0.9,
  // Minimum gap kept between the sheet top and the status bar.
  topGap: 8,
  // Drag the grabber/header further than this (pt) or flick faster than
  // flickClose (pt/s) to close; same thresholds as BottomSheet.
  dragClose: 120,
  flickClose: 800,
  // No springs anywhere (device feedback: no bounce). Open eases out,
  // close eases in, a cancelled drag eases back.
  enterMs: 280,
  exitMs: 210,
  returnMs: 200,
  scrimInMs: 260,
  scrimOutMs: 210,
  // Reduce Motion: no slide, only a short fade.
  reducedMs: 150,
  // GlassView's native style transition (seconds, per expo-glass-effect).
  glassFadeSeconds: 0.26,
  reducedGlassFadeSeconds: 0.15,
} as const;

// Light so the screen behind stays clearly visible (device feedback); only
// Reduce Transparency goes near-opaque. Tuned by reasoning; adjust after
// the device check without touching the layer structure.
export const FILTERS_BACKDROP = {
  // Thin "clear" Liquid Glass with a faint white tint.
  glassTint: "rgba(255,255,255,0.10)",
  blurTint: "systemUltraThinMaterialLight",
  blurIntensity: 20,
  glassScrim: "rgba(255,255,255,0.18)",
  blurScrim: "rgba(255,255,255,0.20)",
  // Android has no blur here, so a light wash only.
  frostedScrim: "rgba(255,255,255,0.25)",
  opaqueScrim: "rgba(255,255,255,0.96)",
} as const;

// The sheet's own material. Text is #111 on these surfaces; the white
// fills/tints keep labels legible (AA) over typical Home content.
export const FILTERS_SURFACE = {
  glassTint: "rgba(255,255,255,0.32)",
  blurTint: "systemThinMaterialLight",
  blurIntensity: 60,
  blurFill: "rgba(255,255,255,0.55)",
  frostedFill: "rgba(255,255,255,0.88)",
  opaqueFill: "#FFFFFF",
  // Same edge treatment as the tab bar so the sheet edge reads.
  highlight: "rgba(255,255,255,0.95)",
  outline: "rgba(17,17,17,0.10)",
} as const;

export type SheetMaterial = "glass" | "blur" | "none";

export type SheetBackdrop = {
  // Static native material under the scrim (never animated).
  material: SheetMaterial;
  // Plain white wash above the material; only its opacity animates.
  scrimColor: string;
};

export type SheetSurface = {
  // Static native material behind the sheet content (never animated).
  material: SheetMaterial;
  // Plain fill above the material (or the whole surface without one).
  fill: string | null;
  // Hairline top highlight + outline (translucent modes only).
  edges: boolean;
};

// Fits the content, capped at 90% of the window and never under the status
// bar.
export function getSheetMaxHeight(windowHeight: number, topInset: number): number {
  return Math.max(
    0,
    Math.round(
      Math.min(
        windowHeight * FILTERS_SHEET.maxHeightRatio,
        windowHeight - topInset - FILTERS_SHEET.topGap,
      ),
    ),
  );
}

export function shouldDismissSheet(translationY: number, velocityY: number): boolean {
  "worklet";
  return (
    translationY > FILTERS_SHEET.dragClose ||
    (velocityY > FILTERS_SHEET.flickClose && translationY > 0)
  );
}

// - glass (iOS 26+): thin Liquid Glass + faint white wash.
// - blur (older iOS): ultra-thin light BlurView + faint white wash.
// - frosted (Android/web): light white scrim only (Android blur needs a
//   BlurTargetView around the screen behind, which lives in another route).
// - opaque (Reduce Transparency): near-opaque white.
export function resolveSheetBackdrop(mode: TabBarSurfaceMode): SheetBackdrop {
  switch (mode) {
    case "glass":
      return { material: "glass", scrimColor: FILTERS_BACKDROP.glassScrim };
    case "blur":
      return { material: "blur", scrimColor: FILTERS_BACKDROP.blurScrim };
    case "frosted":
      return { material: "none", scrimColor: FILTERS_BACKDROP.frostedScrim };
    case "opaque":
      return { material: "none", scrimColor: FILTERS_BACKDROP.opaqueScrim };
  }
}

// - glass: GlassView (regular, light, low white tint), no extra fill.
// - blur: BlurView thin light + light white fill.
// - frosted: white fill ~0.88.
// - opaque: solid white, no edges.
export function resolveSheetSurface(mode: TabBarSurfaceMode): SheetSurface {
  switch (mode) {
    case "glass":
      return { material: "glass", fill: null, edges: true };
    case "blur":
      return { material: "blur", fill: FILTERS_SURFACE.blurFill, edges: true };
    case "frosted":
      return { material: "none", fill: FILTERS_SURFACE.frostedFill, edges: true };
    case "opaque":
      return { material: "none", fill: FILTERS_SURFACE.opaqueFill, edges: false };
  }
}
