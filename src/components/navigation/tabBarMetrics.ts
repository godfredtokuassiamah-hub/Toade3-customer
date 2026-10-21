// Floating tab bar geometry, shared by the bar and by screens that pad their
// scroll content so the last row clears the overlaying capsule. Pure (no
// react-native imports) so it is unit-tested directly.
export const TAB_BAR_SIDE_INSET = 20;
export const TAB_BAR_MAX_WIDTH = 380;
export const TAB_BAR_EXPANDED_MIN = 68;
// Compact = expanded - 8 (68 -> 60 at default text size).
export const TAB_BAR_COMPACT_DELTA = 8;
// Inner padding on every side; the selection pill sits inside it.
export const TAB_BAR_PADDING = 6;
export const TAB_BAR_BOTTOM_GAP = 12;
// The sliding pill is this much narrower than its cell on each side.
export const TAB_PILL_INSET_X = 4;
export const TAB_ICON_SIZE = 24;
export const TAB_ICON_LABEL_GAP = 2;
export const TAB_LABEL_SIZE = 11;
export const TAB_LABEL_LINE = 14;
// Tab labels stop scaling at 1.3x: with 5 tabs the 360dp cell is 61.6pt;
// "Account" (Manrope semibold 11pt, ~44pt at 1.0x) is ~57pt at 1.3x, which
// fits, while 1.4x (~62pt) would touch the edges. The label also shrinks
// to fit as a last resort. iOS users above that get the Large Content
// Viewer instead.
export const TAB_LABEL_MAX_SCALE = 1.3;
// Breathing room between the last feed row and the expanded bar.
export const FEED_END_SPACING = 16;
export const TAB_COUNT = 5;

// Screen width minus 20 per side, capped: 362 at 402pt, 320 at 360dp.
export function getTabBarWidth(windowWidth: number): number {
  return Math.min(TAB_BAR_MAX_WIDTH, windowWidth - TAB_BAR_SIDE_INSET * 2);
}

// One tab's touch cell (5 tabs): 70 at 402pt, 61.6 at 360dp (both >= 48).
export function getTabCellWidth(windowWidth: number): number {
  return (getTabBarWidth(windowWidth) - TAB_BAR_PADDING * 2) / TAB_COUNT;
}

// Label line box under the 1.3x cap: 14 / 19 / 19 at fontScale 1.0 / 1.3 / 2.0.
export function getTabLabelLineHeight(fontScale: number): number {
  return Math.ceil(TAB_LABEL_LINE * Math.min(fontScale, TAB_LABEL_MAX_SCALE));
}

// Bar heights: icon + gap + label, plus padding and 16 of air, never below
// 68. fs 1.0 -> 68/60, 1.3 and 2.0 -> 73/65. Compact cells (bar - 12) are
// 48/53, always >= the 40/45 content, so labels never clip.
export function getTabBarHeights(fontScale: number): {
  expanded: number;
  compact: number;
} {
  const content =
    TAB_ICON_SIZE + TAB_ICON_LABEL_GAP + getTabLabelLineHeight(fontScale);
  const expanded = Math.max(
    TAB_BAR_EXPANDED_MIN,
    content + TAB_BAR_PADDING * 2 + 16,
  );
  return { expanded, compact: expanded - TAB_BAR_COMPACT_DELTA };
}

// Distance from the capsule's bottom edge to the screen bottom: inset + 12.
export function getTabBarBottom(insetBottom: number): number {
  return insetBottom + TAB_BAR_BOTTOM_GAP;
}

// Bottom padding for scroll content, sized for the EXPANDED bar so compaction
// never moves the feed: 68 + 46 + 16 = 130 (iPhone, inset 34); 68 + 36 + 16
// = 120 (Android, inset 24).
export function getTabBarClearance(
  insetBottom: number,
  fontScale: number,
): number {
  return (
    getTabBarHeights(fontScale).expanded +
    getTabBarBottom(insetBottom) +
    FEED_END_SPACING
  );
}
