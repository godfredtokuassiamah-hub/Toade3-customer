import { MaterialSymbols_400Regular_Filled } from "@expo-google-fonts/material-symbols/400Regular_Filled";
import { SymbolView } from "expo-symbols";
import regular from "expo-symbols/androidWeights/regular";
import { memo, type ComponentProps } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";

import { colors } from "../../theme";

type SymbolName = Extract<ComponentProps<typeof SymbolView>["name"], object>;
type IosName = NonNullable<SymbolName["ios"]>;
type MaterialName = NonNullable<SymbolName["android"]>;

type IconSpec = {
  sf: IosName;
  // Filled SF variant; icons without one stay outlined on iOS.
  sfFilled?: IosName;
  // Material Symbols name for Android and web. Filled uses the Filled font.
  material: MaterialName;
};

// SF Symbols on iOS only (Apple licence); Material Symbols on Android/web.
const ICONS = {
  home: { sf: "house", sfFilled: "house.fill", material: "home" },
  explore: { sf: "safari", sfFilled: "safari.fill", material: "explore" },
  orders: {
    sf: "takeoutbag.and.cup.and.straw",
    sfFilled: "takeoutbag.and.cup.and.straw.fill",
    material: "takeout_dining",
  },
  account: { sf: "gearshape", sfFilled: "gearshape.fill", material: "settings" },
  chat: {
    sf: "ellipsis.message",
    sfFilled: "ellipsis.message.fill",
    material: "sms",
  },
  search: { sf: "magnifyingglass", material: "search" },
  filter: { sf: "slider.horizontal.3", material: "tune" },
  chevronRight: { sf: "chevron.right", material: "chevron_right" },
  chevronDown: { sf: "chevron.down", material: "keyboard_arrow_down" },
  clock: { sf: "clock", sfFilled: "clock.fill", material: "schedule" },
  close: { sf: "xmark", material: "close" },
  arrowRight: { sf: "arrow.right", material: "arrow_forward" },
  arrowLeft: { sf: "arrow.left", material: "arrow_back" },
  check: { sf: "checkmark", material: "check" },
  location: { sf: "mappin.and.ellipse", material: "location_on" },
  // Location arrow (current location row).
  navigation: { sf: "location", sfFilled: "location.fill", material: "near_me" },
  // Outline pin (saved address rows).
  pin: { sf: "mappin", material: "location_on" },
  recenter: { sf: "scope", material: "my_location" },
  // Search sheet: clear field, stores and category tiles.
  clearField: { sf: "xmark.circle.fill", material: "cancel" },
  store: { sf: "storefront", material: "storefront" },
  localDishes: { sf: "fork.knife", material: "restaurant" },
  riceMeals: { sf: "takeoutbag.and.cup.and.straw", material: "rice_bowl" },
  snacks: { sf: "birthday.cake", material: "cookie" },
  drinks: { sf: "cup.and.saucer", material: "local_cafe" },
  produce: { sf: "leaf", material: "nutrition" },
  dairy: { sf: "cart", material: "egg" },
  bakery: { sf: "birthday.cake", material: "bakery_dining" },
  grains: { sf: "basket", material: "grain" },
  beverages: { sf: "waterbottle", material: "local_drink" },
  household: { sf: "bubbles.and.sparkles", material: "cleaning_services" },
  gadgets: { sf: "desktopcomputer", material: "devices" },
  // Home category grid: extra store categories.
  gifts: { sf: "gift", sfFilled: "gift.fill", material: "redeem" },
  homeDiy: { sf: "lamp.desk", material: "light" },
  sports: { sf: "dumbbell", sfFilled: "dumbbell.fill", material: "fitness_center" },
  pharmacy: { sf: "cross.case", sfFilled: "cross.case.fill", material: "medication" },
  flowers: { sf: "leaf", material: "local_florist" },
  healthBeauty: { sf: "sparkles", material: "spa" },
  // Favourites heart toggle (FavouriteButton, product page later).
  heart: { sf: "heart", sfFilled: "heart.fill", material: "favorite" },
  heartFilled: { sf: "heart.fill", sfFilled: "heart.fill", material: "favorite" },
  // Filters sheet: "Up to GHS 50" quick filter.
  banknote: { sf: "banknote", material: "payments" },
} satisfies Record<string, IconSpec>;

export type IconName = keyof typeof ICONS;

// expo-symbols' androidWeights don't include the Filled font, so build the
// same { name, font } shape from the font package.
const FILLED_WEIGHT = {
  name: "MaterialSymbols_400Regular_Filled",
  font: MaterialSymbols_400Regular_Filled,
};

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  filled?: boolean;
  // iOS only; Android/web always render the regular (or Filled) font.
  weight?: "regular" | "medium" | "semibold";
  // Set to expose the icon to screen readers; otherwise it's decorative.
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

// Shared icon: SF Symbols on iOS, Material Symbols on Android/web.
// The wrapper View carries the accessibility props because the Android/web
// SymbolView doesn't forward them (it renders a glyph <Text>).
function IconBase({
  name,
  size = 20,
  color = colors.text,
  filled = false,
  weight = "regular",
  accessibilityLabel,
  style,
}: Props) {
  const spec: IconSpec = ICONS[name];
  const labelled = accessibilityLabel != null;

  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible={labelled}
      accessibilityRole={labelled ? "image" : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!labelled}
      importantForAccessibility={labelled ? "yes" : "no-hide-descendants"}
    >
      <SymbolView
        name={{
          ios: filled && spec.sfFilled ? spec.sfFilled : spec.sf,
          android: spec.material,
          web: spec.material,
        }}
        size={size}
        tintColor={color}
        type="monochrome"
        weight={{ ios: weight, android: filled ? FILLED_WEIGHT : regular }}
        resizeMode="scaleAspectFit"
        style={{ width: size, height: size }}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      />
    </View>
  );
}

export const Icon = memo(IconBase);
