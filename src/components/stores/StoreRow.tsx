// Horizontal, snapping row of store cards: ~72% wide so the next card
// peeks. Plain FlatList + snapToInterval (no scroll worklets, no onScroll).
import { memo, useCallback } from "react";
import {
  Alert,
  FlatList,
  type ListRenderItem,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import type { QuotedStore } from "../../lib/stores/storeSections";
import { StoreCard } from "./StoreCard";

const SIDE_PADDING = 14;
const GAP = 12;

export function getStoreCardWidth(windowWidth: number): number {
  return Math.round(windowWidth * 0.72);
}

// TODO(store): open the storefront once it exists.
export function openStorefront(item: QuotedStore): void {
  Alert.alert("Storefront coming soon", `${item.store.name} will open here soon.`);
}

function Separator() {
  return <View style={styles.separator} />;
}

const keyExtractor = (item: QuotedStore) => item.store.id;

export const StoreRow = memo(function StoreRow({ stores }: { stores: QuotedStore[] }) {
  const { width } = useWindowDimensions();
  const cardWidth = getStoreCardWidth(width);
  const interval = cardWidth + GAP;

  const renderItem = useCallback<ListRenderItem<QuotedStore>>(
    ({ item }) => <StoreCard item={item} width={cardWidth} onPress={openStorefront} />,
    [cardWidth],
  );

  // Separator (not `gap`) so these offsets stay exact.
  const getItemLayout = useCallback(
    (_: ArrayLike<QuotedStore> | null | undefined, index: number) => ({
      length: cardWidth,
      offset: SIDE_PADDING + index * interval,
      index,
    }),
    [cardWidth, interval],
  );

  return (
    <FlatList
      data={stores}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      initialNumToRender={3}
      maxToRenderPerBatch={3}
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
    // Room for the card shadow so the list doesn't clip it.
    paddingVertical: 6,
  },
  separator: {
    width: GAP,
  },
});
