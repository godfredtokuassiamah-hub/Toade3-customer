// Reusable heart toggle: outline when off, filled Toade3 orange when on.
// Calls useFavourites().toggle(itemId) with a light haptic.
//
// TODO(item): the product page drops this onto its image. It is intentionally
// NOT on the small Home FoodCard (add it there later behind an opt-in prop so
// the grid cards don't all sprout hearts).
import { memo } from "react";
import { Pressable, StyleSheet } from "react-native";

import { useFavourites } from "../../lib/favourites/FavouritesContext";
import { lightHaptic } from "../../lib/haptics";
import { colors } from "../../theme";
import { Icon } from "./Icon";

type Props = {
  itemId: string;
  size?: number;
  // Override the on/off tints (default: orange on, white off).
  onColor?: string;
  offColor?: string;
};

function FavouriteButtonBase({
  itemId,
  size = 24,
  onColor = colors.primary,
  offColor = colors.white,
}: Props) {
  const { has, toggle } = useFavourites();
  const selected = has(itemId);
  return (
    <Pressable
      onPress={() => {
        lightHaptic();
        toggle(itemId);
      }}
      accessibilityRole="button"
      accessibilityLabel={selected ? "Remove from favourites" : "Add to favourites"}
      accessibilityState={{ selected }}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Icon name="heart" size={size} color={selected ? onColor : offColor} filled={selected} />
    </Pressable>
  );
}

export const FavouriteButton = memo(FavouriteButtonBase);

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
});
