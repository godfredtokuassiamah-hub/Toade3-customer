// Storefront layout metrics (single source). Pure, no react-native imports.
export const HERO_H = 280;
// How far the white content sheet overlaps the bottom of the hero.
export const SHEET_OVERLAP = 24;
export const SHEET_RADIUS = 24;
export const LOGO = 68;
// Compact header bar height below the safe-area inset.
export const BAR_H = 52;
// Sticky category tab strip height.
export const TAB_H = 48;
export const SIDE = 16;
export const ROW_IMAGE = 96;
// Menu row vertical padding and the round "+" button (32 + 6 slop each
// side = 44 touch target).
export const ROW_PAD_V = 14;
export const ADD_SIZE = 32;
export const CIRCLE = 40;
// Scroll distance over which the compact bar fades in.
export const COLLAPSE_RANGE = 48;
// JS fallback that releases the tab-press scroll lock.
export const LOCK_FALLBACK_MS = 700;
// "+" shows a check ("Added") for this long.
export const ADDED_MS = 1200;

export type StorefrontLayout = {
  // Safe-area inset + compact bar.
  barTotal: number;
  // barTotal + tab strip: content under this is covered by sticky chrome.
  pinnedH: number;
  // Content y where the white sheet starts.
  sheetTop: number;
  // Scroll offsets where the compact bar starts / finishes fading in.
  collapseStart: number;
  collapseEnd: number;
};

export function getStorefrontLayout(insetTop: number): StorefrontLayout {
  const barTotal = insetTop + BAR_H;
  const sheetTop = HERO_H - SHEET_OVERLAP;
  const collapseEnd = Math.max(1, sheetTop - barTotal);
  const collapseStart = Math.max(0, collapseEnd - COLLAPSE_RANGE);
  return { barTotal, pinnedH: barTotal + TAB_H, sheetTop, collapseStart, collapseEnd };
}
