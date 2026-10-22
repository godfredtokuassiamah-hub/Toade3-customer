// Map tab top bar (Airbnb-style): back arrow, a white title pill (opens the
// location picker), a filter icon, then a sideways row of toggle chips.
// A static white gradient behind it keeps it legible over any map tiles.
import { LinearGradient } from "expo-linear-gradient";
import { memo, type RefObject } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { MapChip, MapChipId } from "../../lib/stores/mapStores";
import { colors, fontFamily } from "../../theme";
import { Icon } from "../ui/Icon";

type Props = {
  topInset: number;
  title: string;
  subtitle: string;
  chips: readonly MapChip[];
  isSelected: (id: MapChipId) => boolean;
  onToggleChip: (id: MapChipId) => void;
  onBack: () => void;
  onTitle: () => void;
  onFilter: () => void;
  filterRef: RefObject<View | null>;
};

const GRADIENT = ["rgba(255,255,255,0.96)", "rgba(255,255,255,0.8)", "rgba(255,255,255,0)"] as const;

function MapTopBarBase({
  topInset,
  title,
  subtitle,
  chips,
  isSelected,
  onToggleChip,
  onBack,
  onTitle,
  onFilter,
  filterRef,
}: Props) {
  return (
    <View style={[styles.root, { paddingTop: topInset + 6 }]} pointerEvents="box-none">
      <LinearGradient
        colors={GRADIENT}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.row}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Icon name="arrowLeft" size={22} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={onTitle}
          accessibilityRole="button"
          accessibilityLabel={`${title}, ${subtitle}`}
          accessibilityHint="Changes your drop-off location"
          style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
        >
          <Text style={styles.title} numberOfLines={1} maxFontSizeMultiplier={1.4}>
            {title}
          </Text>
          <Text
            style={styles.subtitle}
            numberOfLines={1}
            maxFontSizeMultiplier={1.4}
            accessibilityLiveRegion="polite"
          >
            {subtitle}
          </Text>
        </Pressable>
        <Pressable
          ref={filterRef}
          onPress={onFilter}
          accessibilityRole="button"
          accessibilityLabel="Filters"
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Icon name="filter" size={22} color={colors.text} />
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipScroll}
      >
        {chips.map((chip) => {
          const selected = isSelected(chip.id);
          return (
            <Pressable
              key={chip.id}
              onPress={() => onToggleChip(chip.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={chip.label}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.chipText} numberOfLines={1} maxFontSizeMultiplier={1.4}>
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export const MapTopBar = memo(MapTopBarBase);

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    flex: 1,
    minHeight: 56,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 3px 12px rgba(0, 0, 0, 0.14)",
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 1,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
  },
  chipScroll: {
    marginTop: 12,
    flexGrow: 0,
  },
  chips: {
    gap: 8,
    paddingHorizontal: 14,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  chipSelected: {
    // Thicker border without shifting the label.
    paddingHorizontal: 15.5,
    borderWidth: 1.5,
    borderColor: colors.text,
    backgroundColor: "#F7F7F7",
  },
  chipText: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: colors.text,
  },
  pressed: {
    opacity: 0.7,
  },
});
