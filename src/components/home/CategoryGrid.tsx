// Category-shortcut grid beneath the search bar: a wrapping grid of 16
// tiles, 4 per row, that scrolls WITH the Home page (it's one block inside
// the Home FlatList, not its own scroller).
//
// Each tile is a light-grey circle with 3D art and a label below. No
// Reanimated layout/worklet animation here: the Home feed already bans
// `entering` on virtualized cells, and this grid needs none.
import { Image } from "expo-image";
import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { HOME_SHORTCUTS, type HomeShortcut } from "../../data/home/categoryShortcuts";
import { lightHaptic } from "../../lib/haptics";
import { colors, fontFamily } from "../../theme";

// Matches the 14pt side padding used by SearchRow and the results grid.
const SIDE = 14;
const GAP = 12;
const COLUMNS = 4;
const CIRCLE = 64;

const Tile = memo(function Tile({
  shortcut,
  width,
  onSelect,
}: {
  shortcut: HomeShortcut;
  width: number;
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
      // The 48pt row height (circle 64 + label) already clears the min
      // touch target.
      style={({ pressed }) => [styles.tile, { width }, pressed && styles.pressed]}
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

export const CategoryGrid = memo(function CategoryGrid({
  onSelect,
}: {
  onSelect: (shortcut: HomeShortcut) => void;
}) {
  const { width } = useWindowDimensions();
  // Tile width from the window: side padding on both edges, 3 gaps between
  // 4 columns. Floored so the row never overflows and wraps a 5th tile.
  const tileWidth = useMemo(
    () => Math.floor((width - SIDE * 2 - GAP * (COLUMNS - 1)) / COLUMNS),
    [width],
  );

  return (
    <View style={styles.grid}>
      {HOME_SHORTCUTS.map((shortcut) => (
        <Tile key={shortcut.id} shortcut={shortcut} width={tileWidth} onSelect={onSelect} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: SIDE,
    paddingTop: 16,
    columnGap: GAP,
    rowGap: 16,
  },
  tile: {
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
