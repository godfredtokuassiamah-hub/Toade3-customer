// Map view of an order (tracking screen's map button). Layout follows the
// design mockup:
//
//   full-screen map: drop-off marker ("Dropoff by 10:50 AM" bubble), store
//   marker (logo, name, rating), dashed line store -> drop-off
//   floating: back (returns to the list view) and share buttons
//   status card: vendor, status title, arrival window, art, status banner,
//   riding on top of a draggable sheet that holds the order details
//
// Honest data only: no rider marker or rider name (no rider location
// exists yet), no "Dropoff by" time without a server ETA, and the dashed
// line is illustrative (not a road route).
//
// Map rules from the Map tab: default provider (Apple Maps / Google, in Expo
// Go), never animated with reanimated; custom marker views use RN <Image>
// and stop tracking view changes once the image has been snapshotted.
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image as RNImage,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import MapView, { Marker, Polyline } from "react-native-maps";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { curvedPath, isRealPoint, type MapPoint, type TrackingTone } from "../../lib/orders/orderTracking";
import { colors, fontFamily } from "../../theme";
import { useSnapSheet } from "../location/useSnapSheet";
import { ExtraIcon } from "../ui/ExtraIcon";
import { Icon } from "../ui/Icon";

const ROUTE_COLOR = "#0F3D2E";
const SETTLE_MS = 250;
const FIT_DELTA = 0.02;
// Gap between the status card and the sheet top.
const CARD_GAP = 10;

type Props = {
  vendorName: string;
  vendorLogo?: ImageSourcePropType;
  vendorRating?: { value: number; count: number };
  vendorPoint: MapPoint | null;
  dropoffPoint: MapPoint | null;
  // "10:50 AM" (server ETA) or null -> "Drop-off".
  dropoffBy: string | null;
  title: string;
  arrival: string | null;
  // "Running late" styling for the arrival line.
  late: boolean;
  // "The store has until 10:23 AM to accept" (pending only).
  deadline: string | null;
  // Live platform rider position; null until one is assigned and reporting.
  riderPoint: MapPoint | null;
  riderName: string | null;
  banner: string;
  tone: { bg: string; fg: string; kind: TrackingTone };
  art: ReactNode;
  onClose: () => void;
  onShare: () => void;
  // Order detail cards, rendered inside the sheet.
  children: ReactNode;
};

