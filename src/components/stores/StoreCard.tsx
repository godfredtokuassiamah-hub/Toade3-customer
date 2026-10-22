// Stores tab card: 16:9 cover (logo on a soft grey cover, or initials when
// the store has no artwork), name, then delivery fee and time range. Fee and
// time are display estimates from lib/stores/deliveryQuote. Distinct from
// components/search/StoreCard (the compact filtered-Home vendor rail card).
import { Image } from "expo-image";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatMinorFixed } from "../../lib/discovery/money";
import { formatEtaRange } from "../../lib/stores/deliveryQuote";
import { storeInitials } from "../../lib/stores/mapStores";
import type { QuotedStore } from "../../lib/stores/storeSections";
import { colors, fontFamily } from "../../theme";
import { Icon } from "../ui/Icon";

export { storeInitials };

const PADDING = 8;
const LOGO = 64;

// "{name}, delivery GHS 8.00, 20 to 35 minutes[, closed]".
export function storeAccessibilityLabel({ store, quote }: QuotedStore): string {
  const parts = [store.name];
  if (quote.deliverable) {
    parts.push(
      `delivery ${formatMinorFixed(quote.feeMinor)}`,
      `${quote.etaMins[0]} to ${quote.etaMins[1]} minutes`,
    );
  } else {
    parts.push("too far to deliver");
  }
  if (!store.open) parts.push("closed");
  return parts.join(", ");
}

function StoreCardBase({
  item,
  width,
  onPress,
}: {
  item: QuotedStore;
  width: number;
  onPress: (item: QuotedStore) => void;
}) {
  const { store, quote } = item;
  const coverWidth = width - PADDING * 2;
  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={storeAccessibilityLabel(item)}
      style={({ pressed }) => [
        styles.card,
        { width },
        !quote.deliverable && styles.tooFar,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.cover, { width: coverWidth }, !store.open && styles.dimmed]}>
        {store.cover ? (
          <Image
            source={store.cover}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={store.id}
            accessible={false}
          />
        ) : store.logo ? (
          <Image
            source={store.logo}
            style={styles.logo}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={store.id}
            accessible={false}
          />
        ) : (
          <View style={styles.initials}>
            <Text style={styles.initialsText}>{storeInitials(store.name)}</Text>
          </View>
        )}
      </View>
      {!store.open ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Closed</Text>
        </View>
      ) : null}
      <Text style={styles.name} numberOfLines={1}>
        {store.name}
      </Text>
      <View style={styles.meta}>
        {quote.deliverable ? (
          <>
            <Icon name="delivery" size={13} color={colors.textMuted} />
            <Text style={styles.metaText}>{formatMinorFixed(quote.feeMinor)}</Text>
            <Text style={styles.metaText}>·</Text>
            <Icon name="clock" size={12} color={colors.textMuted} />
            <Text style={styles.metaText}>{formatEtaRange(quote.etaMins)}</Text>
          </>
        ) : (
          <Text style={styles.metaText}>Too far to deliver</Text>
        )}
      </View>
    </Pressable>
  );
}

export const StoreCard = memo(StoreCardBase);

const styles = StyleSheet.create({
  card: {
    padding: PADDING,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: colors.white,
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.08)",
  },
  tooFar: {
    opacity: 0.5,
  },
  cover: {
    aspectRatio: 16 / 9,
    borderRadius: 12,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  dimmed: {
    opacity: 0.5,
  },
  logo: {
    width: LOGO,
    height: LOGO,
    borderRadius: LOGO / 2,
  },
  initials: {
    width: LOGO,
    height: LOGO,
    borderRadius: LOGO / 2,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  initialsText: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    color: colors.textMuted,
  },
  badge: {
    position: "absolute",
    top: PADDING + 8,
    left: PADDING + 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: colors.text,
  },
  badgeText: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    color: colors.white,
  },
  name: {
    marginTop: 10,
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    marginBottom: 2,
  },
  metaText: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.8,
  },
});
