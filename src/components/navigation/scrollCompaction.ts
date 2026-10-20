// Scroll-driven tab bar compaction with hysteresis. Pure worklets (no
// react-native imports): Home's useAnimatedScrollHandler calls them on the UI
// thread, and jest calls them directly.

// Downward travel needed to compact, upward travel needed to expand, and the
// offset near the top where the bar is always expanded.
export const COMPACT_AFTER = 48;
export const EXPAND_AFTER = 20;
export const NEAR_TOP = 24;

export type CompactionState = { compact: boolean; travel: number };

export type CompactionThresholds = {
  compactAfter: number;
  expandAfter: number;
  nearTop: number;
};

// Clamp to the scrollable range so iOS rubber-banding at either end can't
// produce travel that toggles the bar.
export function clampScrollOffset(
  y: number,
  contentHeight: number,
  viewportHeight: number,
): number {
  "worklet";
  const max = Math.max(0, contentHeight - viewportHeight);
  return Math.min(Math.max(y, 0), max);
}

// deltaY > 0 = scrolling down (content moves up).
export function nextCompactionState(
  prev: CompactionState,
  offsetY: number,
  deltaY: number,
  thresholds?: CompactionThresholds,
): CompactionState {
  "worklet";
  // No `= DEFAULT_THRESHOLDS` default parameter: the worklets plugin doesn't
  // capture outer variables used in default parameters, so on the UI thread
  // it threw a ReferenceError inside the scroll handler and iOS aborted the
  // app (crash log: UIEventHandler -> runSyncOnRuntime -> throwPendingError).
  const t = thresholds ?? {
    compactAfter: 48,
    expandAfter: 20,
    nearTop: 24,
  };
  if (offsetY <= t.nearTop) return { compact: false, travel: 0 };
  if (deltaY === 0) return prev;
  // Moving the way that keeps the current state resets the travel, so small
  // back-and-forth finger adjustments never accumulate into a toggle.
  if ((prev.compact && deltaY > 0) || (!prev.compact && deltaY < 0)) {
    return { compact: prev.compact, travel: 0 };
  }
  const travel = prev.travel + deltaY;
  if (!prev.compact && travel >= t.compactAfter) {
    return { compact: true, travel: 0 };
  }
  if (prev.compact && travel <= -t.expandAfter) {
    return { compact: false, travel: 0 };
  }
  return { compact: prev.compact, travel };
}
