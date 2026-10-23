// Favourites screen (root stack route above the tabs). Reads the shared
// favourites set, resolves the ids against the mock catalog and shows a
// 2-column FoodCard grid. Each card carries the heart badge; tapping it
// removes the item and the grid updates immediately (ids are shared state).
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

import { CartBar } from "../components/cart/CartBar";
import { useCartBarInset } from "../components/cart/useCartBarInset";
import { catalogItemToFoodCardItem } from "../components/discovery/cardItem";
import { searchStyles } from "../components/search/searchStyles";
import { FoodCard, type FoodCardItem } from "../components/home/FoodCard";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { getItemsByIds } from "../data/mock/catalog";
import { useFavourites } from "../lib/favourites/FavouritesContext";
import { colors, fontFamily } from "../theme";

const SIDE = 14;
const GAP = 10;
// Height of the transparent top bar below the safe-area inset.
const TOP_BAR_HEIGHT = 52;

// Empty-state illustration from Icons8 (img.icons8.com id w9PuaUcJdrCP).
// Icons8 requires attribution (a link to icons8.com in the app's credits)
// or a paid licence before release.
const EMPTY_ILLUSTRATION = require("../../assets/icons/favourites/empty-favourites.png");

const keyExtractor = (item: FoodCardItem) => item.id;

export default function Favourites() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { ids } = useFavourites();
  const cartInset = useCartBarInset();

  const items = useMemo(() => getItemsByIds(ids).map(catalogItemToFoodCardItem), [ids]);
  const cardWidth = Math.floor((width - SIDE * 2 - GAP) / 2);

  const renderItem = useCallback<ListRenderItem<FoodCardItem>>(
    ({ item }) => <FoodCard item={item} width={cardWidth} showFavourite />,
    [cardWidth],
  );

  const empty = (
    <EmptyState
      image={EMPTY_ILLUSTRATION}
      title="Your favourites list is empty"
      body="When you find something you love, tap the heart on its card to save it here for later."
    >
      <Pressable
        onPress={() => router.navigate("/home")}
        accessibilityRole="button"
        accessibilityLabel="Start exploring"
        style={({ pressed }) => [styles.exploreButton, pressed && searchStyles.pressed]}
      >
        <Text style={styles.exploreText}>Start exploring</Text>
      </Pressable>
    </EmptyState>
  );

  // Transparent top bar: it overlays the content (the gradient wash on the
  // empty state, or the scrolling grid) instead of sitting in a solid strip.
  const barHeight = insets.top + TOP_BAR_HEIGHT;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
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
          // Clear the absolute top bar (grid only; the empty state centres
          // itself in the full height and sits under the transparent bar).
          items.length > 0 ? { paddingTop: barHeight } : null,
          // Root stack route above the tabs, so the floating tab bar is not
          // shown here; only the safe-area inset needs clearing.
          { paddingBottom: insets.bottom + 24 + cartInset },
        ]}
      />
      {/* Transparent overlay bar: lets touches through except on its controls. */}
      <View style={[styles.topBar, { paddingTop: insets.top }]} pointerEvents="box-none">
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
      <CartBar placement="stack" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: SIDE,
    paddingVertical: 8,
    // Transparent: the gradient wash / grid shows through behind it.
    backgroundColor: "transparent",
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
  exploreButton: {
    marginTop: 20,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  exploreText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.text,
  },
});
