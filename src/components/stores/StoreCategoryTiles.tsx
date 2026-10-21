// Stores tab quick buttons: the Home shortcut tiles (same 3D art, same grey
// circle) in one sideways-scrolling row. Only tiles that are store
// categories are shown; tapping one filters the sections, tapping the
// selected one clears it.
import { Image } from "expo-image";
import { memo, useCallback } from "react";
import { FlatList, type ListRenderItem, Pressable, StyleSheet, Text, View } from "react-native";

import { HOME_SHORTCUTS, type HomeShortcut } from "../../data/home/categoryShortcuts";
import { isStoreCategory, type StoreCategory } from "../../data/mock/stores";
import { lightHaptic } from "../../lib/haptics";
import { colors, fontFamily } from "../../theme";

const SIDE = 14;
const GAP = 8;
const TILE = 72;
const CIRCLE = 64;

type Tile = HomeShortcut & { id: StoreCategory };

// Favourites, "Stores" and the food-only tiles don't map to a store
// category, so they're dropped here.
const TILES: Tile[] = HOME_SHORTCUTS.filter((s): s is Tile => isStoreCategory(s.id));

const TileView = memo(function TileView({
  tile,
  selected,
  onToggle,
}: {
  tile: Tile;
  selected: boolean;
  onToggle: (id: StoreCategory) => void;
}) {
  return (
    <Pressable
      onPress={() => {
        lightHaptic();
        onToggle(tile.id);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${tile.label} stores`}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={[styles.circle, selected && styles.circleSelected]}>
        <Image
          source={tile.icon}
          style={styles.art}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={2}>
        {tile.label}
      </Text>
    </Pressable>
  );
});

function Separator() {
  return <View style={styles.separator} />;
}

const keyExtractor = (tile: Tile) => tile.id;

export const StoreCategoryTiles = memo(function StoreCategoryTiles({
  selected,
  onToggle,
}: {
  selected: StoreCategory | null;
  onToggle: (id: StoreCategory) => void;
}) {
  const renderItem = useCallback<ListRenderItem<Tile>>(
    ({ item }) => <TileView tile={item} selected={item.id === selected} onToggle={onToggle} />,
    [selected, onToggle],
  );
  const getItemLayout = useCallback(
    (_: ArrayLike<Tile> | null | undefined, index: number) => ({
      length: TILE,
      offset: SIDE + index * (TILE + GAP),
      index,
    }),
    [],
  );
  return (
    <FlatList
      data={TILES}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      extraData={selected}
      horizontal
      showsHorizontalScrollIndicator={false}
      ItemSeparatorComponent={Separator}
      contentContainerStyle={styles.content}
    />
  );
});

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SIDE,
    paddingTop: 16,
  },
  separator: {
    width: GAP,
  },
  tile: {
    width: TILE,
    alignItems: "center",
    gap: 6,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  circleSelected: {
    borderColor: colors.text,
  },
  art: {
    width: Math.round(CIRCLE * 0.7),
    height: Math.round(CIRCLE * 0.7),
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 15,
    color: colors.text,
    textAlign: "center",
  },
  labelSelected: {
    fontFamily: fontFamily.bold,
  },
  pressed: {
    opacity: 0.6,
  },
});
