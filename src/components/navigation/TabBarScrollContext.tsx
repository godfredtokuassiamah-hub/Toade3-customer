// Shared compaction state for the floating tab bar. Home's scroll handler
// writes it on the UI thread; the bar reads it. Shared values only, so
// scrolling never re-renders React.
import { createContext, type ReactNode, useCallback, useContext, useMemo } from "react";
import {
  Easing,
  type SharedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

// Expand/compact timing, reused by Home's scroll handler.
export const COMPACTION_TIMING = {
  duration: 200,
  easing: Easing.out(Easing.cubic),
};

export type TabBarScrollValue = {
  // 0 = expanded, 1 = compact.
  progress: SharedValue<number>;
  // Compaction state as primitive shared values (never an object shared value:
  // a mutable object read-modified-written on the scroll path is the fragile
  // shape we avoid). `compact` is the current state, `travel` the accumulated
  // hysteresis distance.
  compact: SharedValue<boolean>;
  travel: SharedValue<number>;
  // Callable from JS and from worklets.
  expand: () => void;
};

const TabBarScrollContext = createContext<TabBarScrollValue | null>(null);

export function TabBarScrollProvider({ children }: { children: ReactNode }) {
  const progress = useSharedValue(0);
  const compact = useSharedValue(false);
  const travel = useSharedValue(0);

  const expand = useCallback(() => {
    "worklet";
    compact.set(false);
    travel.set(0);
    progress.set(withTiming(0, COMPACTION_TIMING));
  }, [compact, travel, progress]);

  const value = useMemo(
    () => ({ progress, compact, travel, expand }),
    [progress, compact, travel, expand],
  );

  return (
    <TabBarScrollContext.Provider value={value}>
      {children}
    </TabBarScrollContext.Provider>
  );
}

export function useTabBarScroll(): TabBarScrollValue {
  const value = useContext(TabBarScrollContext);
  if (!value) {
    throw new Error(
      "useTabBarScroll must be used inside <TabBarScrollProvider> (src/app/(tabs)/_layout.tsx).",
    );
  }
  return value;
}
