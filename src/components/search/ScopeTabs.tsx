import { Image } from "expo-image";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SCOPES } from "../../lib/discovery/filterState";
import type { DiscoveryScope as SearchScope } from "../../lib/discovery/types";
import { colors, fontFamily } from "../../theme";
import { SCOPE_IMAGES } from "./categoryImages";

type Props = {
  value: SearchScope;
  onChange: (scope: SearchScope) => void;
};

// All · Food · Groceries, centred, with an underline under the selected tab.
export const ScopeTabs = memo(function ScopeTabs({ value, onChange }: Props) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {SCOPES.map((s) => {
        const selected = s.id === value;
        return (
          <Pressable
            key={s.id}
            onPress={() => onChange(s.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={s.label}
            hitSlop={6}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <View style={styles.content}>
              {/* Decorative 3D art directly on the tab (no box). */}
              <Image
                source={SCOPE_IMAGES[s.id]}
                style={styles.art}
                contentFit="contain"
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
              <Text style={[styles.label, selected && styles.labelSelected]}>
                {s.label}
              </Text>
            </View>
            <View style={[styles.underline, selected && styles.underlineSelected]} />
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    // Tighter than before: each tab now carries a 24dp icon and must still
    // fit between the 64dp side insets of the top bar on a 390pt screen.
    gap: 16,
  },
  tab: {
    alignItems: "center",
    paddingTop: 6,
    minHeight: 48,
    justifyContent: "flex-end",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingBottom: 6,
  },
  art: {
    width: 24,
    height: 24,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    color: colors.textMuted,
  },
  labelSelected: {
    fontFamily: fontFamily.bold,
    color: colors.text,
  },
  underline: {
    height: 2.5,
    alignSelf: "stretch",
    borderRadius: 2,
    backgroundColor: "transparent",
  },
  underlineSelected: {
    backgroundColor: colors.text,
  },
  pressed: {
    opacity: 0.7,
  },
});
