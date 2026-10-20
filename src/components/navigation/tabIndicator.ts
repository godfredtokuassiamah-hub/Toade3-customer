// Pure geometry and decisions for the sliding tab indicator. No react-native
// imports so jest can load it; results are fed into withSpring on the JS side.
export type TabLayout = { x: number; width: number };

// Pill frame in surface coordinates. Uses the measured cell (x relative to
// the row, which sits inside the surface padding) once onLayout has fired,
// otherwise an equal-width estimate so the first frame is already right.
export function getIndicatorFrame(
  layouts: readonly (TabLayout | undefined)[],
  index: number,
  opts: { padding: number; fallbackCellWidth: number; insetX: number },
): { x: number; width: number } {
  const { padding, fallbackCellWidth, insetX } = opts;
  const measured = index >= 0 ? layouts[index] : undefined;
  const cellX = measured ? measured.x : Math.max(0, index) * fallbackCellWidth;
  const cellWidth = measured ? measured.width : fallbackCellWidth;
  return {
    x: padding + cellX + insetX,
    width: Math.max(0, cellWidth - insetX * 2),
  };
}

// A press switches tabs (haptic + navigate) only when it targets another tab
// and no tabPress listener prevented it. Re-taps are handled separately.
export function isTabChange(
  focusedIndex: number,
  pressedIndex: number,
  defaultPrevented: boolean,
): boolean {
  return focusedIndex !== pressedIndex && !defaultPrevented;
}

// Skips redundant setState from repeated onLayout events.
export function layoutsEqual(a?: TabLayout, b?: TabLayout): boolean {
  if (!a || !b) return a === b;
  return a.x === b.x && a.width === b.width;
}
