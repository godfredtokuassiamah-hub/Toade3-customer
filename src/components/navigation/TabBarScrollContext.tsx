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

import type { CompactionState } from "./scrollCompaction";

// Expand/compact timing, reused by Home's scroll handler.
export const COMPACTION_TIMING = {
  duration: 200,
  easing: Easing.out(Easing.cubic),
};

export type TabBarScrollValue = {
  // 0 = expanded, 1 = compact.
  progress: SharedValue<number>;
  compaction: SharedValue<CompactionState>;
  // Callable from JS and from worklets.
  expand: () => void;
};

const TabBarScrollContext = createContext<TabBarScrollValue | null>(null);

export function TabBarScrollProvider({ children }: { children: ReactNode }) {
  const progress = useSharedValue(0);
  const compaction = useSharedValue<CompactionState>({
    compact: false,
    travel: 0,
  });

  const expand = useCallback(() => {
    "worklet";
    compaction.set({ compact: false, travel: 0 });
    progress.set(withTiming(0, COMPACTION_TIMING));
  }, [compaction, progress]);

  const value = useMemo(
    () => ({ progress, compaction, expand }),
    [progress, compaction, expand],
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
