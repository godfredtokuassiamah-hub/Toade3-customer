// Floating cart pill: basket, the cart total and a round item-count badge.
// Shown once the cart has items; tapping it opens /checkout. Reads the cart
// store directly (no provider).
//
// placement "tabs": above the floating tab bar (mounted once in the tabs
// layout). placement "stack": root-stack screens without the tab bar.
//
// Animation: empty -> non-empty slides up 24pt with a fade and 0.92 -> 1
// scale (300ms, ease-out cubic, no bounce); emptying reverses it, then
// unmounts. Adding while visible pops the badge and fades the new total
// in. Reduce Motion: fade only.
//
// Worklet rules (a throwing UI-thread worklet aborts the app on iOS): no
// default params, only captured shared values / primitives, JS via
// scheduleOnRN.
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { cartCount, cartSubtotalMinor, useCart } from "../../lib/cart/cartStore";
import { formatMinorFixed } from "../../lib/discovery/money";
import { colors, fontFamily } from "../../theme";
import { getTabBarBottom, getTabBarHeights } from "../navigation/tabBarMetrics";
import { ExtraIcon } from "../ui/ExtraIcon";
import { CART_BAR_GAP, CART_BAR_HEIGHT } from "./useCartBarInset";

type Props = {
  placement: "tabs" | "stack";
};

const ENTER_MS = 300;
const EXIT_MS = 250;
const RISE = 24;
const SCALE_FROM = 0.92;
const PRESS_SCALE = 0.97;
const PRESS_MS = 120;
const POP_PEAK = 1.18;
const POP_HALF_MS = 110;
const TOTAL_FADE_MS = 220;
const STACK_GAP = 16;
const BADGE = 28;
const BADGE_BG = "#B84A18";

export function CartBar({ placement }: Props) {
  const { cart } = useCart();
  const count = cartCount(cart);
  const total = cartSubtotalMinor(cart);
  const hasItems = count > 0;

  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  // Stays mounted through the exit animation.
  const [mounted, setMounted] = useState(hasItems);
  if (hasItems && !mounted) setMounted(true);
  // Last non-empty values, shown while the bar animates out.
  const [shown, setShown] = useState({ count, total });
  if (hasItems && (shown.count !== count || shown.total !== total)) {
    setShown({ count, total });
  }

  const progress = useSharedValue(hasItems ? 1 : 0);
  const press = useSharedValue(1);
  const badge = useSharedValue(1);
  const totalOpacity = useSharedValue(1);

  const unmount = useCallback(() => setMounted(false), []);

  useEffect(() => {
    if (hasItems) {
      progress.set(withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) }));
    } else {
      progress.set(
        withTiming(0, { duration: EXIT_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
          "worklet";
          if (finished) scheduleOnRN(unmount);
        }),
      );
    }
  }, [hasItems, progress, unmount]);

  // Badge pop + total fade when the cart grows while visible.
  const prevCount = useRef(count);
  useEffect(() => {
    const grew = prevCount.current > 0 && count > prevCount.current;
    const changed = prevCount.current > 0 && count > 0 && count !== prevCount.current;
    prevCount.current = count;
    if (reducedMotion) return;
    if (grew) {
      badge.set(
        withSequence(
          withTiming(POP_PEAK, { duration: POP_HALF_MS }),
          withTiming(1, { duration: POP_HALF_MS }),
        ),
      );
    }
    if (changed) {
      totalOpacity.set(
        withSequence(withTiming(0.2, { duration: 0 }), withTiming(1, { duration: TOTAL_FADE_MS })),
      );
    }
  }, [count, reducedMotion, badge, totalOpacity]);

  // Primitive copies for the worklets.
  const rise = RISE;
  const scaleFrom = SCALE_FROM;
  const fadeOnly = reducedMotion;
  const barStyle = useAnimatedStyle(() => {
    const p = progress.get();
    if (fadeOnly) return { opacity: p, transform: [{ translateY: 0 }, { scale: 1 }] };
    return {
      opacity: p,
      transform: [{ translateY: (1 - p) * rise }, { scale: scaleFrom + (1 - scaleFrom) * p }],
    };
  });
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.get() }] }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badge.get() }] }));
  const totalStyle = useAnimatedStyle(() => ({ opacity: totalOpacity.get() }));

  if (!mounted) return null;

  const bottom =
    placement === "tabs"
      ? getTabBarBottom(insets.bottom) + getTabBarHeights(fontScale).expanded + CART_BAR_GAP
      : insets.bottom + STACK_GAP;
  const totalText = formatMinorFixed(shown.total);
  const itemsLabel = shown.count === 1 ? "1 item" : `${shown.count} items`;

  return (
    <View style={[styles.root, { bottom }]} pointerEvents="box-none">
      <Animated.View style={barStyle} pointerEvents={hasItems ? "box-none" : "none"}>
        <Animated.View style={pressStyle}>
          <Pressable
            onPress={() => router.push("/checkout")}
            onPressIn={() => {
              if (!reducedMotion) press.set(withTiming(PRESS_SCALE, { duration: PRESS_MS }));
            }}
            onPressOut={() => {
              if (!reducedMotion) press.set(withTiming(1, { duration: PRESS_MS }));
            }}
            accessibilityRole="button"
            accessibilityLabel={`View cart, ${itemsLabel}, total ${totalText}`}
            style={styles.pill}
          >
            <ExtraIcon name="basket" size={22} color={colors.white} />
            <Animated.Text style={[styles.total, totalStyle]} numberOfLines={1}>
              {totalText}
            </Animated.Text>
            <Animated.View style={[styles.badge, badgeStyle]}>
              <Text style={styles.badgeText} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                {shown.count}
              </Text>
            </Animated.View>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  pill: {
    minWidth: 180,
    minHeight: CART_BAR_HEIGHT,
    paddingLeft: 20,
    paddingRight: 14,
    borderRadius: 999,
    borderCurve: "continuous",
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
  },
  total: {
    flexShrink: 1,
    fontFamily: fontFamily.semibold,
    fontSize: 17,
    color: colors.white,
  },
  badge: {
    minWidth: BADGE,
    height: BADGE,
    paddingHorizontal: 6,
    borderRadius: BADGE / 2,
    backgroundColor: BADGE_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: colors.white,
  },
});
