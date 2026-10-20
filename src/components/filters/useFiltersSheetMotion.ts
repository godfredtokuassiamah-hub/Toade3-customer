// Enter/exit/drag motion for the P12 Filters bottom sheet. No springs and
// no overshoot anywhere (device feedback).
//
// - Enter starts on the sheet's first layout: glass on, white scrim fades
//   in, the sheet slides up (280 ms, ease-out cubic). onOpened runs when
//   the slide settles (focus the title).
// - close() is idempotent: glass off, scrim out, sheet slides down (210 ms,
//   ease-in cubic) from wherever the drag left it, then onClosed
//   (router.back()).
// - Drag the grabber/header down: past the threshold or a flick closes,
//   otherwise it eases back (200 ms, ease-out, no bounce).
// - Reduce Motion: no slide; the content (and plain fills) fade (150 ms).
//
// Crash rule: sheetStyle is a transform only and goes on the wrapper that
// holds the static glass surface; opacity (contentStyle) only ever goes on
// plain views, never on a GlassView/BlurView or one of its ancestors.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWindowDimensions, type ViewStyle } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { FILTERS_SHEET } from "./filtersSheet";

export type FiltersSheetMotion = ReturnType<typeof useFiltersSheetMotion>;

export function useFiltersSheetMotion({
  onOpened,
  onClosed,
}: {
  onOpened?: () => void;
  onClosed: () => void;
}) {
  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  const progress = useSharedValue(0);
  const scrim = useSharedValue(0);
  const drag = useSharedValue(0);
  const [glassOn, setGlassOn] = useState(false);
  // 0 = waiting for the first layout, 1 = opening/open, 2 = closing. A
  // shared value rather than a ref: close() is captured by the pan gesture,
  // and the React Compiler forbids refs reachable from render-time calls.
  const phase = useSharedValue(0);

  // Latest onOpened without restarting the enter animation when it changes.
  const onOpenedRef = useRef(onOpened);
  useEffect(() => {
    onOpenedRef.current = onOpened;
  });
  const notifyOpened = useCallback(() => onOpenedRef.current?.(), []);

  const onSheetLayout = useCallback(() => {
    if (phase.get() !== 0) return;
    phase.set(1);
    setGlassOn(true);
    const done = (finished?: boolean) => {
      "worklet";
      if (finished) scheduleOnRN(notifyOpened);
    };
    if (reducedMotion) {
      scrim.set(withTiming(1, { duration: FILTERS_SHEET.reducedMs }));
      progress.set(withTiming(1, { duration: FILTERS_SHEET.reducedMs }, done));
    } else {
      scrim.set(withTiming(1, { duration: FILTERS_SHEET.scrimInMs }));
      progress.set(
        withTiming(
          1,
          { duration: FILTERS_SHEET.enterMs, easing: Easing.out(Easing.cubic) },
          done,
        ),
      );
    }
  }, [phase, reducedMotion, scrim, progress, notifyOpened]);

  // onClosed must be stable (the caller passes a useCallback with no deps).
  const close = useCallback(() => {
    // Also stops a close before the first layout from starting the enter.
    if (phase.get() === 2) return;
    phase.set(2);
    setGlassOn(false);
    scrim.set(
      withTiming(0, {
        duration: reducedMotion ? FILTERS_SHEET.reducedMs : FILTERS_SHEET.scrimOutMs,
      }),
    );
    progress.set(
      withTiming(
        0,
        {
          duration: reducedMotion ? FILTERS_SHEET.reducedMs : FILTERS_SHEET.exitMs,
          easing: Easing.in(Easing.cubic),
        },
        () => {
          "worklet";
          // Always leave, even if the timing was interrupted.
          scheduleOnRN(onClosed);
        },
      ),
    );
  }, [phase, reducedMotion, scrim, progress, onClosed]);

  const pan = useMemo(() => {
    // Worklet rule: local primitive copies only (no module constants or
    // helper calls inside the gesture callbacks).
    const dragClose = FILTERS_SHEET.dragClose;
    const flickClose = FILTERS_SHEET.flickClose;
    const backMs = reducedMotion ? FILTERS_SHEET.reducedMs : FILTERS_SHEET.returnMs;
    const easeOut = Easing.out(Easing.cubic);
    return (
      Gesture.Pan()
        // Only a downward drag activates; taps on the X still work and the
        // inner ScrollView / price slider keep their own gestures.
        .activeOffsetY(8)
        .onUpdate((e) => {
          // .set() keeps the React Compiler lint happy inside useMemo.
          drag.set(Math.max(0, e.translationY));
        })
        .onEnd((e) => {
          // Same rule as shouldDismissSheet (filtersSheet.ts), inlined.
          const dismiss =
            e.translationY > dragClose || (e.velocityY > flickClose && e.translationY > 0);
          if (dismiss) {
            // The exit continues from the dragged position.
            scheduleOnRN(close);
          } else {
            // Eases back without overshoot (no spring).
            drag.set(withTiming(0, { duration: backMs, easing: easeOut }));
          }
        })
    );
  }, [drag, close, reducedMotion]);

  // Transform only: this goes on the wrapper of the static glass surface.
  const sheetStyle = useAnimatedStyle(
    (): ViewStyle => ({
      transform: [
        { translateY: (reducedMotion ? 0 : (1 - progress.value) * height) + drag.value },
      ],
    }),
  );

  // Opacity for plain views only (content + fills), Reduce Motion only.
  const contentStyle = useAnimatedStyle(
    (): ViewStyle => ({ opacity: reducedMotion ? progress.value : 1 }),
  );

  return {
    onSheetLayout,
    close,
    pan,
    sheetStyle,
    contentStyle,
    scrim,
    glassOn,
    reducedMotion,
  };
}
