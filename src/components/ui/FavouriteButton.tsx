// Reusable heart toggle: outline when off, filled Toade3 orange when on.
// Calls useFavourites().toggle(itemId) with a light haptic.
//
// variant="plain" (default): a bare heart (product page image later).
// variant="badge": a 28pt white circle with a soft shadow behind a 16pt
// heart, grey #111 outline when off; used on FoodCard (showFavourite).
import { memo } from "react";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { useFavourites } from "../../lib/favourites/FavouritesContext";
import { lightHaptic } from "../../lib/haptics";
import { colors } from "../../theme";
import { Icon } from "./Icon";

const BADGE = 28;
// 28 + 8 * 2 = 44pt touch target.
const BADGE_SLOP = 8;

type Props = {
  itemId: string;
  size?: number;
  // Override the on/off tints (default: orange on, white off; the badge
  // defaults to orange on, #111 off).
  onColor?: string;
  offColor?: string;
  variant?: "plain" | "badge";
  style?: StyleProp<ViewStyle>;
};

function FavouriteButtonBase({
  itemId,
  size,
  onColor = colors.primary,
  offColor,
  variant = "plain",
  style,
}: Props) {
  const { has, toggle } = useFavourites();
  const selected = has(itemId);
  const badge = variant === "badge";
  const iconSize = size ?? (badge ? 16 : 24);
  const off = offColor ?? (badge ? colors.text : colors.white);
  return (
    <Pressable
      onPress={() => {
        lightHaptic();
        toggle(itemId);
      }}
      accessibilityRole="button"
      accessibilityLabel={selected ? "Remove from favourites" : "Add to favourites"}
      accessibilityState={{ selected }}
      hitSlop={BADGE_SLOP}
      style={({ pressed }) => [
        styles.button,
        badge && styles.badge,
        style,
        pressed && styles.pressed,
      ]}
    >
      <Icon name="heart" size={iconSize} color={selected ? onColor : off} filled={selected} />
    </Pressable>
  );
}

export const FavouriteButton = memo(FavouriteButtonBase);

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    backgroundColor: colors.white,
    boxShadow: "0px 1px 4px rgba(0, 0, 0, 0.16)",
  },
  pressed: {
    opacity: 0.7,
  },
});
