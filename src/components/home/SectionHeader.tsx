import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fontFamily } from "../../theme";
import { Icon } from "../ui/Icon";

// Section title with a "see all" chevron, left aligned like the mock.
export const SectionHeader = memo(function SectionHeader({
  title,
}: {
  title: string;
}) {
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