export function OrderTrackingMap({
  vendorName,
  vendorLogo,
  vendorRating,
  vendorPoint,
  dropoffPoint,
  dropoffBy,
  title,
  arrival,
  late,
  deadline,
  riderPoint,
  riderName,
  banner,
  tone,
  art,
  onClose,
  onShare,
  children,
}: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const mapRef = useRef<MapView>(null);

  const store = isRealPoint(vendorPoint) ? vendorPoint : null;
  const drop = isRealPoint(dropoffPoint) ? dropoffPoint : null;
  const rider = isRealPoint(riderPoint) ? riderPoint : null;
  // Fit store + drop-off (the rider is always between them or near the store).
  const points = useMemo(() => [store, drop].filter((p): p is MapPoint => p != null), [store, drop]);
  const route = useMemo(() => (store && drop ? curvedPath(store, drop) : null), [store, drop]);

  // Sheet: collapsed shows ~38% of the screen; expanded stops below the
  // floating buttons.
  const peek = Math.round(Math.max(height * 0.38, 280));
  const collapsedY = height - peek;
  const expandedY = insets.top + 64;
  const [expanded, setExpanded] = useState(false);
  const { translateY, headerPan, makePan } = useSnapSheet({
    expandedY,
    collapsedY,
    reducedMotion,
    onSnap: setExpanded,
  });
  const bodyPan = useMemo(() => makePan(!expanded), [makePan, expanded]);

  // Status card rides on the sheet top and fades out as the sheet expands.
  const [cardHeight, setCardHeight] = useState(150);
  const onCardLayout = (e: LayoutChangeEvent) => setCardHeight(Math.round(e.nativeEvent.layout.height));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [collapsedY - 140, collapsedY], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: translateY.value - cardHeight - CARD_GAP }],
  }));

  // Fit both markers between the top buttons and the card + sheet.
  const fit = useCallback(() => {
    if (points.length < 2) return;
    mapRef.current?.fitToCoordinates(points, {
      edgePadding: {
        top: insets.top + 120,
        right: 60,
        bottom: peek + cardHeight + CARD_GAP + 40,
        left: 60,
      },
      animated: !reducedMotion,
    });
  }, [points, insets.top, peek, cardHeight, reducedMotion]);
  // Refit once the card's real height is known.
  useEffect(() => {
    fit();
  }, [fit]);

  const center = points[0] ?? { latitude: 5.6037, longitude: -0.187 };
  const initialRegion = {
    // Single point: nudge the camera so the marker sits above the card.
    latitude: center.latitude - FIT_DELTA * 0.35,
    longitude: center.longitude,
    latitudeDelta: FIT_DELTA,
    longitudeDelta: FIT_DELTA,
  };

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onMapReady={fit}
        showsPointsOfInterests={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        userInterfaceStyle="light"
        accessibilityLabel={`Map from ${vendorName} to your drop-off`}
      >
        {route ? (
          <Polyline
            coordinates={route}
            strokeColor={ROUTE_COLOR}
            strokeWidth={3}
            lineDashPattern={[8, 8]}
            lineCap="round"
          />
        ) : null}
        {drop ? <DropoffMarker point={drop} by={dropoffBy} /> : null}
        {rider ? <RiderMarker point={rider} name={riderName} /> : null}
        {store ? (
          <StoreMarker point={store} name={vendorName} logo={vendorLogo} rating={vendorRating} />
        ) : null}
      </MapView>

      {/* Floating buttons */}
      <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <RoundButton label="Back to order details" onPress={onClose}>
          <Icon name="arrowLeft" size={22} color={colors.text} />
        </RoundButton>
        <RoundButton label="Share order" onPress={onShare}>
          <ExtraIcon name="share" size={20} color={colors.text} />
        </RoundButton>
      </View>

      {/* Status card, riding on the sheet */}
      <Animated.View style={[styles.cardWrap, cardStyle]} pointerEvents="box-none">
        <View style={styles.statusCard} onLayout={onCardLayout}>
          <View style={styles.statusTop}>
            <View style={styles.flex}>
              <Text style={styles.vendor} numberOfLines={1}>
                {vendorName}
              </Text>
              <Text style={styles.title} accessibilityRole="header" accessibilityLiveRegion="polite">
                {title}
              </Text>
              {arrival ? <Text style={[styles.arrival, late && styles.late]}>{arrival}</Text> : null}
              {deadline ? <Text style={styles.deadline}>{deadline}</Text> : null}
            </View>
            <View style={styles.art}>{art}</View>
          </View>
          <View style={[styles.banner, { backgroundColor: tone.bg }]} accessibilityLiveRegion="polite">
            <View style={[styles.dot, { backgroundColor: tone.fg }]} />
            <Text style={[styles.bannerText, { color: tone.fg }]}>{banner}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Details sheet */}
      <Animated.View style={[styles.sheet, { height: height - expandedY }, sheetStyle]}>
        <GestureDetector gesture={headerPan}>
          <View
            style={styles.handleArea}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Order details"
            accessibilityHint="Swipe up for all order details"
          >
            <View style={styles.handle} />
          </View>
        </GestureDetector>
        <GestureDetector gesture={bodyPan}>
          <ScrollView
            scrollEnabled={expanded}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + (height - expandedY - peek) }}
          >
            {children}
          </ScrollView>
        </GestureDetector>
      </Animated.View>
    </View>
  );
}

// Keeps tracksViewChanges on until the content (and image) is snapshotted.
function useSettled(ready: boolean): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(t);
  }, [ready]);
  return settled;
}

function DropoffMarker({ point, by }: { point: MapPoint; by: string | null }) {
  const settled = useSettled(true);
  return (
    <Marker
      coordinate={point}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={!settled}
      zIndex={5}
      accessibilityLabel={by ? `Drop-off by ${by}` : "Your drop-off"}
    >
      <View style={styles.markerWrap}>
        <View style={styles.dropBubble}>
          <Text style={styles.dropSmall} maxFontSizeMultiplier={1.2}>
            {by ? "Dropoff by" : "Your"}
          </Text>
          <Text style={styles.dropBig} maxFontSizeMultiplier={1.2}>
            {by ?? "Drop-off"}
          </Text>
        </View>
        <View style={styles.dropTail} />
        <View style={styles.ring}>
          <View style={styles.ringDot} />
        </View>
      </View>
    </Marker>
  );
}

