// Horizontal, snapping row of store cards: ~72% wide so the next card
// peeks. Plain FlatList + snapToInterval (no scroll worklets, no onScroll).
import { router } from "expo-router";
import { memo, useCallback } from "react";
import {
  Alert,
  FlatList,
  type ListRenderItem,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { storeVendorId } from "../../lib/storefront/storefrontLink";
import type { QuotedStore } from "../../lib/stores/storeSections";
import { StoreCard } from "./StoreCard";

const SIDE_PADDING = 14;
const GAP = 12;

export function getStoreCardWidth(windowWidth: number): number {
  return Math.round(windowWidth * 0.72);
}

// Opens the linked catalog vendor's storefront; stores without one keep the
// placeholder Alert. (Mock link: the storefront shows the vendor's name and
// hours, not the store card's.)
export function openStorefront(item: QuotedStore): void {
  const vendorId = storeVendorId(item.store);
  if (vendorId) {
    router.push({ pathname: "/storefront/[vendorId]", params: { vendorId } });
    return;
  }
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
