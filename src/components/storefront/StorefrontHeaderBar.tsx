// The storefront's only set of header controls, used in both states:
// - expanded: transparent bar, buttons on white circles over the photo;
// - collapsed: white bar + vendor title fade in, circles fade out.
// Only opacity/transform animate (UI thread); no blur/glass views.
// In search mode the title becomes a TextInput and the right icons a Cancel
// button; the bar is forced opaque by the scroll hook.
import { router } from "expo-router";
import { memo } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type ViewStyle } from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";

import { colors, fontFamily } from "../../theme";
import { Icon } from "../ui/Icon";
import { HeaderIconButton } from "./HeaderIconButton";
import { BAR_H, SIDE } from "./metrics";
import { StoreGlyph } from "./StoreGlyph";

type Props = {
  vendorName: string;
  insetTop: number;
  collapsed: boolean;
  bgStyle: AnimatedStyle<ViewStyle>;
  titleStyle: AnimatedStyle<ViewStyle>;
  circleStyle: AnimatedStyle<ViewStyle>;
  saved: boolean;
  onToggleSave: () => void;
  onShare: () => void;
  searchOpen: boolean;
  query: string;
  onChangeQuery: (q: string) => void;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
};

function StorefrontHeaderBarBase({
  vendorName,
  insetTop,
  collapsed,
  bgStyle,
  titleStyle,
  circleStyle,
  saved,
  onToggleSave,
  onShare,
  searchOpen,
  query,
  onChangeQuery,
  onOpenSearch,
  onCloseSearch,
}: Props) {
  return (
    <View style={[styles.bar, { height: insetTop + BAR_H, paddingTop: insetTop }]} pointerEvents="box-none">
      <Animated.View style={[styles.bg, bgStyle]} pointerEvents="none" />
      <View style={styles.row} pointerEvents="box-none">
        <HeaderIconButton
          icon={<Icon name="arrowLeft" size={20} color={colors.text} weight="medium" />}
          label="Back"
          onPress={() => router.back()}
          circleStyle={circleStyle}
        />

        <View style={styles.center} pointerEvents="box-none">
          {searchOpen ? (
            <TextInput
              value={query}
              onChangeText={onChangeQuery}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
              placeholder={`Search ${vendorName}`}
              placeholderTextColor={colors.placeholder}
              accessibilityLabel="Search menu"
              maxFontSizeMultiplier={1.4}
              style={styles.input}
            />
          ) : (
            <Animated.View
              style={titleStyle}
              accessibilityElementsHidden={!collapsed}
              importantForAccessibility={collapsed ? "auto" : "no-hide-descendants"}
            >
              <Text
                style={styles.title}
                numberOfLines={1}
                accessibilityRole="header"
                // Fixed-height pinned bar: cap scaling so huge text can't clip.
                maxFontSizeMultiplier={1.4}
              >
                {vendorName}
              </Text>
            </Animated.View>
          )}
        </View>

        {searchOpen ? (
          <Pressable
            onPress={onCloseSearch}
            accessibilityRole="button"
            accessibilityLabel="Cancel search"
            hitSlop={8}
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
          >
            <Text style={styles.cancelText} maxFontSizeMultiplier={1.4}>
              Cancel
            </Text>
          </Pressable>
        ) : (
          <View style={styles.right}>
            <HeaderIconButton
              icon={
                <Icon
                  name="heart"
                  filled={saved}
                  size={20}
                  color={saved ? colors.primary : colors.text}
                />
              }
              label={saved ? `Remove ${vendorName} from saved` : `Save ${vendorName}`}
              selected={saved}
              onPress={onToggleSave}
              circleStyle={circleStyle}
            />
            <HeaderIconButton
              icon={<StoreGlyph name="share" size={19} color={colors.text} />}
              label={`Share ${vendorName}`}
              onPress={onShare}
              circleStyle={circleStyle}
            />
            <HeaderIconButton
              icon={<Icon name="search" size={19} color={colors.text} />}
              label="Search menu"
              onPress={onOpenSearch}
              circleStyle={circleStyle}
            />
          </View>
        )}
      </View>
    </View>
  );
}

export const StorefrontHeaderBar = memo(StorefrontHeaderBarBase);

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  bg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  row: {
    height: BAR_H,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: SIDE - 4,
  },
  center: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: colors.text,
    textAlign: "center",
  },
  input: {
    height: 40,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.inputFill,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: colors.text,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cancel: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  cancelText: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
});