// Platform rider: green scooter badge. Moves with each position update
// (coordinate prop), no reanimated on the map.
function RiderMarker({ point, name }: { point: MapPoint; name: string | null }) {
  const settled = useSettled(true);
  return (
    <Marker
      coordinate={point}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={!settled}
      zIndex={7}
      accessibilityLabel={name ? `${name}, your rider` : "Your rider"}
    >
      <View style={styles.markerWrap}>
        <View style={styles.rider}>
          <Icon name="delivery" size={18} color={colors.white} />
        </View>
      </View>
    </Marker>
  );
}

function StoreMarker({
  point,
  name,
  logo,
  rating,
}: {
  point: MapPoint;
  name: string;
  logo?: ImageSourcePropType;
  rating?: { value: number; count: number };
}) {
  const [loaded, setLoaded] = useState(logo == null);
  const settled = useSettled(loaded);
  const onLoad = useCallback(() => setLoaded(true), []);
  return (
    <Marker
      coordinate={point}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={!settled}
      zIndex={6}
      accessibilityLabel={`${name}${rating ? `, rated ${rating.value}` : ""}`}
    >
      <View style={styles.markerWrap}>
        <View style={styles.storePill}>
          <View style={styles.storeLogo}>
            {logo ? (
              <RNImage source={logo} style={styles.storeLogoImage} resizeMode="cover" onLoad={onLoad} onError={onLoad} />
            ) : (
              <Icon name="store" size={20} color={colors.primary} />
            )}
          </View>
          <View style={styles.storeText}>
            <Text style={styles.storeName} numberOfLines={1} maxFontSizeMultiplier={1.2}>
              {name}
            </Text>
            {rating ? (
              <Text style={styles.storeRating} maxFontSizeMultiplier={1.2}>
                {`\u2605 ${rating.value.toFixed(1)}`}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={[styles.ring, styles.storeRing]}>
          <View style={styles.ringDot} />
        </View>
      </View>
    </Marker>
  );
}

function RoundButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.round, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const shadow = { boxShadow: "0px 4px 14px rgba(0,0,0,0.14)" } as const;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  cardWrap: {
    position: "absolute",
    top: 0,
    left: 10,
    right: 10,
  },
  statusCard: {
    borderRadius: 20,
    backgroundColor: colors.white,
    overflow: "hidden",
    ...shadow,
  },
  statusTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
  },
  vendor: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: colors.text,
  },
  title: {
    marginTop: 2,
    fontFamily: fontFamily.bold,
    fontSize: 21,
    lineHeight: 27,
    color: colors.text,
  },
  arrival: {
    marginTop: 2,
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: colors.text,
  },
  art: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bannerText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  sheet: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  handleArea: {
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.disabledFill,
  },
  // Markers: padding leaves room for the shadow in the native snapshot.
  markerWrap: {
    alignItems: "center",
    padding: 8,
  },
  dropBubble: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: ROUTE_COLOR,
    alignItems: "flex-start",
  },
  dropSmall: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: colors.white,
  },
  dropBig: {
    fontFamily: fontFamily.bold,
    fontSize: 17,
    color: colors.white,
  },
  dropTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: ROUTE_COLOR,
    marginBottom: 4,
  },
  ring: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: ROUTE_COLOR,
    alignItems: "center",
    justifyContent: "center",
  },
  storeRing: {
    marginTop: 8,
  },
  ringDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ROUTE_COLOR,
  },
  rider: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.success,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  late: {
    color: colors.primary,
  },
  deadline: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  storePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 6,
    paddingRight: 16,
    paddingVertical: 6,
    borderRadius: 32,
    backgroundColor: colors.white,
    maxWidth: 240,
    ...shadow,
  },
  storeLogo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  storeLogoImage: {
    width: "100%",
    height: "100%",
  },
  storeText: {
    flexShrink: 1,
  },
  storeName: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: colors.text,
  },
  storeRating: {
    marginTop: 2,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.text,
  },
  pressed: {
    opacity: 0.7,
  },
});
