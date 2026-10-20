import { router } from "expo-router";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fontFamily } from "../../theme";
import { useFiltersTrigger } from "../filters/useFiltersTrigger";
import { Icon } from "../ui/Icon";

// Two entry points: the search field opens P11 Search, the Filter control
// opens the separate P12 Filters sheet for Home (focus returns here when it
// closes).
export const SearchRow = memo(function SearchRow({ filterCount = 0 }: { filterCount?: number }) {
  const { triggerRef, openFilters } = useFiltersTrigger();
  const label = filterCount > 0 ? `Filters (${filterCount})` : "Filter";
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => router.push("/search")}
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
        ref={triggerRef}
        onPress={() => openFilters({ surface: "home" })}
        accessibilityRole="button"
        accessibilityLabel={filterCount > 0 ? `Filters, ${filterCount} applied` : "Filter"}
        style={({ pressed }) => [styles.filter, filterCount > 0 && styles.filterActive, pressed && styles.pressed]}
      >
        <Text style={styles.filterText}>{label}</Text>
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
    minHeight: 44,
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
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  filterActive: {
    borderWidth: 1.5,
    borderColor: colors.text,
    backgroundColor: colors.white,
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
