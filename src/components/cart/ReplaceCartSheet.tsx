// One-vendor rule confirm: compact bottom sheet shown when an item from
// another vendor is added. The rule itself lives in the cart store
// (needsNewCart); this is only the prompt. Rendered inside the item sheet's
// Modal tree, so its own Modal presents above it on iOS and Android.
import { Image } from "expo-image";
import { useRef } from "react";
import {
  AccessibilityInfo,
  type ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fontFamily } from "../../theme";
import { BottomSheet } from "../ui/BottomSheet";
import { ExtraIcon } from "../ui/ExtraIcon";

// Icons8 illustration (img.icons8.com id rPCAH753HAqD). Icons8 requires
// attribution or a paid licence before release. Null renders the grey
// basket placeholder.
const REPLACE_CART_ILLUSTRATION: ImageSourcePropType | null = require("../../../assets/icons/cart/replace-cart.png");
const ILLUSTRATION = 96;

type Props = {
  visible: boolean;
  oldVendor: string;
  newVendor: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ReplaceCartSheet({ visible, oldVendor, newVendor, onConfirm, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const titleRef = useRef<Text>(null);

  const focusTitle = () => {
    if (titleRef.current) AccessibilityInfo.sendAccessibilityEvent(titleRef.current, "focus");
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onCancel}
      onOpened={focusTitle}
      backdrop="dim"
      fitContent
      accessibilityLabel="Start a new cart?"
    >
      <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {REPLACE_CART_ILLUSTRATION ? (
          <Image
            source={REPLACE_CART_ILLUSTRATION}
            style={styles.illustration}
            contentFit="contain"
            accessible={false}
          />
        ) : (
          <View style={[styles.illustration, styles.placeholder]}>
            <ExtraIcon name="basket" size={40} color={colors.textMuted} />
          </View>
        )}
        <Text ref={titleRef} style={styles.title} accessibilityRole="header">
          Start a new cart?
        </Text>
        <Text style={styles.message}>
          Your cart has items from {oldVendor}. Adding this item from {newVendor} will remove them.
        </Text>
        <Pressable
          onPress={onConfirm}
          accessibilityRole="button"
          accessibilityLabel="Start new cart"
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>Start new cart</Text>
        </Pressable>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Keep current cart"
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>Keep current cart</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    alignItems: "center",
  },
  illustration: {
    width: ILLUSTRATION,
    height: ILLUSTRATION,
  },
  placeholder: {
    borderRadius: ILLUSTRATION / 2,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginTop: 16,
    fontFamily: fontFamily.bold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
    textAlign: "center",
  },
  message: {
    marginTop: 8,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: "center",
  },
  primary: {
    alignSelf: "stretch",
    marginTop: 24,
    minHeight: 52,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: colors.white,
  },
  secondary: {
    alignSelf: "stretch",
    marginTop: 8,
    minHeight: 48,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  pressed: {
    opacity: 0.7,
  },
});
