// Applied filter chips (one per counted group, removable) plus the
// uncounted sort label. Shared by Home and the results screen.
import { memo, useMemo } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { type AppliedDiscovery, appliedChips } from "../../lib/discovery/filterState";
import { categoryLabel } from "../../services/discovery";
import { Chip } from "../search/Chip";

export const AppliedChipsRow = memo(function AppliedChipsRow({
  applied,
  onChange,
  sidePadding,
}: {
  applied: AppliedDiscovery;
  onChange: (next: AppliedDiscovery) => void;
  sidePadding: number;
}) {
  const { groups, sort } = useMemo(() => appliedChips(applied, categoryLabel), [applied]);
  if (groups.length === 0 && !sort) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={[styles.chips, { paddingHorizontal: sidePadding }]}
    >
      {groups.map((c) => (
        <Chip key={c.key} label={c.label} selected removable onPress={() => onChange(c.remove(applied))} />
      ))}
      {sort ? (
        // Not counted in "Filters (N)"; shown separately, unselected style.
        <Chip key={sort.key} label={sort.label} removable onPress={() => onChange(sort.remove(applied))} />
      ) : null}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  chips: {
    gap: 8,
    paddingVertical: 8,
  },
});
