import { memo, useCallback } from "react";
import {
  FlatList,
  type ListRenderItem,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { FoodCard, type FoodCardItem } from "./FoodCard";

const SIDE_PADDING = 14;
const GAP = 10;

// ~2 cards visible with the third peeking (177 at 402pt, 158 at 360dp).
export function getFoodCardWidth(windowWidth: number): number {
  return Math.round(windowWidth * 0.44);
}

function Separator() {
  return <View style={styles.separator} />;
}

const keyExtractor = (item: FoodCardItem) => item.id;

// Horizontal, snapping row of food cards. No onScroll: carousel swipes never
// reach the Home feed's tab bar compaction.
export const FoodRow = memo(function FoodRow({ items }: { items: FoodCardItem[] }) {
  const { width } = useWindowDimensions();
  const cardWidth = getFoodCardWidth(width);
  const interval = cardWidth + GAP;

  const renderItem = useCallback<ListRenderItem<FoodCardItem>>(
    // Heart on: Home rows and the filtered Home item modules both use this.
    ({ item }) => <FoodCard item={item} width={cardWidth} showFavourite />,
    [cardWidth],
  );

  // Separator (not `gap`) so these offsets stay exact.
  const getItemLayout = useCallback(
    (_: ArrayLike<FoodCardItem> | null | undefined, index: number) => ({
      length: cardWidth,
      offset: SIDE_PADDING + index * interval,
      index,
    }),
    [cardWidth, interval],
  );

  return (
    <FlatList
      data={items}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      windowSize={5}
      ItemSeparatorComponent={Separator}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={interval}
      decelerationRate="fast"
      contentContainerStyle={styles.content}
    />
  );
});

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SIDE_PADDING,
  },
  separator: {
    width: GAP,
  },
});
