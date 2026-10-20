// Generic modal bottom sheet built on reanimated + gesture-handler (both in
// Expo Go), with a white frosted-glass backdrop.
//
// - Rendered in an RN Modal (transparent, own animation) so it sits above
//   everything, covers the status bar and is a separate window for screen
//   readers. Android hardware back -> onRequestClose -> onClose (BackHandler
//   events don't fire while a Modal is open).
// - Backdrop: iOS = expo-blur BlurView (tint "light", intensity animated
//   0 -> 40) under a 40% white overlay. Android = white overlay at 75%, no
//   blur: Android blur needs the blurred content wrapped in a BlurTargetView,
//   and the screen behind lives in another window we don't own.
// - Swipe the handle/header down past DRAG_CLOSE or flick faster than
//   FLICK_CLOSE to close; otherwise it springs back.
// - Reduced motion: no slide, the sheet only fades.
// - Keyboard: KeyboardAvoidingView pads the bottom, so the sheet's top stays
//   put and its content (e.g. a list) shrinks above the keyboard.
import { BlurView } from "expo-blur";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { colors } from "../../theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  // Rendered under the grab handle; together they form the drag area.
  header?: ReactNode;
  accessibilityLabel?: string;
  // Called once the enter animation has finished (e.g. to move a11y focus).
  onOpened?: () => void;
};

const RADIUS = 22;
const ENTER_MS = 300;
const EXIT_MS = 250;
const BACKDROP_MS = 250;
const DRAG_CLOSE = 120;
const FLICK_CLOSE = 800;
const BLUR_INTENSITY = 40;
const OVERLAY = Platform.select({
  ios: "rgba(255,255,255,0.4)",
  default: "rgba(255,255,255,0.75)",
});

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export function BottomSheet({
  visible,
  onClose,
  children,
  header,
  accessibilityLabel,
  onOpened,
}: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  // Stay mounted through the exit animation.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  const progress = useSharedValue(0);
  const backdrop = useSharedValue(0);
  const drag = useSharedValue(0);

  // Latest onOpened without restarting the animation when it changes.
  const onOpenedRef = useRef(onOpened);
  useEffect(() => {
    onOpenedRef.current = onOpened;
  });
  const notifyOpened = useCallback(() => onOpenedRef.current?.(), []);

  useEffect(() => {
    if (visible) {
      drag.value = 0;
      backdrop.value = withTiming(1, { duration: BACKDROP_MS });
      progress.value = withTiming(
        1,
        { duration: ENTER_MS, easing: Easing.out(Easing.cubic) },
        (finished) => {
          "worklet";
          if (finished) scheduleOnRN(notifyOpened);
        },
      );
    } else {
      backdrop.value = withTiming(0, { duration: BACKDROP_MS });
      progress.value = withTiming(
        0,
        { duration: EXIT_MS, easing: Easing.in(Easing.cubic) },
        (finished) => {
          "worklet";
          if (finished) scheduleOnRN(setMounted, false);
        },
      );
    }
  }, [visible, progress, backdrop, drag, notifyOpened]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Only a downward drag activates; taps on header buttons still work.
        .activeOffsetY(8)
        .onUpdate((e) => {
          // .set() keeps the React Compiler lint happy inside useMemo.
          drag.set(Math.max(0, e.translationY));
        })
        .onEnd((e) => {
          if (e.translationY > DRAG_CLOSE || e.velocityY > FLICK_CLOSE) {
            // Exit animation continues from the current drag position.
            scheduleOnRN(onClose);
          } else {
            drag.set(withSpring(0, { damping: 20, stiffness: 220 }));
          }
        }),
    [drag, onClose],
  );

  const sheetStyle = useAnimatedStyle(() =>
    reducedMotion
      ? { opacity: progress.value, transform: [{ translateY: 0 }] }
      : {
          opacity: 1,
          transform: [
            { translateY: (1 - progress.value) * height + drag.value },
          ],
        },
  );

  const marginTop = Math.max(Math.round(height * 0.1), insets.top + 8);

  return (
    <Modal
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      visible={mounted}
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.fill}>
        <Backdrop progress={backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.fill}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[styles.sheet, { marginTop }, sheetStyle]}
            accessibilityViewIsModal
            accessibilityLabel={accessibilityLabel}
            onAccessibilityEscape={onClose}
          >
            <GestureDetector gesture={pan}>
              <View collapsable={false}>
                <View style={styles.handle} />
                {header}
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

function Backdrop({
  progress,
  onPress,
}: {
  progress: SharedValue<number>;
  onPress: () => void;
}) {
  const overlayStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const blurProps = useAnimatedProps(() => ({
    intensity: progress.value * BLUR_INTENSITY,
  }));
  return (
    // Not exposed to screen readers: the sheet's Close button, the
    // VoiceOver escape gesture and Android back cover dismissal.
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={onPress}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {Platform.OS === "ios" ? (
        <AnimatedBlurView
          tint="light"
          animatedProps={blurProps}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: OVERLAY }, overlayStyle]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    overflow: "hidden",
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    backgroundColor: colors.disabledFill,
  },
});
