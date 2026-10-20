import { StyleSheet } from "react-native";

import { colors } from "./colors";

// Manrope (OFL), loaded in src/app/_layout.tsx. Each weight is its own family:
// 400 regular, 500 medium, 600 semibold, 700 bold. Never combine these with
// fontWeight; Android would synthesize a faux bold on top of the real weight.
export const fontFamily = {
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
} as const;

export const text = StyleSheet.create({
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: 18,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
  },
  button: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
  },
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },
});
