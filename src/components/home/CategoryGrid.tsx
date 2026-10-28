// Category shortcuts beneath the search bar: all 16 tiles in ONE sideways
// scrolling row, the same layout as the Stores tab quick buttons
// (StoreCategoryTiles: 72pt tiles, 8pt gap, 14pt side padding), so the
// shortcuts take a single row of Home instead of a 4-row grid.
//
// Each tile is a light-grey circle with 3D art and a label below. No
// Reanimated layout/worklet animation here: the Home feed already bans
// `entering` on virtualized cells, and this row needs none.
import { Image } from "expo-image";
import { memo, useCallback } from "react";
import { FlatList, type ListRenderItem, Pressable, StyleSheet, Text, View } from "react-native";

import { HOME_SHORTCUTS, type HomeShortcut } from "../../data/home/categoryShortcuts";
import { lightHaptic } from "../../lib/haptics";
import { colors, fontFamily } from "../../theme";

// Matches the 14pt side padding used by SearchRow and the Stores tiles.
const SIDE = 14;
const GAP = 8;
const TILE = 72;
const CIRCLE = 64;

const Tile = memo(function Tile({
  shortcut,
  onSelect,
}: {
  shortcut: HomeShortcut;
  onSelect: (shortcut: HomeShortcut) => void;
}) {
  return (
    <Pressable
      onPress={() => {
        lightHaptic();
        onSelect(shortcut);
      }}
      accessibilityRole="button"
      accessibilityLabel={shortcut.label}
      // The 72pt tile (circle 64 + label) already clears the min touch target.
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={styles.circle}>
        <Image
          source={shortcut.icon}
          style={styles.art}
          contentFit="contain"
          cachePolicy="memory-disk"
          // Decorative: the label names the shortcut.
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {shortcut.label}
      </Text>
    </Pressable>
  );
});

function Separator() {
  return <View style={styles.separator} />;
}

const keyExtractor = (shortcut: HomeShortcut) => shortcut.id;

// Fixed tile width, so the row can skip measuring.
const getItemLayout = (_: ArrayLike<HomeShortcut> | null | undefined, index: number) => ({
  length: TILE,
  offset: SIDE + index * (TILE + GAP),
  index,
});

export const CategoryGrid = memo(function CategoryGrid({
  onSelect,
}: {
  onSelect: (shortcut: HomeShortcut) => void;
}) {
  const renderItem = useCallback<ListRenderItem<HomeShortcut>>(
    ({ item }) => <Tile shortcut={item} onSelect={onSelect} />,
    [onSelect],
  );
  return (
    <FlatList
      data={HOME_SHORTCUTS}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
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
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  art: {
    // ~70% of the circle.
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
  pressed: {
    opacity: 0.6,
  },
});
