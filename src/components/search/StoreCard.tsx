import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { DiscoveryVendor } from "../../lib/discovery/types";
import { formatEta } from "../../lib/format";
import { colors, fontFamily } from "../../theme";
import { Icon } from "../ui/Icon";

export const STORE_CARD_WIDTH = 148;

// Store card for the filtered Home's matching-vendor rail (no logos yet,
// no ratings or counts).
export const StoreCard = memo(function StoreCard({
  store,
  onPress,
}: {
  store: DiscoveryVendor;
  onPress: (id: string) => void;
}) {
  const status = store.open ? "Open" : "Closed";
  return (
    <Pressable
      onPress={() => onPress(store.vendor_id)}
      accessibilityRole="button"
      accessibilityLabel={`${store.name}, ${status}, from ${formatEta(store.eta_mins)}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.logo}>
        <Icon name="store" size={22} color={colors.primary} />
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {store.name}
      </Text>
      <View style={styles.meta}>
        <Text style={[styles.status, !store.open && styles.closed]}>{status}</Text>
        <Text style={styles.eta}>· {formatEta(store.eta_mins)}</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    width: STORE_CARD_WIDTH,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 8,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.text,
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  status: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: colors.primary,
  },
  closed: {
    color: colors.textMuted,
  },
  eta: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.8,
  },
});
