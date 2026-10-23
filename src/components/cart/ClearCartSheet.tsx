// Clear-cart confirm: compact bottom sheet opened from the Confirm Order
// header's trash button. Same layout as ReplaceCartSheet.
import { Image } from "expo-image";
import { useRef } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fontFamily } from "../../theme";
import { BottomSheet } from "../ui/BottomSheet";

// Icons8 illustration (img.icons8.com id faXHmzlIKEVi). Icons8 requires
// attribution or a paid licence before release.
const CLEAR_CART_ILLUSTRATION = require("../../../assets/icons/cart/clear-cart.png");
const ILLUSTRATION = 96;

type Props = {
  visible: boolean;
  vendorName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ClearCartSheet({ visible, vendorName, onConfirm, onCancel }: Props) {
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
      accessibilityLabel="Clear your cart?"
    >
      <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Image
          source={CLEAR_CART_ILLUSTRATION}
          style={styles.illustration}
          contentFit="contain"
          accessible={false}
        />
        <Text ref={titleRef} style={styles.title} accessibilityRole="header">
          Clear your cart?
        </Text>
        <Text style={styles.message}>
          {`This removes everything from ${vendorName}. You can't undo this.`}
        </Text>
        <Pressable
          onPress={onConfirm}
          accessibilityRole="button"
          accessibilityLabel="Clear cart"
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>Clear cart</Text>
        </Pressable>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Keep my cart"
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>Keep my cart</Text>
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
  // Destructive action: deep red, not the brand orange.
  primary: {
    alignSelf: "stretch",
    marginTop: 24,
    minHeight: 52,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.error,
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
