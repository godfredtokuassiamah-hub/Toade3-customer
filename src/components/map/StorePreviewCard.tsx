// One page of the map's nearby-stores carousel. Static: the carousel
// (StoreCarousel) owns the pop-up / dismiss animation and the floating
// placement above the tab bar.
import { Image } from "expo-image";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { STORE_CATEGORY_LABELS } from "../../data/mock/stores";
import { formatMinorFixed } from "../../lib/discovery/money";
import { formatEtaRange } from "../../lib/stores/deliveryQuote";
import { storeInitials } from "../../lib/stores/mapStores";
import type { QuotedStore } from "../../lib/stores/storeSections";
import { colors, fontFamily } from "../../theme";
import { storeAccessibilityLabel } from "../stores/StoreCard";
import { Icon } from "../ui/Icon";

const IMAGE = 76;
const PIN = 14;
// Same bundled 3D orange pin as CenterPin (Icons8; attribution required).
const MAP_PIN = require("../../../assets/icons/location/map-pin.png");

// "1.2 km away" (distance from the drop-off).
export function distanceAwayLabel(item: QuotedStore): string {
  return `${item.quote.distanceKm.toFixed(1)} km away`;
}

type Props = {
  item: QuotedStore;
  width: number;
  onPress: (item: QuotedStore) => void;
  onClose: () => void;
};

function StorePreviewCardBase({ item, width, onPress, onClose }: Props) {
  const { store, quote } = item;
  const source = store.logo ?? store.cover;
  const away = distanceAwayLabel(item);

  return (
    <View style={{ width }}>
      <Pressable
        onPress={() => onPress(item)}
        accessibilityRole="button"
        accessibilityLabel={`${storeAccessibilityLabel(item)}, ${away}`}
        accessibilityHint="Opens the storefront"
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={[styles.image, !store.open && styles.dimmed]}>
          {source ? (
            <Image
              source={source}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={store.id}
              accessible={false}
            />
          ) : (
            <Text style={styles.initials}>{storeInitials(store.name)}</Text>
          )}
        </View>
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {store.name}
          </Text>
          <Text style={styles.category} numberOfLines={1}>
            {STORE_CATEGORY_LABELS[store.category]}
            {!store.open ? <Text style={styles.closed}> · Closed</Text> : null}
          </Text>
          <View style={styles.meta}>
            {quote.deliverable ? (
              <>
                <Icon name="delivery" size={13} color={colors.text} />
                <Text style={styles.metaStrong}>{formatMinorFixed(quote.feeMinor)}</Text>
                <View style={styles.dot} />
                <Icon name="clock" size={12} color={colors.textMuted} />
                <Text style={styles.metaText}>{formatEtaRange(quote.etaMins)}</Text>
              </>
            ) : (
              <Text style={styles.metaText}>Too far to deliver</Text>
            )}
          </View>
          <View style={styles.meta}>
            <Image source={MAP_PIN} style={styles.pin} contentFit="contain" accessible={false} />
            <Text style={styles.away}>{away}</Text>
          </View>
        </View>
      </Pressable>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close store preview"
        hitSlop={8}
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
      >
        <Icon name="close" size={14} color={colors.text} weight="semibold" />
      </Pressable>
    </View>
  );
}

export const StorePreviewCard = memo(StorePreviewCardBase);

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    paddingRight: 48,
    minHeight: 104,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: colors.white,
    boxShadow: "0px 8px 24px rgba(0, 0, 0, 0.14)",
  },
  image: {
    width: IMAGE,
    height: IMAGE,
    borderRadius: 14,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  dimmed: {
    opacity: 0.6,
  },
  initials: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    color: colors.textMuted,
  },
  body: {
    flex: 1,
  },
  name: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  category: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  closed: {
    fontFamily: fontFamily.semibold,
    color: colors.error,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 6,
  },
  metaStrong: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: colors.text,
  },
  metaText: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: 2,
    backgroundColor: colors.textMuted,
  },
  pin: {
    width: PIN,
    height: PIN,
  },
  away: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: colors.text,
  },
  close: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.8,
  },
});
