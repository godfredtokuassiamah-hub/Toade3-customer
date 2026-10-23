// "Categories" jump list: tapping a section closes the sheet and scrolls the
// storefront to it (the parent handles the scroll).
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fontFamily } from "../../theme";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";
import { SIDE } from "./metrics";

type Props = {
  visible: boolean;
  sections: readonly { id: string; title: string; data: readonly unknown[] }[];
  onClose: () => void;
  onSelect: (index: number) => void;
};

export function CategoriesSheet({ visible, sections, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const header = (
    <View style={styles.header}>
      <Text style={styles.title} accessibilityRole="header">
        Categories
      </Text>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={8}
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
      >
        <Icon name="close" size={18} color={colors.text} />
      </Pressable>
    </View>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      header={header}
      accessibilityLabel="Categories"
      // "dim": no blur, and the drag spring-back never overshoots (no bounce).
      backdrop="dim"
      topGapRatio={0.3}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
        {sections.map((s, i) => {
          const count = `${s.data.length} ${s.data.length === 1 ? "item" : "items"}`;
          return (
            <Pressable
              key={s.id}
              onPress={() => onSelect(i)}
              accessibilityRole="button"
              accessibilityLabel={`${s.title}, ${count}`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={styles.rowTitle}>{s.title}</Text>
              <Text style={styles.rowCount}>{count}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SIDE,
    paddingVertical: 12,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.text,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    minHeight: 52,
    paddingHorizontal: SIDE,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  rowTitle: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  rowCount: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.7,
  },
});
