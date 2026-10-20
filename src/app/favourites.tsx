// Favourites screen (root stack route above the tabs). Reads the shared
// favourites set, resolves the ids against the mock catalog and shows a
// 2-column FoodCard grid. Empty state is the common case today, since the
// product page's heart toggle doesn't exist yet.
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo } from "react";
import {
  FlatList,
  type ListRenderItem,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { searchStyles } from "../components/search/searchStyles";
import { FoodCard, type FoodCardItem } from "../components/home/FoodCard";
import { Icon } from "../components/ui/Icon";
import { getItemsByIds, VENDORS } from "../data/mock/catalog";
import { useFavourites } from "../lib/favourites/FavouritesContext";
import type { MockItem } from "../lib/discovery/types";
import { colors, fontFamily } from "../theme";

const SIDE = 14;
const GAP = 10;

const VENDOR_NAMES = new Map(VENDORS.map((v) => [v.vendor_id, v.name]));

// MockItem -> card model (price stays in pesewas; vendor name resolved).
function toCardItem(item: MockItem): FoodCardItem {
  return {
    id: item.item_id,
    name: item.name,
    vendor: VENDOR_NAMES.get(item.vendor_id) ?? "",
    etaMins: item.eta_mins,
    image: item.image,
    priceMinor: item.price_minor,
  };
}

const keyExtractor = (item: FoodCardItem) => item.id;

export default function Favourites() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { ids } = useFavourites();

  const items = useMemo(() => getItemsByIds(ids).map(toCardItem), [ids]);
  const cardWidth = Math.floor((width - SIDE * 2 - GAP) / 2);

  // TODO(item): open item detail once the screen exists.
  const renderItem = useCallback<ListRenderItem<FoodCardItem>>(
    ({ item }) => <FoodCard item={item} width={cardWidth} />,
    [cardWidth],
  );

  const empty = (
    <View style={styles.empty}>
      <Icon name="heart" size={48} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>No favourites yet</Text>
      <Text style={styles.emptyBody}>Tap the heart on an item to save it here.</Text>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={4}
          style={({ pressed }) => [styles.iconButton, pressed && searchStyles.pressed]}
        >
          <Icon name="arrowLeft" size={20} color={colors.text} weight="medium" />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Favourites
        </Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={items.length > 0 ? styles.column : undefined}
        ListEmptyComponent={empty}
        initialNumToRender={8}
        windowSize={9}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          items.length === 0 ? styles.emptyContent : styles.content,
          // Root stack route above the tabs, so the floating tab bar is not
          // shown here; only the safe-area inset needs clearing.
          { paddingBottom: insets.bottom + 24 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: SIDE,
    paddingVertical: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    color: colors.text,
  },
  content: {
    paddingHorizontal: SIDE,
    paddingTop: 8,
  },
  column: {
    gap: GAP,
    marginBottom: GAP,
  },
  emptyContent: {
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    marginTop: 4,
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.text,
  },
  emptyBody: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: "center",
  },
});
