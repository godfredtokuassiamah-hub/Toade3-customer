// Map tab: every store on a map around the drop-off (the confirmed delivery
// address, or central Accra until one is set). Stores render as small
// Airbnb-style cards; tapping one selects it, moves the camera to it and
// pops up a swipeable carousel of nearby stores above the tab bar. Fees and
// times are display estimates (the server quote is authoritative at checkout).
//
// Carousel sync:
// - Marker tap on a store NOT in the current carousel (or when it's closed):
//   rebuild the order = visible stores by distance from that store, selected
//   first; jump to page 0 and replay the pop-up.
// - Marker tap on a store already in the carousel: keep the order, glide to
//   its page.
// - Swipe: selects that page's store (dark marker, camera, haptic). The
//   order never changes while swiping.
// - Chip change: rebuild around the selected store if it's still visible,
//   otherwise clear the selection.
// - Map background / close: reverse animation, then clear the selection.
//
// react-native-maps default provider (Apple Maps on iOS, Google on Android),
// included in Expo Go. The MapView is never animated with reanimated; the
// camera moves via the native animateToRegion call.
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, useWindowDimensions, View } from "react-native";
import MapView, { type MapPressEvent, Marker, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useFiltersTrigger } from "../../components/filters/useFiltersTrigger";
import { MapTopBar } from "../../components/map/MapTopBar";
import { StoreCarousel } from "../../components/map/StoreCarousel";
import { StoreMarker } from "../../components/map/StoreMarker";
import { distanceAwayLabel } from "../../components/map/StorePreviewCard";
import { FEED_END_SPACING, getTabBarClearance } from "../../components/navigation/tabBarMetrics";
import { storeAccessibilityLabel } from "../../components/stores/StoreCard";
import { openStorefront } from "../../components/stores/StoreRow";
import { useDropoff } from "../../components/stores/useDropoff";
import { STORES } from "../../data/mock/stores";
import { selectionHaptic } from "../../lib/haptics";
import { useDeliveryAddress } from "../../lib/location/DeliveryAddressContext";
import {
  EMPTY_MAP_FILTER,
  filterMapStores,
  isChipSelected,
  type MapChipId,
  mapChips,
  mapTitle,
  storeCountLabel,
  toggleMapChip,
} from "../../lib/stores/mapStores";
import { orderByProximity } from "../../lib/stores/nearbyOrder";
import { type QuotedStore, quoteStores } from "../../lib/stores/storeSections";
import { colors } from "../../theme";

// ~6 km across, so the 5 km delivery radius fits on screen.
const DELTA = { latitudeDelta: 0.06, longitudeDelta: 0.06 };
const CAMERA_MS = 350;
// Centre this fraction of the visible span below the store so the carousel
// doesn't cover its marker.
const CAMERA_LIFT = 0.18;
// Gap between the carousel cards and the floating tab bar.
const PREVIEW_GAP = 12;
const CHIPS = mapChips(STORES);

