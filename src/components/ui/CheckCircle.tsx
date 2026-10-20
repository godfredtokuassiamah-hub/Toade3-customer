import { View } from "react-native";

import { colors } from "../../theme";

type Props = {
  size?: number;
  color?: string;
};

// Decorative filled circle with a white tick (rotated L shape).
export function CheckCircle({ size = 22, color = colors.primary }: Props) {
  const tickW = size * 0.26;
  const tickH = size * 0.48;
  const stroke = Math.max(1.75, size * 0.09);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={{
          width: tickW,
          height: tickH,
          borderRightWidth: stroke,
          borderBottomWidth: stroke,
          borderColor: "#FFFFFF",
          // Nudge up so the rotated tick looks optically centred.
          marginTop: -size * 0.08,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}
