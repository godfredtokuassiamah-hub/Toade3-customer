import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { Category, CategoryFacet } from "../../lib/discovery/types";
import { colors, fontFamily } from "../../theme";
import { Chip } from "../search/Chip";

// Scope-relevant categories, multi-select (ORed). Counts are the server's
// self-excluded facet counts (distinct items); hidden until known.
export const CategoryMultiSelect = memo(function CategoryMultiSelect({
  categories,
  facets,
  selectedIds,
  onToggle,
}: {
  categories: Category[];
  facets: CategoryFacet[] | null;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const counts = new Map((facets ?? []).map((f) => [f.id, f.count]));
  return (
    <View>
      <Text style={styles.label}>Category</Text>
      <View style={styles.wrap}>
        {categories.map((c) => {
          const count = counts.get(c.id);
          return (
            <Chip
              key={c.id}
              label={count == null ? c.label : `${c.label} · ${count}`}
              selected={selectedIds.includes(c.id)}
              onPress={() => onToggle(c.id)}
            />
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
    marginBottom: 10,
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
