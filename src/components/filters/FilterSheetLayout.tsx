// Bottom-sheet chrome for P12, drawn inside the transparentModal route over
// the screen that opened it:
// - FiltersBackdrop (white glass, tap to close) fills the window.
// - The sheet: translucent frosted glass (FiltersSheetSurface, same
//   platform modes), top radius 24, grabber + pinned header ("Filters"
//   centred, X top right) as the drag-to-dismiss area, ONE scroll area and a
//   pinned footer above the home indicator / keyboard (no double safe-area
//   padding).
// - Height fits the content, capped at ~90% of the window (never under the
//   status bar); the scroll area shrinks first so the footer stays visible.
// Heights grow with large text (min heights only, no fixed text boxes).
import { type ReactNode, type Ref, useEffect, useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fontFamily } from "../../theme";
import type { TabBarSurfaceMode } from "../navigation/tabBarSurface";
import { Icon } from "../ui/Icon";
import { FiltersBackdrop } from "./FiltersBackdrop";
import { FiltersSheetSurface } from "./FiltersSheetSurface";
import { FILTERS_SHEET, getSheetMaxHeight } from "./filtersSheet";
import type { FiltersSheetMotion } from "./useFiltersSheetMotion";

export function FilterSheetLayout({
  titleRef,
  status,
  onClose,
  scrollRef,
  children,
  renderFooter,
  motion,
  mode,
}: {
  titleRef: Ref<Text>;
  // Live status line under the title ("Updating results...").
  status: string | null;
  onClose: () => void;
  scrollRef?: Ref<ScrollView>;
  children: ReactNode;
  renderFooter: (bottomPadding: number) => ReactNode;
  motion: FiltersSheetMotion;
  // Backdrop material (shared with the tab bar's surface modes).
  mode: TabBarSurfaceMode;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  // iOS only: keyboard height applied as a plain, NON-animated paddingBottom.
  // No KeyboardAvoidingView: it calls LayoutAnimation.configureNext, which
  // would resize the sheet's GlassView/BlurView frame by frame (crash lesson,
  // crash-glass-storage-plan.md step 9). Android relies on adjustResize.
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const isIOS = Platform.OS === "ios";
    const showEvt = isIOS ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = isIOS ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvt, (e) => {
      setKeyboardOpen(true);
      if (isIOS) setKeyboardHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvt, () => {
      setKeyboardOpen(false);
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const maxHeight = getSheetMaxHeight(windowHeight, insets.top);

  return (
    <>
      <FiltersBackdrop
        mode={mode}
        glassOn={motion.glassOn}
        reducedMotion={motion.reducedMotion}
        scrim={motion.scrim}
        onPress={onClose}
      />
      <View
        style={[
          styles.frame,
          { paddingTop: insets.top + FILTERS_SHEET.topGap, paddingBottom: keyboardHeight },
        ]}
        pointerEvents="box-none"
      >
        {/* Transform-only wrapper around the static glass surface. */}
        <Animated.View
          style={[styles.sheet, { maxHeight }, motion.sheetStyle]}
          onLayout={motion.onSheetLayout}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
        >
          <FiltersSheetSurface
            mode={mode}
            glassOn={motion.glassOn}
            reducedMotion={motion.reducedMotion}
            fadeStyle={motion.contentStyle}
          />
          {/* Plain content; only this fades (Reduce Motion). */}
          <Animated.View style={[styles.content, motion.contentStyle]}>
          <GestureDetector gesture={motion.pan}>
            <View collapsable={false} style={styles.header}>
              <View
                style={styles.grabber}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
              <View style={styles.headerRow}>
                <Text ref={titleRef} style={styles.title} accessibilityRole="header">
                  Filters
                </Text>
                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Close filters"
                  hitSlop={6}
                  style={({ pressed }) => [styles.close, pressed && styles.pressed]}
                >
                  <Icon name="close" size={16} color={colors.text} weight="semibold" />
                </Pressable>
              </View>
              <Text style={styles.status} accessibilityLiveRegion="polite">
                {status ?? " "}
              </Text>
            </View>
          </GestureDetector>
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          {renderFooter(keyboardOpen ? 12 : Math.max(insets.bottom, 12))}
          </Animated.View>
        </Animated.View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    justifyContent: "flex-end",
  },
  // No background: the translucent FiltersSheetSurface draws the material.
  sheet: {
    flexShrink: 1,
    borderTopLeftRadius: FILTERS_SHEET.radius,
    borderTopRightRadius: FILTERS_SHEET.radius,
    borderCurve: "continuous",
  },
  content: {
    flexShrink: 1,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 2.5,
    marginTop: 8,
    backgroundColor: colors.disabledFill,
  },
  headerRow: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 64,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 17,
    color: colors.text,
    textAlign: "center",
  },
  close: {
    position: "absolute",
    right: 12,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
  status: {
    paddingBottom: 6,
    textAlign: "center",
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
  },
});
