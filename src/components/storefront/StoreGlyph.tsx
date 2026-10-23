// Storefront-local glyphs (share, list, plus, star, percent, phone, info). They exist only
// because src/components/ui/Icon.tsx is owned by another workflow and must not
// be edited right now; fold these into Icon.tsx later. Same rendering as
// Icon.tsx: SF Symbols on iOS, Material Symbols on Android/web (expo-symbols,
// already installed and in Expo Go).
import { MaterialSymbols_400Regular_Filled } from "@expo-google-fonts/material-symbols/400Regular_Filled";
import { SymbolView } from "expo-symbols";
import regular from "expo-symbols/androidWeights/regular";
import { memo, type ComponentProps } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";

import { colors } from "../../theme";

type SymbolName = Extract<ComponentProps<typeof SymbolView>["name"], object>;
type IosName = NonNullable<SymbolName["ios"]>;
type MaterialName = NonNullable<SymbolName["android"]>;

type GlyphSpec = { sf: IosName; material: MaterialName; filled?: boolean };

const GLYPHS = {
  share: { sf: "square.and.arrow.up", material: "share" },
  list: { sf: "list.bullet", material: "list" },
  plus: { sf: "plus", material: "add" },
  star: { sf: "star.fill", material: "star", filled: true },
  percent: { sf: "percent", material: "percent" },
  // More info sheet.
  phone: { sf: "phone.fill", material: "call", filled: true },
  info: { sf: "info.circle", material: "info" },
} satisfies Record<string, GlyphSpec>;

export type StoreGlyphName = keyof typeof GLYPHS;

const FILLED_WEIGHT = {
  name: "MaterialSymbols_400Regular_Filled",
  font: MaterialSymbols_400Regular_Filled,
};

type Props = {
  name: StoreGlyphName;
  size?: number;
  color?: string;
  weight?: "regular" | "medium" | "semibold" | "bold";
  style?: StyleProp<ViewStyle>;
};

// Always decorative: the surrounding control carries the accessibility label.
function StoreGlyphBase({ name, size = 20, color = colors.text, weight = "regular", style }: Props) {
  const spec: GlyphSpec = GLYPHS[name];
  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <SymbolView
        name={{ ios: spec.sf, android: spec.material, web: spec.material }}
        size={size}
        tintColor={color}
        type="monochrome"
        weight={{ ios: weight, android: spec.filled ? FILLED_WEIGHT : regular }}
        resizeMode="scaleAspectFit"
        style={{ width: size, height: size }}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      />
    </View>
  );
}

export const StoreGlyph = memo(StoreGlyphBase);