const orderIdsFrom = (list: readonly QuotedStore[], origin: QuotedStore) =>
  orderByProximity(list, origin.store).map((s) => s.store.id);

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { dropoff, exact } = useDropoff();
  const { active } = useDeliveryAddress();
  const mapRef = useRef<MapView>(null);

  const quoted = useMemo(() => quoteStores(STORES, dropoff), [dropoff]);
  const region = useMemo(() => ({ ...dropoff, ...DELTA }), [dropoff]);
  // Latest camera region, so selecting a store keeps the user's zoom.
  const regionRef = useRef<Region>(region);

  const [filter, setFilter] = useState(EMPTY_MAP_FILTER);
  const visible = useMemo(() => filterMapStores(quoted, filter), [quoted, filter]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Carousel order, fixed at the marker tap (null = no carousel).
  const [orderIds, setOrderIds] = useState<string[] | null>(null);
  // False while the dismiss animation plays.
  const [open, setOpen] = useState(false);
  // Bumped on every rebuild from a marker tap to replay the pop-up.
  const [popKey, setPopKey] = useState(0);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const items = useMemo(() => {
    if (!orderIds) return [];
    const byId = new Map(visible.map((s) => [s.store.id, s]));
    return orderIds.flatMap((id) => byId.get(id) ?? []);
  }, [orderIds, visible]);

  const moveCamera = useCallback((item: QuotedStore) => {
    const { latitudeDelta, longitudeDelta } = regionRef.current;
    mapRef.current?.animateToRegion(
      {
        latitude: item.store.latitude - latitudeDelta * CAMERA_LIFT,
        longitude: item.store.longitude,
        latitudeDelta,
        longitudeDelta,
      },
      CAMERA_MS,
    );
  }, []);

  const onMarkerSelect = useCallback(
    (id: string) => {
      const item = visible.find((s) => s.store.id === id);
      if (!item) return;
      selectionHaptic();
      setSelectedId(id);
      moveCamera(item);
      if (!open || !orderIds?.includes(id)) {
        setOrderIds(orderIdsFrom(visible, item));
        setPopKey((k) => k + 1);
      }
      setOpen(true);
    },
    [visible, open, orderIds, moveCamera],
  );

  // Swipe settled on a new page.
  const onSnap = useCallback(
    (id: string) => {
      if (id === selectedId) return;
      const item = visible.find((s) => s.store.id === id);
      if (!item) return;
      selectionHaptic();
      setSelectedId(id);
      moveCamera(item);
      AccessibilityInfo.announceForAccessibility(
        `${storeAccessibilityLabel(item)}, ${distanceAwayLabel(item)}`,
      );
    },
    [selectedId, visible, moveCamera],
  );

  const dismiss = useCallback(() => setOpen(false), []);
  // After the dismiss animation; ignored if a marker tap reopened it.
  const onHidden = useCallback(() => {
    if (openRef.current) return;
    setSelectedId(null);
    setOrderIds(null);
  }, []);

  // Background tap dismisses. Android reports marker taps here too.
  const onMapPress = useCallback(
    (e: MapPressEvent) => {
      if (e.nativeEvent.action === "marker-press") return;
      if (selectedId) dismiss();
    },
    [selectedId, dismiss],
  );

  const onToggleChip = useCallback(
    (id: MapChipId) => {
      selectionHaptic();
      const next = toggleMapChip(filter, id);
      const nextVisible = filterMapStores(quoted, next);
      setFilter(next);
      if (selectedId) {
        // A store hidden by a chip is no longer selected.
        const sel = nextVisible.find((s) => s.store.id === selectedId);
        if (sel) {
          setOrderIds(orderIdsFrom(nextVisible, sel));
        } else {
          setSelectedId(null);
          setOrderIds(null);
          setOpen(false);
        }
      }
      AccessibilityInfo.announceForAccessibility(`${storeCountLabel(nextVisible.length)} shown`);
    },
    [filter, quoted, selectedId],
  );
  const isSelected = useCallback((id: MapChipId) => isChipSelected(filter, id), [filter]);

  const { triggerRef: filterRef, openFilters } = useFiltersTrigger();
  const onFilter = useCallback(() => openFilters({ surface: "home" }), [openFilters]);
  const onBack = useCallback(() => router.navigate("/home"), []);
  const onTitle = useCallback(() => router.push("/location-picker"), []);

  const previewBottom = getTabBarClearance(insets.bottom, fontScale) - FEED_END_SPACING + PREVIEW_GAP;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        onRegionChangeComplete={(r) => {
          regionRef.current = r;
        }}
        onPress={onMapPress}
        showsUserLocation
        showsPointsOfInterests={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        userInterfaceStyle="light"
      >
        <Marker
          coordinate={dropoff}
          title={exact ? "Your drop-off" : "Central Accra"}
          description={exact ? undefined : "Set your drop-off for exact prices"}
          pinColor={colors.text}
        />
        {visible.map((item) => (
          <StoreMarker
            key={item.store.id}
            item={item}
            selected={item.store.id === selectedId}
            onSelect={onMarkerSelect}
          />
        ))}
      </MapView>

      <MapTopBar
        topInset={insets.top}
        title={mapTitle(active?.title)}
        subtitle={storeCountLabel(visible.length)}
        chips={CHIPS}
        isSelected={isSelected}
        onToggleChip={onToggleChip}
        onBack={onBack}
        onTitle={onTitle}
        onFilter={onFilter}
        filterRef={filterRef}
      />

      {items.length > 0 ? (
        <StoreCarousel
          items={items}
          selectedId={selectedId}
          open={open}
          popKey={popKey}
          bottom={previewBottom}
          onSnap={onSnap}
          onPress={openStorefront}
          onClose={dismiss}
          onHidden={onHidden}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
});
