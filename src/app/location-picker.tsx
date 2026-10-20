// Delivery location picker: full-screen map with a fixed centre pin and a
// draggable two-snap sheet (collapsed ~45% / expanded full screen).
//
// Map: react-native-maps default provider (Apple Maps on iOS, Google on
// Android), included in Expo Go. The pin is a static overlay at the map
// view's centre, so the region centre reported by onRegionChangeComplete is
// the pinned point. No map layout prop is ever animated.
import { router } from "expo-router";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import MapView, { type Region } from "react-native-maps";
import Animated, { useAnimatedStyle, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddressRow } from "../components/location/AddressRow";
import { CenterPin } from "../components/location/CenterPin";
import { useSnapSheet } from "../components/location/useSnapSheet";
import { Icon } from "../components/ui/Icon";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { lightHaptic, successHaptic } from "../lib/haptics";
import { useDeliveryAddress } from "../lib/location/DeliveryAddressContext";
import {
  DEV_SEED_RECENTS,
  type DeliveryAddress,
  distanceMeters,
} from "../lib/location/deliveryAddress";
import { reverseGeocode, searchAddresses } from "../lib/location/geocode";
import { shortPlusCode } from "../lib/location/plusCode";
import { colors, fontFamily } from "../theme";

const ACCRA = { latitude: 5.6037, longitude: -0.187 };
const DELTA = { latitudeDelta: 0.01, longitudeDelta: 0.01 };
const RADIUS = 24;
const REVERSE_DEBOUNCE_MS = 400;
const SEARCH_DEBOUNCE_MS = 500;
const SEARCH_MIN_CHARS = 3;
const MAP_ANIM_MS = 350;
// Region-change ends this close to a programmatic target count as ours.
const TARGET_MATCH_M = 5;
// Pin this close to the user counts as "current location".
const CURRENT_MATCH_M = 15;
const FOOTER_BODY = 56 + 24;

type Coords = { latitude: number; longitude: number };
type Permission = "pending" | "granted" | "denied";
type Selection =
  | { kind: "current" }
  | { kind: "pin" }
  | { kind: "address"; address: DeliveryAddress };
type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "done"; results: DeliveryAddress[] };

function withPlusCode(a: DeliveryAddress): DeliveryAddress {
  return a.plusCode ? a : { ...a, plusCode: shortPlusCode(a.latitude, a.longitude) };
}

