// Keyboard-safe screen wrapper for form screens (auth now; OTP, profile,
// checkout later). Uses React Native's built-in KeyboardAvoidingView so it
// runs in Expo Go without extra native modules.
//
// behavior="padding" on both platforms: SDK 57 Android is always
// edge-to-edge, so the window is not resized for the keyboard and padding is
// needed there too. KeyboardAvoidingView computes padding from its own frame
// vs the keyboard top, so if a device does resize the window the overlap is
// 0 and nothing is applied twice.
//
// Top safe area is not applied: screens like Auth draw under the status bar.
// Pass safeAreaBottom to pad content by the bottom inset.
//
// Scroll mode + revealRef: while the keyboard is open, the view behind
// revealRef (e.g. the submit button) is scrolled into view, plus revealOffset.
// It re-checks on keyboard show, on viewport resize (Android KAV pads after
// keyboardDidShow) and on content resize (e.g. an inline error appearing).
import { type ReactNode, type RefObject, useEffect, useRef } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type KeyboardAwareScreenProps = {
  children: ReactNode;
  // Outer container (flex: 1 by default).
  style?: StyleProp<ViewStyle>;
  // Scroll content container, or the inner view in non-scroll mode.
  contentContainerStyle?: StyleProp<ViewStyle>;
  // Wrap content in a ScrollView (default true).
  scroll?: boolean;
  // Tap on empty space dismisses the keyboard (default true).
  dismissOnTapOutside?: boolean;
  // Height of anything above this view that the keyboard frame doesn't know
  // about (e.g. a native header). Default 0.
  keyboardVerticalOffset?: number;
  // Add the bottom safe-area inset as content padding (default false).
  safeAreaBottom?: boolean;
  // Scroll mode: view kept above the keyboard while it is open.
  revealRef?: RefObject<View | null>;
  // Gap kept between revealRef's bottom edge and the keyboard (default 16).
  revealOffset?: number;
} & Pick<ScrollViewProps, "bounces" | "showsVerticalScrollIndicator" | "testID">;

export function KeyboardAwareScreen({
  children,
  style,
  contentContainerStyle,
  scroll = true,
  dismissOnTapOutside = true,
  keyboardVerticalOffset = 0,
  safeAreaBottom = false,
  bounces,
  showsVerticalScrollIndicator = false,
  testID,
  revealRef,
  revealOffset = 16,
}: KeyboardAwareScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = safeAreaBottom ? { paddingBottom: insets.bottom } : null;

  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const keyboardOpen = useRef(false);
  const viewportHeight = useRef(0);
  const scrollY = useRef(0);

  // Scroll just enough that revealRef's bottom + revealOffset is visible.
  const reveal = () => {
    const target = revealRef?.current;
    const content = contentRef.current;
    if (!keyboardOpen.current || !target || !content) return;
    target.measureLayout(
      content,
      (_x, y, _w, h) => {
        const needed = y + h + revealOffset - viewportHeight.current;
        if (needed > scrollY.current) {
          scrollRef.current?.scrollTo({ y: needed, animated: true });
        }
      },
      () => {},
    );
  };
  // Latest reveal for the keyboard listener without re-subscribing.
  const revealLatest = useRef(reveal);
  useEffect(() => {
    revealLatest.current = reveal;
  });

  useEffect(() => {
    if (!scroll || !revealRef) return;
    const show = Keyboard.addListener("keyboardDidShow", () => {
      keyboardOpen.current = true;
      revealLatest.current();
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      keyboardOpen.current = false;
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [scroll, revealRef]);

  const onLayout = (e: LayoutChangeEvent) => {
    viewportHeight.current = e.nativeEvent.layout.height;
    reveal();
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
  };

  let content: ReactNode;
  if (scroll) {
    // "handled": taps on empty space dismiss the keyboard natively, while
    // inputs and buttons still receive their own taps.
    content = (
      <ScrollView
        ref={scrollRef}
        testID={testID}
        style={styles.fill}
        contentContainerStyle={[styles.grow, contentContainerStyle, bottomPad]}
        keyboardShouldPersistTaps={dismissOnTapOutside ? "handled" : "always"}
        keyboardDismissMode={dismissOnTapOutside ? "on-drag" : "none"}
        bounces={bounces}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        onLayout={onLayout}
        onContentSizeChange={reveal}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* Measuring root for revealRef; grows so children can flexGrow. */}
        <View ref={contentRef} collapsable={false} style={styles.grow}>
          {children}
        </View>
      </ScrollView>
    );
  } else if (dismissOnTapOutside) {
    // Child Pressables/TextInputs claim their own touches first, so this only
    // fires for taps on empty space.
    content = (
      <Pressable
        testID={testID}
        onPress={Keyboard.dismiss}
        accessible={false}
        style={[styles.fill, contentContainerStyle, bottomPad]}
      >
        {children}
      </Pressable>
    );
  } else {
    content = (
      <View testID={testID} style={[styles.fill, contentContainerStyle, bottomPad]}>
        {children}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={[styles.fill, style]}
    >
      {content}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  grow: {
    flexGrow: 1,
  },
});
