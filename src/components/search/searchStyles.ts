import { StyleSheet } from "react-native";
import { colors, fontFamily } from "../../theme";

// Shared look for the search sheet: solid white cards floating over the
// blurred backdrop.
export const FIELD_BORDER = "#DDDDDD";

export const searchStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    marginHorizontal: 12,
    shadowColor: colors.tabBarShadow,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  muted: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  linkText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
});
