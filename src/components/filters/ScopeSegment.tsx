import { Image } from "expo-image";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SCOPES } from "../../lib/discovery/filterState";
import type { DiscoveryScope } from "../../lib/discovery/types";
import { colors, fontFamily } from "../../theme";
import { SCOPE_IMAGES } from "../search/categoryImages";

// "What would you like?" All / Food / Groceries; exactly one selected
// (selected segment: dark 1.5px rounded border).
export const ScopeSegment = memo(function ScopeSegment({
  value,
  onChange,
}: {
  value: DiscoveryScope;
  onChange: (scope: DiscoveryScope) => void;
}) {
  return (
    <View style={styles.track} accessibilityRole="radiogroup">
      {SCOPES.map((s) => {
        const selected = s.id === value;
        return (
          <Pressable
            key={s.id}
            testID={`scope-${s.id}`}
            onPress={() => onChange(s.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, selected }}
            accessibilityLabel={s.label}
            style={({ pressed }) => [styles.segment, selected && styles.selected, pressed && styles.pressed]}
          >
            {/* Decorative 3D art directly on the segment (no box). */}
            <Image
              source={SCOPE_IMAGES[s.id]}
              style={styles.art}
              contentFit="contain"
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text style={[styles.label, selected && styles.labelSelected]}>{s.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  art: {
    width: 26,
    height: 26,
  },
  selected: {
    borderColor: colors.text,
    backgroundColor: colors.white,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "center",
  },
  labelSelected: {
    fontFamily: fontFamily.bold,
    color: colors.text,
  },
});
