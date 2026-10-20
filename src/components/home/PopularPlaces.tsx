import { Image } from "expo-image";
import { memo, useCallback } from "react";
import {
  FlatList,
  type ListRenderItem,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import type { PopularPlace } from "../../data/mock/home";
import { colors } from "../../theme";

const SIDE_PADDING = 14;
const GAP = 9;

// 5 circles fit exactly at 402pt (68); shrinks on narrow phones (59 at 360dp).
export function getPlaceCircleSize(windowWidth: number): number {
  return Math.min(68, Math.floor((windowWidth - SIDE_PADDING * 2 - 4 * GAP) / 5));
}

const PlaceCircle = memo(function PlaceCircle({
  place,
  size,
}: {
  place: PopularPlace;
  size: number;
}) {
  const circle = { width: size, height: size, borderRadius: size / 2 };

  return (
    <Pressable
      // TODO(vendor): open the vendor page.
      onPress={() => {}}
      accessibilityRole="button"
      accessibilityLabel={place.name}
      style={({ pressed }) => [styles.ring, circle, pressed && styles.pressed]}
    >
      <View style={[styles.clip, circle]}>
        <Image
          source={place.logo}
          style={circle}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={place.id}
          accessible={false}
        />
      </View>
    </Pressable>
  );
});

function Separator() {
  return <View style={styles.separator} />;
}

const keyExtractor = (item: PopularPlace) => item.id;

// Horizontal vendor logos; scrolls once more vendors than fit are added.
export const PopularPlaces = memo(function PopularPlaces({
  places,
}: {
  places: PopularPlace[];
}) {
  const { width } = useWindowDimensions();
  const size = getPlaceCircleSize(width);

  const renderItem = useCallback<ListRenderItem<PopularPlace>>(
    ({ item }) => <PlaceCircle place={item} size={size} />,
    [size],
  );

  return (
    <FlatList
      data={places}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      initialNumToRender={6}
      ItemSeparatorComponent={Separator}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    />
  );
});

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SIDE_PADDING,
    // Room for the soft shadow so it isn't clipped by the list.
    paddingVertical: 4,
  },
  ring: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: colors.tabBarShadow,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  clip: {
    position: "absolute",
    top: -1,
    left: -1,
    overflow: "hidden",
    backgroundColor: colors.imagePlaceholder,
  },
  separator: {
    width: GAP,
  },
  pressed: {
    opacity: 0.8,
  },
});
