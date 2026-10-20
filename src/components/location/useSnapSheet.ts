// Two-snap draggable sheet (collapsed / expanded) on gesture-handler Pan +
// reanimated. Drives translateY of a sheet whose layout top is 0.
//
// Worklet rules (a throwing UI-thread worklet aborts the app on iOS): no
// default params, only captured shared values / primitives / literals, no
// helper calls, JS work only via scheduleOnRN.
import { useCallback, useMemo } from "react";
import { Gesture } from "react-native-gesture-handler";
import { useSharedValue, withSpring } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

// No bounce: overshootClamping.
const SPRING = { damping: 32, stiffness: 320, mass: 1, overshootClamping: true } as const;

type Options = {
  expandedY: number;
  collapsedY: number;
  reducedMotion: boolean;
  // Called on the JS thread when a drag settles.
  onSnap: (expanded: boolean) => void;
};

export function useSnapSheet({ expandedY, collapsedY, reducedMotion, onSnap }: Options) {
  const translateY = useSharedValue(collapsedY);
  const startY = useSharedValue(collapsedY);

  // Pan factory; `enabled` lets the body drag only while collapsed.
  const makePan = useCallback(
    (enabled: boolean) => {
      const top = expandedY;
      const bottom = collapsedY;
      const reduce = reducedMotion;
      const damping = SPRING.damping;
      const stiffness = SPRING.stiffness;
      return Gesture.Pan()
        .enabled(enabled)
        // Vertical drags only; taps on rows / inputs still go through.
        .activeOffsetY([-8, 8])
        .failOffsetX([-20, 20])
        .onStart(() => {
          startY.set(translateY.get());
        })
        .onUpdate((e) => {
          const next = startY.get() + e.translationY;
          translateY.set(Math.min(bottom, Math.max(top, next)));
        })
        .onEnd((e) => {
          // Project the flick ~0.15 s ahead, then pick the nearer snap.
          const projected = translateY.get() + e.velocityY * 0.15;
          const expand = projected < (top + bottom) / 2;
          const target = expand ? top : bottom;
          if (reduce) {
            translateY.set(target);
          } else {
            translateY.set(
              withSpring(target, {
                damping: damping,
                stiffness: stiffness,
                mass: 1,
                overshootClamping: true,
              }),
            );
          }
          scheduleOnRN(onSnap, expand);
        });
    },
    [expandedY, collapsedY, reducedMotion, onSnap, startY, translateY],
  );

  const headerPan = useMemo(() => makePan(true), [makePan]);

  // JS-thread snap (search focus, row selection).
  const snapTo = useCallback(
    (expanded: boolean) => {
      const target = expanded ? expandedY : collapsedY;
      translateY.set(reducedMotion ? target : withSpring(target, SPRING));
    },
    [expandedY, collapsedY, reducedMotion, translateY],
  );

  return { translateY, headerPan, makePan, snapTo };
}
