// Sticky horizontal category tabs. Active tab = bold + underline, swapped
// instantly (no animation). The strip auto-scrolls to keep the active tab in
// view; that scroll is only animated when reduced motion is off.
import { memo, useEffect, useRef } from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { colors, fontFamily } from "../../theme";
import { SIDE, TAB_H } from "./metrics";

type Props = {
  sections: readonly { id: string; title: string }[];
  activeIndex: number;
  onPressTab: (index: number) => void;
};

function CategoryTabStripBase({ sections, activeIndex, onPressTab }: Props) {
  const reducedMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const tabX = useRef<number[]>([]);

  useEffect(() => {
    const x = tabX.current[activeIndex];
    if (x == null) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, x - SIDE), animated: !reducedMotion });
  }, [activeIndex, reducedMotion]);

  return (
    <View style={styles.bar}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        contentContainerStyle={styles.content}
        accessibilityRole="tablist"
      >
        {sections.map((s, i) => {
          const selected = i === activeIndex;
          return (
            <Pressable
              key={s.id}
              onPress={() => onPressTab(i)}
              onLayout={(e: LayoutChangeEvent) => {
                tabX.current[i] = e.nativeEvent.layout.x;
              }}
              accessibilityRole="tab"
              accessibilityLabel={s.title}
              accessibilityState={{ selected }}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <Text
                style={[styles.label, selected && styles.labelActive]}
                // Fixed-height pinned strip: cap scaling so huge text can't clip.
                maxFontSizeMultiplier={1.4}
              >
                {s.title}
              </Text>
              <View style={[styles.underline, selected && styles.underlineActive]} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export const CategoryTabStrip = memo(CategoryTabStripBase);

const styles = StyleSheet.create({
  bar: {
    height: TAB_H,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  content: {
    paddingHorizontal: SIDE - 12,
    alignItems: "stretch",
  },
  tab: {
    minHeight: TAB_H,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.textMuted,
  },
  labelActive: {
    fontFamily: fontFamily.bold,
    color: colors.text,
  },
  underline: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: "transparent",
  },
  underlineActive: {
    backgroundColor: colors.text,
  },
  pressed: {
    opacity: 0.7,
  },
});
