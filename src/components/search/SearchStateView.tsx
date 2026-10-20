import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import {
  LOADING_COPY,
  type StateAction,
  type StateKind,
  stateCopy,
} from "../../lib/discovery/filterState";
import { colors, fontFamily } from "../../theme";
import { searchStyles } from "./searchStyles";

export const SearchLoading = memo(function SearchLoading() {
  return (
    <View style={styles.loading} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.primary} />
      <Text style={searchStyles.muted}>{LOADING_COPY}</Text>
    </View>
  );
});

// One classified empty / error state (exact §17 copy) with its actions.
// compact = inline in a sheet.
export const SearchStateView = memo(function SearchStateView({
  kind,
  query,
  onAction,
  compact = false,
}: {
  kind: StateKind;
  query: string;
  onAction: (action: StateAction) => void;
  compact?: boolean;
}) {
  const copy = stateCopy(kind, query);
  return (
    <View style={[styles.box, compact && styles.compact]} accessibilityLiveRegion="polite">
      <Text style={[styles.message, compact && styles.messageCompact]}>{copy.message}</Text>
      <View style={[styles.actions, compact && styles.actionsCompact]}>
        {copy.actions.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => onAction(a.id)}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            style={({ pressed }) => [styles.action, pressed && searchStyles.pressed]}
          >
            <Text style={styles.actionText}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  loading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 24,
  },
  box: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  compact: {
    alignItems: "flex-start",
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  message: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
    textAlign: "center",
  },
  messageCompact: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "left",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 14,
  },
  actionsCompact: {
    justifyContent: "flex-start",
    marginTop: 10,
  },
  action: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.text,
  },
});
