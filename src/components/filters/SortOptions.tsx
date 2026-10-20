import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SORT_OPTIONS } from "../../lib/discovery/filterState";
import type { DiscoverySort } from "../../lib/discovery/types";
import { colors, fontFamily } from "../../theme";
import { CheckCircle } from "../ui/CheckCircle";

export const SortOptions = memo(function SortOptions({
  value,
  onChange,
}: {
  value: DiscoverySort;
  onChange: (sort: DiscoverySort) => void;
}) {
  return (
    <View accessibilityRole="radiogroup">
      {SORT_OPTIONS.map((o) => {
        const selected = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={o.label}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{o.label}</Text>
            {selected ? <CheckCircle size={22} /> : <View style={styles.empty} />}
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 15,
    color: colors.text,
  },
  labelSelected: {
    fontFamily: fontFamily.bold,
  },
  empty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#DDDDDD",
  },
});
