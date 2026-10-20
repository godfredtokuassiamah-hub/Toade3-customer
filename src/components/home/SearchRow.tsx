import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fontFamily } from "../../theme";
import { Icon } from "../ui/Icon";

// Search entry + Filter pill. Both are buttons for now (no inline input).
export const SearchRow = memo(function SearchRow() {
  return (
    <View style={styles.row}>
      <Pressable
        // TODO(search): open the search screen.
        onPress={() => {}}
        accessibilityRole="search"
        accessibilityLabel="Search for items"
        style={({ pressed }) => [styles.search, pressed && styles.pressed]}
      >
        <Icon name="search" size={18} color={colors.textSecondary} />
        <Text style={styles.placeholder} numberOfLines={1}>
          Search for items
        </Text>
      </Pressable>
      <Pressable
        // TODO(filter): open the filter sheet.
        onPress={() => {}}
        accessibilityRole="button"
        accessibilityLabel="Filter"
        style={({ pressed }) => [styles.filter, pressed && styles.pressed]}
      >
        <Text style={styles.filterText}>Filter</Text>
        <Icon name="filter" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 14,
  },
  search: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  placeholder: {
    flexShrink: 1,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.placeholder,
  },
  filter: {
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  filterText: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.text,
  },
  pressed: {
    opacity: 0.7,
  },
});
