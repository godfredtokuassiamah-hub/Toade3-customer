import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fontFamily } from "../../theme";
import { Icon } from "../ui/Icon";

// Section title with a "see all" chevron, left aligned like the mock.
// With onViewAll, a trailing action ("View all" on filtered Home, "See all"
// on Stores via actionLabel) opens the full list.
export const SectionHeader = memo(function SectionHeader({
  title,
  onViewAll,
  actionLabel = "View all",
}: {
  title: string;
  onViewAll?: () => void;
  actionLabel?: string;
}) {
  if (onViewAll) {
    return (
      <View style={[styles.container, styles.split]}>
        <Text style={[styles.title, styles.flex]} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        <Pressable
          onPress={onViewAll}
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel} ${title}`}
          hitSlop={8}
          style={({ pressed }) => [styles.row, styles.viewAll, pressed && styles.pressed]}
        >
          <Text style={styles.viewAllText}>{actionLabel}</Text>
          <Icon name="chevronRight" size={12} color={colors.primary} weight="semibold" />
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <Pressable
        // TODO(section): open the see-all list for this section.
        onPress={() => {}}
        accessibilityRole="button"
        accessibilityLabel={`${title}, see all`}
        hitSlop={8}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Icon
          name="chevronRight"
          size={14}
          color={colors.text}
          weight="semibold"
        />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    marginTop: 20,
    marginBottom: 10,
    alignItems: "flex-start",
  },
  split: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  viewAll: {
    gap: 4,
    minHeight: 44,
  },
  viewAllText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.primary,
  },
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: colors.text,
  },
  pressed: {
    opacity: 0.7,
  },
});
