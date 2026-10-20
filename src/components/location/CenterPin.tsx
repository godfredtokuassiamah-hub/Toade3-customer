import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { colors, fontFamily } from "../../theme";

// Icons8 map pin (bundled, pre-tinted orange). Attribution / licence required
// before release.
const MAP_PIN = require("../../../assets/icons/location/map-pin.png");

type Props = {
  // Screen-space point the pin's tip marks (map centre).
  x: number;
  y: number;
  label: string;
};

const PIN = 40;
const GAP = 8;

// Fixed map pin (Icons8 art) with a dark code bubble above it. Static (no
// animation) and non-interactive so it never blocks map gestures. The pin's
// tip sits at (x, y); the bubble floats above its head.
export function CenterPin({ x, y, label }: Props) {
  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { left: x - 100, top: y - PIN - 34 - GAP }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.bubble}>
        <Text style={styles.bubbleText} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Image source={MAP_PIN} style={styles.pin} contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    width: 200,
    alignItems: "center",
  },
  bubble: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: GAP,
  },
  bubbleText: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: colors.white,
    letterSpacing: 0.3,
  },
  pin: {
    width: PIN,
    height: PIN,
  },
});
