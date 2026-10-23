// Sticky category tabs: which section is in view, and where a tab press
// scrolls to. Pure worklets (no react-native imports): the storefront's
// useAnimatedScrollHandler calls them on the UI thread, jest calls them
// directly. Worklet rules (see scrollCompaction.ts): NO default parameters,
// no outer variables — a throwing UI-thread worklet aborts the app on iOS.

// Index of the last section whose top (content y) is at or above probeY.
// 0 when probeY is above every top or nothing is measured yet. Non-finite
// (unmeasured) tops are ignored.
export function activeSectionIndex(tops: readonly number[], probeY: number): number {
  "worklet";
  let active = 0;
  for (let i = 0; i < tops.length; i++) {
    const top = tops[i];
    if (Number.isFinite(top) && top <= probeY) active = i;
  }
  return active;
}

// Scroll offset that puts a section's top just under the pinned header +
// tab strip, clamped to the scrollable range.
export function scrollTargetForSection(
  top: number,
  pinnedHeight: number,
  maxScroll: number,
): number {
  "worklet";
  return Math.min(Math.max(top - pinnedHeight, 0), Math.max(0, maxScroll));
}

// A programmatic tab-press scroll has (practically) arrived.
export function isLockReached(y: number, target: number): boolean {
  "worklet";
  return Math.abs(y - target) < 2;
}
