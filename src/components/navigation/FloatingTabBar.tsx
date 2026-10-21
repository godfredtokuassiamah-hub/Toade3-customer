// Floating Liquid Glass capsule tab bar. Custom rather than
// expo-router/unstable-native-tabs: native tabs can't draw the sliding
// selection pill, our size/Manrope labels, and render a Material bar on
// Android.
//
// The capsule overlays the scene (absolute), so screens pad their content
// with getTabBarClearance(). The surface and its material layers are fully
// static (fixed size, fixed radius, no opacity): animating a native
// GlassView/BlurView or any ancestor of it crashed Home or hid the glass.
// Only the selection pill and the icon/label views animate; they sit above
// the material, never around it.
import type { BottomTabBarProps } from "expo-router/tabs";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { selectionHaptic } from "../../lib/haptics";
import { colors, fontFamily } from "../../theme";
import { Icon, type IconName } from "../ui/Icon";
import { TabBarBackground } from "./TabBarBackground";
import { useTabBarScroll } from "./TabBarScrollContext";
import {
  getTabBarBottom,
  getTabBarHeights,
  getTabBarWidth,
  getTabCellWidth,
  TAB_BAR_PADDING,
  TAB_ICON_LABEL_GAP,
  TAB_ICON_SIZE,
  TAB_LABEL_LINE,
  TAB_LABEL_MAX_SCALE,
  TAB_LABEL_SIZE,
  TAB_PILL_INSET_X,
} from "./tabBarMetrics";
import { TAB_BAR_SURFACE, type TabBarSurfaceMode } from "./tabBarSurface";
import {
  getIndicatorFrame,
  isTabChange,
  layoutsEqual,
  type TabLayout,
} from "./tabIndicator";
import { useTabBarSurface } from "./useTabBarSurface";

const TABS: Record<string, { icon: IconName; label: string }> = {
  home: { icon: "home", label: "Home" },
  stores: { icon: "store", label: "Stores" },
  map: { icon: "map", label: "Map" },
  orders: { icon: "orders", label: "Orders" },
  account: { icon: "account", label: "Account" },
};

// Slightly underdamped for a small liquid overshoot. Perceptual 380ms is
// ~570ms real; duration/dampingRatio are exclusive with stiffness/damping.
const PILL_SPRING = { duration: 380, dampingRatio: 0.78 };
// Icon pop on selection: quick grow, then a bouncy settle back to 1.
const BOUNCE_PEAK = 1.14;
const BOUNCE_UP_MS = 110;
const BOUNCE_SPRING = { duration: 320, dampingRatio: 0.5 };
const BOUNCE_OUT_MS = 150;
const PRESS_SCALE = 0.97;
const PRESS_MS = 120;
const ICON_FADE_MS = 180;
// Active black; inactive grey, matching the inactive icons.
const LABEL_INACTIVE = colors.tabInactive;
const LABEL_ACTIVE = colors.tabActive;

type Navigation = BottomTabBarProps["navigation"];
type Route = BottomTabBarProps["state"]["routes"][number];

type TabItemProps = {
  route: Route;
  index: number;
  focusedIndex: number;
  icon: IconName;
  label: string;
  navigation: Navigation;
  onReselect: () => void;
  onItemLayout: (index: number, layout: TabLayout) => void;
};

