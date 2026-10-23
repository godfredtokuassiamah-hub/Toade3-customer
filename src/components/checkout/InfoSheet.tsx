// Compact checkout info sheet: illustration, title, body copy and a single
// "Got it" dismiss button. Same layout as ClearCartSheet. Used by
// ServiceChargeSheet and RiderWagesSheet.
import { Image, type ImageSource } from "expo-image";
import { useRef } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fontFamily } from "../../theme";
import { BottomSheet } from "../ui/BottomSheet";

const ILLUSTRATION = 96;

type Props = {
  visible: boolean;
  onClose: () => void;
  illustration: ImageSource | number;
  title: string;
  message: string;
};

export function InfoSheet({ visible, onClose, illustration, title, message }: Props) {
  const insets = useSafeAreaInsets();
  const titleRef = useRef<Text>(null);

  const focusTitle = () => {
    if (titleRef.current) AccessibilityInfo.sendAccessibilityEvent(titleRef.current, "focus");
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onOpened={focusTitle}
      backdrop="dim"
      fitContent
      accessibilityLabel={title}
    >
      <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Image
          source={illustration}
          style={styles.illustration}
          contentFit="contain"
          accessible={false}
        />
        <Text ref={titleRef} style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.message}>{message}</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Got it"
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>Got it</Text>
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
  pressed: {
    opacity: 0.7,
  },
});
