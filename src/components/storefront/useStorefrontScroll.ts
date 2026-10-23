// Scroll engine for the storefront: ONE Animated.ScrollView whose offset
// drives everything on the UI thread (hero parallax, compact bar fade, tab
// strip pinning, active tab), animating transform/opacity only.
//
// Worklet rules (a throwing UI-thread worklet aborts the app on iOS): no
// default params; worklets read only shared values and LOCAL primitives
// copied in this hook body; primitive shared values only, except the
// read-only section-tops array that is replaced (never mutated) from JS on
// layout. JS is reached only via scheduleOnRN, and only when the active
// section / collapsed flag actually CHANGES (never per frame).
import { useCallback, useEffect, useRef, useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import type Animated from "react-native-reanimated";
import {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { selectionHaptic } from "../../lib/haptics";
import {
  activeSectionIndex,
  isLockReached,
  scrollTargetForSection,
} from "../../lib/storefront/activeSection";
import { getStorefrontLayout, HERO_H, LOCK_FALLBACK_MS } from "./metrics";

type Options = {
  // Ordered section ids currently rendered (changes when search filters).
  sectionIds: readonly string[];
  insetTop: number;
  reducedMotion: boolean;
};

export function useStorefrontScroll({ sectionIds, insetTop, reducedMotion }: Options) {
  const layout = getStorefrontLayout(insetTop);
  // Local primitives captured by the worklets below.
  const barTotal = layout.barTotal;
  const pinnedH = layout.pinnedH;
  const collapseStart = layout.collapseStart;
  const collapseEnd = layout.collapseEnd;
  const heroH = HERO_H;
  const parallaxEnd = -HERO_H / 2;

  const scrollRef = useRef<Animated.ScrollView>(null);
  const scrollY = useSharedValue(0);
  const stripY = useSharedValue(0);
  const sectionTops = useSharedValue<number[]>([]);
  const activeShared = useSharedValue(0);
  // -1 = no programmatic scroll in flight.
  const lockTarget = useSharedValue(-1);
  // 1 while searching: compact bar forced opaque.
  const forceCompact = useSharedValue(0);

  const [activeIndex, setActiveIndex] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [stripReady, setStripReady] = useState(false);
  const [viewportH, setViewportH] = useState(0);

  // JS-side layout bookkeeping (never read on the UI thread).
  const topsById = useRef(new Map<string, number>());
  const stripYRef = useRef(0);
  const contentH = useRef(0);
  const viewportRef = useRef(0);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Section set changed (search): restart from the first tab. Adjusting
  // state during render (no effect) keeps the React Compiler lint happy.
  const sectionsKey = sectionIds.join("|");
  const [prevKey, setPrevKey] = useState(sectionsKey);
  if (prevKey !== sectionsKey) {
    setPrevKey(sectionsKey);
    setActiveIndex(0);
  }

  const idsRef = useRef(sectionIds);
  useEffect(() => {
    idsRef.current = sectionIds;
    activeShared.set(0);
    sectionTops.set(sectionIds.map((id) => topsById.current.get(id) ?? Infinity));
  }, [sectionsKey, sectionIds, activeShared, sectionTops]);

  useEffect(
    () => () => {
      if (lockTimer.current) clearTimeout(lockTimer.current);
    },
    [],
  );

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      const y = e.contentOffset.y;
      scrollY.set(y);
      const lock = lockTarget.get();
      if (lock >= 0) {
        // A tab press is scrolling: keep its tab active until it lands.
        if (isLockReached(y, lock)) lockTarget.set(-1);
        return;
      }
      const idx = activeSectionIndex(sectionTops.get(), y + pinnedH + 1);
      if (idx !== activeShared.get()) {
        activeShared.set(idx);
        scheduleOnRN(setActiveIndex, idx);
      }
    },
    onBeginDrag: () => {
      // The user took over; live tracking resumes immediately.
      lockTarget.set(-1);
    },
  });

  useAnimatedReaction(
    () => scrollY.get() >= collapseEnd - 1,
    (now, prev) => {
      if (now !== prev) scheduleOnRN(setCollapsed, now);
    },
  );

  const heroStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    // Reduced motion: the hero moves 1:1 with the content (no parallax).
    const translateY = reducedMotion
      ? Math.max(-y, -heroH)
      : interpolate(y, [0, heroH], [0, parallaxEnd], Extrapolation.CLAMP);
    return { transform: [{ translateY }] };
  });

  const barBgStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    const fromScroll = reducedMotion
      ? y >= collapseEnd
        ? 1
        : 0
      : interpolate(y, [collapseStart, collapseEnd], [0, 1], Extrapolation.CLAMP);
    return { opacity: Math.max(fromScroll, forceCompact.get()) };
  });

  const titleStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    if (reducedMotion) {
      return { opacity: y >= collapseEnd ? 1 : 0, transform: [{ translateY: 0 }] };
    }
    const p = interpolate(y, [collapseStart, collapseEnd], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ translateY: (1 - p) * 8 }] };
  });

  const circleStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    const p = reducedMotion
      ? y >= collapseEnd
        ? 1
        : 0
      : interpolate(y, [collapseStart, collapseEnd], [0, 1], Extrapolation.CLAMP);
    return { opacity: 1 - Math.max(p, forceCompact.get()) };
  });

  const stripStyle = useAnimatedStyle(() => {
    const top = stripY.get();
    return {
      opacity: top > 0 ? 1 : 0,
      transform: [{ translateY: Math.max(barTotal, top - scrollY.get()) }],
    };
  });

  const onStripLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const y = e.nativeEvent.layout.y;
      stripYRef.current = y;
      stripY.set(y);
      setStripReady(y > 0);
    },
    [stripY],
  );

  const onSectionLayout = useCallback(
    (id: string) => (e: LayoutChangeEvent) => {
      topsById.current.set(id, e.nativeEvent.layout.y);
      sectionTops.set(idsRef.current.map((sid) => topsById.current.get(sid) ?? Infinity));
    },
    [sectionTops],
  );

  const onContentSizeChange = useCallback((_w: number, h: number) => {
    contentH.current = h;
  }, []);

  const onViewportLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    viewportRef.current = h;
    setViewportH(h);
  }, []);

  const maxScroll = () => Math.max(0, contentH.current - viewportRef.current);

  const lockAndScroll = (target: number) => {
    lockTarget.set(target);
    scrollRef.current?.scrollTo({ y: target, animated: !reducedMotion });
    if (lockTimer.current) clearTimeout(lockTimer.current);
    // Fallback release (e.g. already at the target, so no scroll event).
    lockTimer.current = setTimeout(() => lockTarget.set(-1), LOCK_FALLBACK_MS);
  };

  const scrollToSection = (index: number) => {
    const id = sectionIds[index];
    const top = id != null ? topsById.current.get(id) : undefined;
    if (top == null || !Number.isFinite(top)) return;
    selectionHaptic();
    activeShared.set(index);
    setActiveIndex(index);
    lockAndScroll(scrollTargetForSection(top, pinnedH, maxScroll()));
  };

  // Puts the tab strip right under the compact bar (search mode).
  const scrollToPinned = () => {
    if (stripYRef.current <= 0) return;
    const target = Math.min(Math.max(stripYRef.current - barTotal, 0), maxScroll());
    scrollRef.current?.scrollTo({ y: target, animated: !reducedMotion });
  };

  const setForceCompact = (on: boolean) => forceCompact.set(on ? 1 : 0);

  return {
    layout,
    scrollRef,
    onScroll,
    activeIndex: Math.min(activeIndex, Math.max(0, sectionIds.length - 1)),
    collapsed,
    stripReady,
    viewportH,
    heroStyle,
    barBgStyle,
    titleStyle,
    circleStyle,
    stripStyle,
    onStripLayout,
    onSectionLayout,
    onContentSizeChange,
    onViewportLayout,
    scrollToSection,
    scrollToPinned,
    setForceCompact,
  };
}
