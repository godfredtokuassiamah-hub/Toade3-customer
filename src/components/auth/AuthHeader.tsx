import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fontFamily } from "../../theme";
import { Icon } from "../ui/Icon";

const logo = require("../../../assets/images/LOGOS/logo-icon.png");

type Props = {
  // Total header height, including the part hidden behind the sheet's
  // rounded top corners.
  height: number;
  // Selected language code shown in the pill, e.g. "EN".
  languageCode: string;
  // Spoken name of the selected language, e.g. "English".
  languageName: string;
  // Opens the language picker (built separately under src/components/language/).
  onOpenLanguage: () => void;
};

// Orange gradient header (user-requested, no photo texture): white logo
// top-left, language and help pills top-right.
export function AuthHeader({
  height,
  languageCode,
  languageName,
  onOpenLanguage,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { height }]}>
      {/* Deep orange at the top to lighter orange toward the sheet. */}
      <LinearGradient
        colors={[colors.headerTop, colors.headerBottom]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.row, { marginTop: insets.top + 12 }]}>
        <Image
          source={logo}
          style={styles.logo}
          contentFit="contain"
          tintColor={colors.white}
          accessibilityLabel="Toade3"
        />
        <View style={styles.pills}>
          <Pressable
            onPress={onOpenLanguage}
            accessibilityRole="button"
            accessibilityLabel={`Language, ${languageName}`}
            hitSlop={6}
            style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
          >
            <Text style={styles.pillText}>{languageCode}</Text>
            <Icon
              name="chevronDown"
              size={12}
              color={colors.white}
              weight="semibold"
            />
          </Pressable>
          <Pressable
            onPress={() => {
              // TODO(support): open help / support.
            }}
            accessibilityRole="button"
            accessibilityLabel="Get help"
            hitSlop={6}
            style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
          >
            <Text style={styles.pillText}>Get Help</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.headerTop,
    overflow: "hidden",
  },
  row: {
    height: 32,
    paddingLeft: 20,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    width: 24,
    height: 30,
  },
  pills: {
    flexDirection: "row",
    gap: 10,
  },
  pill: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.25)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pillText: {
    color: colors.white,
    fontFamily: fontFamily.medium,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.8,
  },
});