const TabItem = memo(function TabItem({
  route,
  index,
  focusedIndex,
  icon,
  label,
  navigation,
  onReselect,
  onItemLayout,
}: TabItemProps) {
  const focused = focusedIndex === index;
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(focused ? 1 : 0);
  const scale = useSharedValue(1);
  const bounce = useSharedValue(1);
  const wasFocused = useRef(focused);

  useEffect(() => {
    const target = focused ? 1 : 0;
    progress.set(
      reducedMotion ? target : withTiming(target, { duration: ICON_FADE_MS }),
    );

    // Bounce only on a real focus change, never on mount.
    const changed = wasFocused.current !== focused;
    wasFocused.current = focused;
    if (!changed) return;
    if (reducedMotion) {
      bounce.set(1);
    } else if (focused) {
      bounce.set(
        withSequence(
          withTiming(BOUNCE_PEAK, { duration: BOUNCE_UP_MS }),
          withSpring(1, BOUNCE_SPRING),
        ),
      );
    } else {
      bounce.set(withTiming(1, { duration: BOUNCE_OUT_MS }));
    }
  }, [focused, reducedMotion, progress, bounce]);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));
  const bounceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bounce.get() }],
  }));
  const outlineStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));
  const filledStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.get(),
      [0, 1],
      [LABEL_INACTIVE, LABEL_ACTIVE],
    ),
  }));

  // React Navigation's tab press contract: listeners can preventDefault.
  const onPress = () => {
    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });
    if (focused) {
      // Re-tap: no haptic, no navigation; Home's useScrollToTop scrolls up.
      onReselect();
      return;
    }
    if (isTabChange(focusedIndex, index, event.defaultPrevented)) {
      selectionHaptic();
      navigation.navigate(route.name, route.params);
    }
  };

  const onLongPress = () => {
    navigation.emit({ type: "tabLongPress", target: route.key });
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    onItemLayout(index, { x, width });
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onLayout={onLayout}
      onPressIn={() => {
        if (!reducedMotion) scale.set(withTiming(PRESS_SCALE, { duration: PRESS_MS }));
      }}
      onPressOut={() => {
        if (!reducedMotion) scale.set(withTiming(1, { duration: PRESS_MS }));
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      accessibilityShowsLargeContentViewer
      accessibilityLargeContentTitle={label}
      style={styles.item}
    >
      <Animated.View style={[styles.itemContent, pressStyle]}>
        {/* Two static Icons cross-faded: flipping `filled` on one mounted
            Android SymbolView can render before the Filled font loads. */}
        <Animated.View style={[styles.iconBox, bounceStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, outlineStyle]}>
            <Icon name={icon} size={TAB_ICON_SIZE} color={colors.tabInactive} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, filledStyle]}>
            <Icon name={icon} size={TAB_ICON_SIZE} color={colors.tabActive} filled />
          </Animated.View>
        </Animated.View>
        {/* Capped at 1.3x so "Account" fits the 61.6pt cell (5 tabs at
            360dp), shrinking slightly as a last resort; iOS shows the Large
            Content Viewer above that. */}
        <Animated.Text
          style={[styles.label, focused && styles.labelFocused, labelStyle]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          allowFontScaling
          maxFontSizeMultiplier={TAB_LABEL_MAX_SCALE}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
});

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const mode = useTabBarSurface();
  const { expand } = useTabBarScroll();

  // Fixed height and radius: the native material is never resized.
  const { expanded } = getTabBarHeights(fontScale);
  const barWidth = getTabBarWidth(width);
  const radius = expanded / 2;
  const pillHeight = expanded - TAB_BAR_PADDING * 2;

  // Measured tab cells (x relative to the row). Plain React state, updated
  // only when a cell actually moves, so onLayout can't loop.
  const [layouts, setLayouts] = useState<(TabLayout | undefined)[]>([]);
  const onItemLayout = useCallback((index: number, layout: TabLayout) => {
    setLayouts((prev) => {
      if (layoutsEqual(prev[index], layout)) return prev;
      const next = prev.slice();
      next[index] = layout;
      return next;
    });
  }, []);

  const frame = getIndicatorFrame(layouts, state.index, {
    padding: TAB_BAR_PADDING,
    fallbackCellWidth: getTabCellWidth(width),
    insetX: TAB_PILL_INSET_X,
  });

  const pillX = useSharedValue(frame.x);
  const pillW = useSharedValue(frame.width);
  useEffect(() => {
    pillX.set(reducedMotion ? frame.x : withSpring(frame.x, PILL_SPRING));
    pillW.set(reducedMotion ? frame.width : withSpring(frame.width, PILL_SPRING));
  }, [frame.x, frame.width, reducedMotion, pillX, pillW]);

  useEffect(() => {
    // A compact bar never carries over to another tab.
    expand();
  }, [state.index, expand]);

  const pillStyle = useAnimatedStyle(() => ({
    width: pillW.get(),
    transform: [{ translateX: pillX.get() }],
  }));

  return (
    <View
      style={[styles.root, { bottom: getTabBarBottom(insets.bottom) }]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.surface,
          surfaceVariant[mode],
          { width: barWidth, height: expanded, borderRadius: radius },
        ]}
      >
        <TabBarBackground mode={mode} radius={radius} />
        <Animated.View
          style={[
            styles.pill,
            mode === "glass" && styles.pillGlass,
            { height: pillHeight, borderRadius: pillHeight / 2 },
            pillStyle,
          ]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View style={styles.row} accessibilityRole="tablist">
          {state.routes.map((route, index) => {
            const config = TABS[route.name];
            if (!config) return null;
            return (
              <TabItem
                key={route.key}
                route={route}
                index={index}
                focusedIndex={state.index}
                icon={config.icon}
                label={config.label}
                navigation={navigation}
                onReselect={expand}
                onItemLayout={onItemLayout}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

// The cast shadow sits on this surface View, never on GlassView (the native
// material gives edge depth, not a shadow). boxShadow on every platform: it
// is drawn outside the capsule only, following its radius. The legacy iOS
// shadow* props on a transparent view shadow its contents instead (icons and
// labels got halos), and Android elevation greys through a translucent fill.
// Translucent modes keep the surface transparent; their fill is a layer in
// TabBarBackground.
const surfaceVariant: Record<TabBarSurfaceMode, ViewStyle> = StyleSheet.create({
  glass: { backgroundColor: "transparent", boxShadow: TAB_BAR_SURFACE.shadow },
  blur: { backgroundColor: "transparent", boxShadow: TAB_BAR_SURFACE.shadow },
  frosted: { backgroundColor: "transparent", boxShadow: TAB_BAR_SURFACE.shadow },
  opaque: {
    backgroundColor: TAB_BAR_SURFACE.opaqueFill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: TAB_BAR_SURFACE.opaqueBorder,
    boxShadow: TAB_BAR_SURFACE.shadow,
  },
});

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  // No overflow:hidden: it would clip the iOS shadow (layers clip themselves).
  surface: {
    flexDirection: "row",
    padding: TAB_BAR_PADDING,
    borderCurve: "continuous",
  },
  pill: {
    position: "absolute",
    top: TAB_BAR_PADDING,
    left: 0,
    borderCurve: "continuous",
    backgroundColor: colors.tabSelection,
  },
  pillGlass: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: TAB_BAR_SURFACE.glassPillBorder,
  },
  row: {
    flex: 1,
    flexDirection: "row",
  },
  item: {
    flex: 1,
    minHeight: 48,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  // Stretched to the cell so the label's width is bounded (shrink-to-fit).
  itemContent: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  iconBox: {
    width: TAB_ICON_SIZE,
    height: TAB_ICON_SIZE,
  },
  label: {
    marginTop: TAB_ICON_LABEL_GAP,
    fontFamily: fontFamily.medium,
    fontSize: TAB_LABEL_SIZE,
    lineHeight: TAB_LABEL_LINE,
    color: LABEL_INACTIVE,
    includeFontPadding: false,
  },
  labelFocused: {
    fontFamily: fontFamily.semibold,
  },
});
