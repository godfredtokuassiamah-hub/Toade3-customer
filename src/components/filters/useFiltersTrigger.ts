// Opens the P12 Filters sheet and, once the opener regains focus after the
// sheet closes, moves screen-reader focus back to the control that opened it.
import { router, useFocusEffect } from "expo-router";
import { type RefObject, useCallback, useRef } from "react";
import { AccessibilityInfo, type View } from "react-native";

import type { DiscoveryScope, DiscoverySurface } from "../../lib/discovery/types";

export type FiltersParams = {
  surface: DiscoverySurface;
  origin?: "p11";
  q?: string;
  scope?: DiscoveryScope;
};

// Lets the opener's screen settle (and the sheet unmount) before focusing.
const RETURN_FOCUS_MS = 350;

export function useFiltersTrigger(): {
  triggerRef: RefObject<View | null>;
  openFilters: (params: FiltersParams) => void;
} {
  const triggerRef = useRef<View | null>(null);
  const pending = useRef(false);

  const openFilters = useCallback((params: FiltersParams) => {
    pending.current = true;
    router.push({ pathname: "/filters", params });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!pending.current) return;
      pending.current = false;
      const t = setTimeout(() => {
        // Null-safe: the opener may have navigated away meanwhile.
        if (triggerRef.current) AccessibilityInfo.sendAccessibilityEvent(triggerRef.current, "focus");
      }, RETURN_FOCUS_MS);
      return () => clearTimeout(t);
    }, []),
  );

  return { triggerRef, openFilters };
}
