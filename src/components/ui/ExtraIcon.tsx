// Cart / checkout glyphs missing from Icon.tsx (owned by another workflow,
// not editable right now; fold these into Icon.tsx later). Same rendering
// as Icon.tsx and StoreGlyph: SF Symbols on iOS, Material Symbols on
// Android/web (expo-symbols, in Expo Go).
import { SymbolView } from "expo-symbols";
import regular from "expo-symbols/androidWeights/regular";
import { type ComponentProps, memo } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";

import { colors } from "../../theme";

type SymbolName = Extract<ComponentProps<typeof SymbolView>["name"], object>;
type IosName = NonNullable<SymbolName["ios"]>;
type MaterialName = NonNullable<SymbolName["android"]>;

const GLYPHS = {
  basket: { sf: "basket.fill", material: "shopping_basket" },
  edit: { sf: "square.and.pencil", material: "edit" },
  document: { sf: "note.text", material: "description" },
  help: { sf: "questionmark.circle", material: "help" },
  minusCircle: { sf: "minus.circle", material: "do_not_disturb_on" },
  plusCircle: { sf: "plus.circle.fill", material: "add_circle" },
} satisfies Record<string, { sf: IosName; material: MaterialName }>;

export type ExtraIconName = keyof typeof GLYPHS;

type Props = {
  name: ExtraIconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

// Always decorative: the surrounding control carries the label.
function ExtraIconBase({ name, size = 20, color = colors.text, style }: Props) {
  const spec = GLYPHS[name];
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
        weight={{ ios: "regular", android: regular }}
        resizeMode="scaleAspectFit"
        style={{ width: size, height: size }}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      />
    </View>
  );
}

export const ExtraIcon = memo(ExtraIconBase);
