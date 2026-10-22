// Airbnb-style store marker: a small white card (thumbnail, name, fee).
// Selected flips to dark and draws above the others.
//
// Custom marker views are snapshotted natively, so this uses RN <Image>
// (not expo-image) and keeps tracksViewChanges on only until the image has
// loaded / the selected state has re-rendered, then turns it off so the
// marker isn't redrawn every frame. No reanimated here.
import { memo, useCallback, useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";

import { isStoreAvailable, markerSubtitle, storeInitials } from "../../lib/stores/mapStores";
import type { QuotedStore } from "../../lib/stores/storeSections";
import { colors, fontFamily } from "../../theme";

const THUMB = 36;
// Time for the native side to snapshot the latest content before we stop
// tracking view changes.
const SETTLE_MS = 250;

type Props = {
  item: QuotedStore;
  selected: boolean;
  onSelect: (id: string) => void;
};

function StoreMarkerBase({ item, selected, onSelect }: Props) {
  const { store } = item;
  const source = store.logo ?? store.cover;
  const [loaded, setLoaded] = useState(source == null);
  // Track view changes until the current look (image loaded + selected
  // state) has been snapshotted; any change to it tracks again.
  const look = loaded ? (selected ? "selected" : "idle") : "loading";
  const [settledLook, setSettledLook] = useState<string | null>(null);
  const tracking = settledLook !== look;

  useEffect(() => {
    if (look === "loading") return;
    const t = setTimeout(() => setSettledLook(look), SETTLE_MS);
    return () => clearTimeout(t);
  }, [look]);

  const onLoad = useCallback(() => setLoaded(true), []);
  const onPress = useCallback(() => onSelect(store.id), [onSelect, store.id]);
  const dimmed = !selected && !isStoreAvailable(item);

  return (
    <Marker
      coordinate={{ latitude: store.latitude, longitude: store.longitude }}
      onPress={onPress}
      // iOS: don't also fire the map's onPress (which deselects).
      stopPropagation
      tracksViewChanges={tracking}
      zIndex={selected ? 10 : 1}
    >
      {/* Outer padding leaves room for the shadow in the snapshot. */}
      <View style={styles.wrap}>
        <View style={[styles.card, selected && styles.cardSelected, dimmed && styles.dimmed]}>
          <View style={styles.thumb}>
            {source ? (
              <Image
                source={source}
                style={styles.thumbImage}
                resizeMode="cover"
                onLoad={onLoad}
                // A failed image must not leave the marker tracking forever.
                onError={onLoad}
              />
            ) : (
              <Text style={styles.initials} maxFontSizeMultiplier={1.2}>{storeInitials(store.name)}</Text>
            )}
          </View>
          <View style={styles.text}>
            <Text style={[styles.name, selected && styles.nameSelected]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
              {store.name}
            </Text>
            <Text style={[styles.fee, selected && styles.feeSelected]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
              {markerSubtitle(item)}
            </Text>
          </View>
        </View>
      </View>
    </Marker>
  );
}

export const StoreMarker = memo(StoreMarkerBase);

const styles = StyleSheet.create({
  wrap: {
    padding: 6,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 10,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.12)",
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardSelected: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  dimmed: {
    opacity: 0.6,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbImage: {
    width: THUMB,
    height: THUMB,
  },
  initials: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    color: colors.textMuted,
  },
  text: {
    maxWidth: 110,
  },
  name: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.text,
  },
  nameSelected: {
    color: colors.white,
  },
  fee: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textMuted,
  },
  feeSelected: {
    color: "rgba(255,255,255,0.75)",
  },
});
