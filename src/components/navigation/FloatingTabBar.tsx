// Floating Liquid Glass capsule tab bar. Custom rather than
// expo-router/unstable-native-tabs: native tabs can't draw the sliding orange
// selection pill, our size/Manrope labels or our 48/20 compaction thresholds,
// and render a Material bar on Android.
//
// The capsule overlays the scene (absolute), so screens pad their content
// with getTabBarClearance(). Its height follows the shared compaction
// progress (Home's scroll handler); only height, borderRadius and transforms
// animate, never opacity (it would break GlassView).
import type { BottomTabBarProps } from "expo-router/tabs";
import { memo, useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
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
} from "./tabBarMetrics";
import { TAB_BAR_SURFACE, type TabBarSurfaceMode } from "./tabBarSurface";
import { useTabBarSurface } from "./useTabBarSurface";

const TABS: Record<string, { icon: IconName; label: string }> = {
  home: { icon: "home", label: "Home" },
  explore: { icon: "explore", label: "Explore" },
  orders: { icon: "orders", label: "Orders" },
  account: { icon: "account", label: "Account" },
};

// Critically damped, no overshoot: perceptual 180ms is ~270ms real.
// (duration/dampingRatio are exclusive with stiffness/damping.)
const SELECTION_SPRING = {
  duration: 180,
  dampingRatio: 1,
  overshootClamping: true,
};
const PRESS_SCALE = 0.97;
const PRESS_MS = 120;
const ICON_FADE_MS = 180;

type Navigation = BottomTabBarProps["navigation"];
type Route = BottomTabBarProps["state"]["routes"][number];

type TabItemProps = {
  route: Route;
  focused: boolean;
  icon: IconName;
  label: string;
  navigation: Navigation;
  onReselect: () => void;
};

const TabItem = memo(function TabItem({
  route,
  focused,
  icon,
  label,
  navigation,
  onReselect,
}: TabItemProps) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(focused ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    const target = focused ? 1 : 0;
    progress.set(
      reducedMotion ? target : withTiming(target, { duration: ICON_FADE_MS }),
    );
  }, [focused, reducedMotion, progress]);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));
  const outlineStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));
  const filledStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));

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
    if (!event.defaultPrevented) {
      selectionHaptic();
      navigation.navigate(route.name, route.params);
    }
  };

  const onLongPress = () => {
    navigation.emit({ type: "tabLongPress", target: route.key });
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
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
        <View style={styles.iconBox}>
          <Animated.View style={[StyleSheet.absoluteFill, outlineStyle]}>
            <Icon name={icon} size={TAB_ICON_SIZE} color={colors.tabInactive} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, filledStyle]}>
            <Icon name={icon} size={TAB_ICON_SIZE} color={colors.primary} filled />
          </Animated.View>
        </View>
        {/* Capped at 1.4x so "Account" fits a 77pt cell; iOS shows the Large
            Content Viewer above that. */}
        <Text
          style={[styles.label, focused && styles.labelFocused]}
          numberOfLines={1}
          allowFontScaling
          maxFontSizeMultiplier={TAB_LABEL_MAX_SCALE}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const mode = useTabBarSurface();
  const { progress, expand } = useTabBarScroll();

  const { expanded, compact } = getTabBarHeights(fontScale);
  const barWidth = getTabBarWidth(width);
  const cellWidth = getTabCellWidth(width);

  const selected = useSharedValue(state.index);
  useEffect(() => {
    selected.set(
      reducedMotion ? state.index : withSpring(state.index, SELECTION_SPRING),
    );
    // A compact bar never carries over to another tab.
    expand();
  }, [state.index, reducedMotion, selected, expand]);

  const height = useDerivedValue(() =>
    interpolate(progress.get(), [0, 1], [expanded, compact]),
  );
  const surfaceStyle = useAnimatedStyle(() => ({
    height: height.get(),
    borderRadius: height.get() / 2,
  }));
  const pillStyle = useAnimatedStyle(() => {
    const pillHeight = height.get() - TAB_BAR_PADDING * 2;
    return {
      height: pillHeight,
      borderRadius: pillHeight / 2,
      transform: [{ translateX: TAB_BAR_PADDING + selected.get() * cellWidth }],
    };
  });

  return (
    <View
      style={[styles.root, { bottom: getTabBarBottom(insets.bottom) }]}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[
          styles.surface,
          surfaceVariant[mode],
          { width: barWidth },
          surfaceStyle,
        ]}
      >
        <TabBarBackground mode={mode} height={height} />
        <Animated.View
          style={[styles.pill, { width: cellWidth }, pillStyle]}
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
                focused={state.index === index}
                icon={config.icon}
                label={config.label}
                navigation={navigation}
                onReselect={expand}
              />
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const { shadow } = TAB_BAR_SURFACE;
const iosShadow = {
  shadowColor: shadow.color,
  shadowOpacity: shadow.opacity,
  shadowRadius: shadow.radius,
  shadowOffset: { width: 0, height: shadow.offsetY },
};

// Glass: the native material supplies depth, so no RN shadow.
const surfaceVariant: Record<TabBarSurfaceMode, ViewStyle> = StyleSheet.create({
  glass: { backgroundColor: "transparent" },
  blur: { ...iosShadow, backgroundColor: "transparent" },
  solid: {
    backgroundColor: TAB_BAR_SURFACE.solidFill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: TAB_BAR_SURFACE.solidBorder,
    elevation: TAB_BAR_SURFACE.androidElevation,
  },
  opaque: {
    ...iosShadow,
    backgroundColor: TAB_BAR_SURFACE.opaqueFill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: TAB_BAR_SURFACE.opaqueBorder,
    elevation: TAB_BAR_SURFACE.androidElevation,
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
  itemContent: {
    alignItems: "center",
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
    color: colors.text,
    includeFontPadding: false,
  },
  labelFocused: {
    fontFamily: fontFamily.semibold,
  },
});