export default function LocationPicker() {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { active, recents, confirmAddress } = useDeliveryAddress();

  // Sheet geometry: collapsed shows ~45% of the screen, expanded reaches the
  // safe-area top. The map ends RADIUS below the collapsed sheet top (so the
  // rounded corners show map) and the pin sits at the map view's centre.
  const sheetVisible = Math.round(Math.min(height * 0.6, Math.max(height * 0.45, 360)));
  const collapsedY = height - sheetVisible;
  const expandedY = insets.top;
  const mapHeight = collapsedY + RADIUS;

  const [expanded, setExpanded] = useState(false);
  const { translateY, headerPan, makePan, snapTo } = useSnapSheet({
    expandedY,
    collapsedY,
    reducedMotion,
    onSnap: setExpanded,
  });
  const bodyPan = useMemo(() => makePan(!expanded), [makePan, expanded]);
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  // 56 = 44pt button + 12pt gap above the sheet edge.
  const recenterStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value - 56 }],
  }));

  const setSheet = useCallback(
    (next: boolean) => {
      setExpanded(next);
      snapTo(next);
    },
    [snapTo],
  );

  // ---- Map / pin ----------------------------------------------------------
  const [initialCenter] = useState<Coords>(() => active ?? ACCRA);
  const mapRef = useRef<MapView>(null);
  const deltaRef = useRef(DELTA);
  // The first region-change (initial region) is ours, not a user pan.
  const targetRef = useRef<Coords | null>(initialCenter);
  const [pin, setPin] = useState<Coords>(initialCenter);
  const pinCode = useMemo(() => shortPlusCode(pin.latitude, pin.longitude), [pin]);
  const [selection, setSelection] = useState<Selection>(
    active ? { kind: "address", address: active } : { kind: "pin" },
  );

  // Reverse geocode of the pin (debounced, stale results dropped).
  const [resolved, setResolved] = useState<DeliveryAddress | null>(null);
  const [resolving, setResolving] = useState(false);
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reverseSeq = useRef(0);

  const resolvePin = useCallback((c: Coords) => {
    if (reverseTimer.current) clearTimeout(reverseTimer.current);
    const seq = ++reverseSeq.current;
    setResolved(null);
    setResolving(true);
    reverseTimer.current = setTimeout(() => {
      void reverseGeocode(c.latitude, c.longitude).then((addr) => {
        if (seq !== reverseSeq.current) return;
        setResolved(addr);
        setResolving(false);
      });
    }, REVERSE_DEBOUNCE_MS);
  }, []);

  const moveMapTo = useCallback((c: Coords) => {
    targetRef.current = c;
    mapRef.current?.animateToRegion({ ...c, ...deltaRef.current }, MAP_ANIM_MS);
  }, []);

  // ---- Permission + user location -----------------------------------------
  const [permission, setPermission] = useState<Permission>("pending");
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const userCoordsRef = useRef<Coords | null>(null);
  const selectionRef = useRef(selection);
  useEffect(() => {
    selectionRef.current = selection;
    userCoordsRef.current = userCoords;
  });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== "granted") {
          setPermission("denied");
          return;
        }
        setPermission("granted");
        const last = await Location.getLastKnownPositionAsync();
        const pos =
          last ??
          (await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }));
        if (cancelled) return;
        const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setUserCoords(c);
        // Centre on the user unless they already picked something.
        if (selectionRef.current.kind === "pin" && !active) {
          setSelection({ kind: "current" });
          moveMapTo(c);
        }
      } catch {
        if (!cancelled) setPermission((p) => (p === "pending" ? "denied" : p));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // Mount only: ask once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRegionChangeComplete = useCallback(
    (region: Region) => {
      deltaRef.current = {
        latitudeDelta: region.latitudeDelta,
        longitudeDelta: region.longitudeDelta,
      };
      const c = { latitude: region.latitude, longitude: region.longitude };
      setPin(c);
      const target = targetRef.current;
      targetRef.current = null;
      const ours = target != null && distanceMeters(target, c) < TARGET_MATCH_M;
      let next = selectionRef.current;
      if (!ours) {
        const user = userCoordsRef.current;
        next =
          user && distanceMeters(user, c) < CURRENT_MATCH_M
            ? { kind: "current" }
            : { kind: "pin" };
        setSelection(next);
      }
      if (next.kind !== "address") resolvePin(c);
    },
    [resolvePin],
  );

  // Resolve the initial pin even if no initial region-change event fires.
  const onMapReady = useCallback(() => {
    if (selectionRef.current.kind !== "address") resolvePin(initialCenter);
  }, [resolvePin, initialCenter]);

  const selectCurrent = useCallback(() => {
    lightHaptic();
    const user = userCoordsRef.current;
    if (!user) return;
    setSelection({ kind: "current" });
    moveMapTo(user);
    Keyboard.dismiss();
    setSheet(false);
  }, [moveMapTo, setSheet]);

  const selectAddress = useCallback(
    (address: DeliveryAddress) => {
      lightHaptic();
      setSelection({ kind: "address", address });
      moveMapTo(address);
      Keyboard.dismiss();
      setSheet(false);
    },
    [moveMapTo, setSheet],
  );

  // ---- Search ------------------------------------------------------------
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);

  const onChangeQuery = useCallback((text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const seq = ++searchSeq.current;
    const q = text.trim();
    if (q.length < SEARCH_MIN_CHARS) {
      setSearch({ status: "idle" });
      return;
    }
    setSearch({ status: "loading" });
    searchTimer.current = setTimeout(() => {
      searchAddresses(q).then(
        (results) => {
          if (seq === searchSeq.current) setSearch({ status: "done", results });
        },
        () => {
          if (seq === searchSeq.current) setSearch({ status: "error" });
        },
      );
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  useEffect(
    () => () => {
      if (reverseTimer.current) clearTimeout(reverseTimer.current);
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  // ---- Keyboard: hide the pinned CTA while typing -------------------------
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // ---- Confirm -----------------------------------------------------------
  const candidate: DeliveryAddress | null =
    selection.kind === "address" ? withPlusCode(selection.address) : resolved;
  const confirmBusy = selection.kind !== "address" && resolving;
  const [saving, setSaving] = useState(false);

  const onConfirm = useCallback(async () => {
    if (!candidate || saving) return;
    setSaving(true);
    await confirmAddress(candidate);
    successHaptic();
    router.back();
  }, [candidate, saving, confirmAddress]);

  // DEV-ONLY: show the mock rows when there are no real recents.
  const recentRows = recents.length > 0 ? recents : __DEV__ ? DEV_SEED_RECENTS : [];
  const searching = query.trim().length >= SEARCH_MIN_CHARS;
  const userCode = userCoords ? shortPlusCode(userCoords.latitude, userCoords.longitude) : null;
  const currentSelected = selection.kind === "current";
  const selectedId = selection.kind === "address" ? selection.address.id : null;
  const footerHeight = FOOTER_BODY + Math.max(insets.bottom, 12);

  return (
    <GestureHandlerRootView style={styles.fill}>
      <StatusBar style="dark" />
      <MapView
        ref={mapRef}
        style={[styles.map, { height: mapHeight }]}
        initialRegion={{ ...initialCenter, ...DELTA }}
        onRegionChangeComplete={onRegionChangeComplete}
        onMapReady={onMapReady}
        showsUserLocation={permission === "granted"}
        showsMyLocationButton={false}
        showsPointsOfInterests={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        mapType="standard"
        userInterfaceStyle="light"
      />
      <CenterPin x={width / 2} y={mapHeight / 2} label={pinCode} />

      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={4}
        style={({ pressed }) => [
          styles.roundButton,
          { top: insets.top + 8, left: 16 },
          pressed && styles.pressed,
        ]}
      >
        <Icon name="close" size={20} color={colors.text} weight="semibold" />
      </Pressable>

      {/* Outside the sheet so it stays tappable on Android (touches outside a
          parent's bounds are dropped there); follows the sheet edge. */}
      {permission === "granted" && userCoords && !expanded ? (
        <Animated.View style={[styles.recenterWrap, recenterStyle]}>
          <Pressable
            onPress={selectCurrent}
            accessibilityRole="button"
            accessibilityLabel="Recenter on my location"
            hitSlop={4}
            style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
          >
            <Icon name="recenter" size={20} color={colors.text} />
          </Pressable>
        </Animated.View>
      ) : null}

      <Animated.View style={[styles.sheet, { height: height - expandedY }, sheetStyle]}>
        <GestureDetector gesture={headerPan}>
          <View collapsable={false} style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.titleRow}>
              <Text style={styles.title} accessibilityRole="header">
                Set delivery address
              </Text>
              {expanded ? (
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    setSheet(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Show map"
                  hitSlop={8}
                  style={({ pressed }) => [styles.collapse, pressed && styles.pressed]}
                >
                  <Icon name="chevronDown" size={18} color={colors.text} weight="semibold" />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.search}>
              <Icon name="search" size={18} color={colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={onChangeQuery}
                onFocus={() => setSheet(true)}
                placeholder="Enter a new address"
                placeholderTextColor={colors.placeholder}
                style={styles.searchInput}
                returnKeyType="search"
                autoCorrect={false}
                accessibilityLabel="Search for an address"
              />
              {query ? (
                <Pressable
                  onPress={() => onChangeQuery("")}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  hitSlop={12}
                >
                  <Icon name="close" size={16} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          </View>
        </GestureDetector>

        <KeyboardAvoidingView
          behavior="padding"
          keyboardVerticalOffset={expandedY}
          style={styles.fill}
        >
          <GestureDetector gesture={bodyPan}>
            <ScrollView
              style={styles.fill}
              contentContainerStyle={{ paddingBottom: keyboardOpen ? 16 : footerHeight + 16 }}
              scrollEnabled={expanded}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            >
              {searching ? (
                <SearchResults
                  state={search}
                  selectedId={selectedId}
                  onSelect={selectAddress}
                />
              ) : (
                <>
                  {permission === "denied" ? (
                    <View style={styles.notice}>
                      <Text style={styles.noticeText}>
                        Location is off. Search for an address or move the map.
                      </Text>
                      <Pressable
                        onPress={() => void Linking.openSettings()}
                        accessibilityRole="button"
                        accessibilityLabel="Open Settings to turn on location"
                        style={({ pressed }) => [styles.noticeButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.noticeButtonText}>Open Settings</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <AddressRow
                      variant="current"
                      title={userCode ?? "Finding your location…"}
                      subtitle="Current location"
                      selected={currentSelected && userCode != null}
                      onPress={selectCurrent}
                      accessibilityHint="Moves the pin to where you are"
                    />
                  )}
                  {recentRows.map((a) => (
                    <AddressRow
                      key={a.id}
                      variant="address"
                      title={a.title}
                      subtitle={a.subtitle}
                      selected={selectedId === a.id}
                      onPress={() => selectAddress(a)}
                    />
                  ))}
                </>
              )}
            </ScrollView>
          </GestureDetector>
        </KeyboardAvoidingView>
      </Animated.View>

      {keyboardOpen ? null : (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <PrimaryButton
            label="Confirm location"
            onPress={() => void onConfirm()}
            disabled={!candidate}
            loading={confirmBusy || saving}
            accessibilityLabel={
              candidate ? `Confirm location, ${candidate.title}` : "Confirm location"
            }
          />
        </View>
      )}
    </GestureHandlerRootView>
  );
}

function SearchResults({
  state,
  selectedId,
  onSelect,
}: {
  state: SearchState;
  selectedId: string | null;
  onSelect: (a: DeliveryAddress) => void;
}) {
  if (state.status === "loading" || state.status === "idle") {
    return <Text style={styles.status}>Searching…</Text>;
  }
  if (state.status === "error") {
    return (
      <Text style={styles.status} accessibilityLiveRegion="polite">
        {"Couldn't search right now. Check your connection or move the map."}
      </Text>
    );
  }
  if (state.results.length === 0) {
    return (
      <Text style={styles.status} accessibilityLiveRegion="polite">
        No results
      </Text>
    );
  }
  return (
    <>
      {state.results.map((a) => (
        <AddressRow
          key={a.id}
          variant="address"
          title={a.title}
          subtitle={a.subtitle}
          selected={selectedId === a.id}
          onPress={() => onSelect(a)}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  map: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  roundButton: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  recenterWrap: {
    position: "absolute",
    top: 0,
    right: 16,
    width: 44,
    height: 44,
  },
  pressed: {
    opacity: 0.7,
  },
  sheet: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    backgroundColor: colors.disabledFill,
  },
  titleRow: {
    marginTop: 14,
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    color: colors.text,
  },
  collapse: {
    width: 48,
    height: 48,
    marginRight: -12,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    marginTop: 12,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: 52,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: colors.text,
  },
  status: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
  notice: {
    marginHorizontal: 20,
    marginVertical: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    gap: 10,
  },
  noticeText: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  noticeButton: {
    alignSelf: "flex-start",
    minHeight: 48,
    justifyContent: "center",
  },
  noticeButtonText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.primary,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
  },
});
