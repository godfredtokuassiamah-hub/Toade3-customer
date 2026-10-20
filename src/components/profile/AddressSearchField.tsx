// Address type-ahead for the profile setup flow. Suggestions render inline
// under the field (not in a BottomSheet): the screen's only job is the
// address, so a modal would duplicate the input, move focus into a separate
// window and drop the keyboard. Inline keeps screen-reader order linear and
// fits KeyboardAwareScreen. Rows are mapped (max 6), not a FlatList, to avoid
// nesting a VirtualizedList inside the ScrollView.
import { type Ref, useEffect } from "react";
import {
  AccessibilityInfo,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  type TextInput,
  View,
} from "react-native";

import { selectionHaptic } from "../../lib/haptics";
import type { LatLng, PlaceSuggestion } from "../../lib/places/types";
import { DEFAULT_BIAS, PLACES_MIN_CHARS, searchPlaces } from "../../services/places";
import { colors, fontFamily, text } from "../../theme";
import { AddressRow } from "../location/AddressRow";
import { useDebouncedRequest } from "../search/useDebouncedRequest";
import { FloatingLabelInput } from "../ui/FloatingLabelInput";

const DEBOUNCE_MS = 300;
const MAX_ROWS = 6;
const OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright";

export const SUGGESTIONS_ERROR = "Couldn't load suggestions. Check your connection.";
const NO_MATCHES = "No matches. Try a street, area or landmark.";

type SearchParams = { q: string; lat: number; lng: number };

// Module-level so useDebouncedRequest gets a stable function.
const runPlaceSearch = (p: SearchParams, signal: AbortSignal) =>
  searchPlaces(p.q, { bias: { lat: p.lat, lng: p.lng }, signal });

export type LocationNotice = { message: string; canOpenSettings: boolean };

type Props = {
  query: string;
  onChangeQuery: (q: string) => void;
  // Search bias; null -> the service default (Accra).
  bias: LatLng | null;
  onSelect: (place: PlaceSuggestion) => void;
  onUseCurrentLocation: () => void;
  locating: boolean;
  locationNotice: LocationNotice | null;
  editable?: boolean;
  inputRef?: Ref<TextInput>;
};

export function AddressSearchField({
  query,
  onChangeQuery,
  bias,
  onSelect,
  onUseCurrentLocation,
  locating,
  locationNotice,
  editable = true,
  inputRef,
}: Props) {
  const q = query.trim();
  const b = bias ?? DEFAULT_BIAS;
  // Bias rounded to ~100 m so small GPS drift doesn't refetch.
  const params: SearchParams | null =
    q.length >= PLACES_MIN_CHARS
      ? { q, lat: Number(b.lat.toFixed(3)), lng: Number(b.lng.toFixed(3)) }
      : null;
  const request = useDebouncedRequest(params, runPlaceSearch, DEBOUNCE_MS);
  const active = params !== null;
  const results = (request.data ?? []).slice(0, MAX_ROWS);
  const showError = active && request.error;
  const showEmpty = active && !request.pending && !request.error && results.length === 0;
  const showRows = active && !request.error && results.length > 0;

  useEffect(() => {
    if (showError) AccessibilityInfo.announceForAccessibility(SUGGESTIONS_ERROR);
  }, [showError]);

  return (
    <View>
      <FloatingLabelInput
        label="Search your address"
        inputRef={inputRef}
        value={query}
        onChangeText={onChangeQuery}
        editable={editable}
        autoCorrect={false}
        autoCapitalize="words"
        autoComplete="street-address"
        textContentType="fullStreetAddress"
        returnKeyType="search"
        maxLength={120}
        accessibilityHint="Type at least 3 letters to see suggestions"
        testID="address-search-input"
      />
      <View style={styles.list}>
        <AddressRow
          variant="current"
          role="button"
          title="Use my current location"
          subtitle="Find me with GPS"
          loading={locating}
          disabled={!editable}
          onPress={onUseCurrentLocation}
          accessibilityHint="Asks for location permission and fills in your address"
        />
      </View>
      {locationNotice ? (
        <View style={styles.notice}>
          <Text style={[text.caption, styles.noticeText]}>{locationNotice.message}</Text>
          {locationNotice.canOpenSettings ? (
            <Pressable
              onPress={() => void Linking.openSettings()}
              accessibilityRole="button"
              accessibilityLabel="Open Settings to turn on location"
              style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
            >
              <Text style={styles.textButtonLabel}>Open settings</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {active && request.pending && !showError ? (
        <Text
          style={[text.caption, styles.status]}
          accessibilityLiveRegion="polite"
        >
          Searching…
        </Text>
      ) : null}
      {showError ? (
        <View style={styles.notice}>
          <Text style={[text.caption, styles.errorText]} accessibilityRole="alert">
            {SUGGESTIONS_ERROR}
          </Text>
          <Pressable
            onPress={request.retry}
            accessibilityRole="button"
            accessibilityLabel="Retry loading suggestions"
            style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
          >
            <Text style={styles.textButtonLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      {showEmpty ? (
        <Text style={[text.caption, styles.status]} accessibilityLiveRegion="polite">
          {NO_MATCHES}
        </Text>
      ) : null}
      {showRows ? (
        <View style={styles.list}>
          {results.map((place) => (
            <AddressRow
              key={place.id}
              variant="address"
              role="button"
              title={place.title}
              subtitle={place.subtitle}
              disabled={!editable}
              onPress={() => {
                selectionHaptic();
                onSelect(place);
              }}
            />
          ))}
        </View>
      ) : null}
      {showRows || showEmpty ? (
        // ODbL attribution for OpenStreetMap data (via Photon).
        <Pressable
          onPress={() => void Linking.openURL(OSM_COPYRIGHT_URL)}
          accessibilityRole="link"
          accessibilityLabel="Map data © OpenStreetMap contributors"
          accessibilityHint="Opens the OpenStreetMap copyright page"
          style={({ pressed }) => [styles.attribution, pressed && styles.pressed]}
        >
          <Text style={styles.attributionText}>© OpenStreetMap contributors</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Rows are edge to edge inside the 14pt sheet padding.
  list: {
    marginTop: 8,
    marginHorizontal: -14,
  },
  notice: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: 8,
  },
  noticeText: {
    flexShrink: 1,
    color: colors.textMuted,
  },
  errorText: {
    flexShrink: 1,
    color: colors.error,
  },
  status: {
    marginTop: 8,
    color: colors.textMuted,
  },
  textButton: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  textButtonLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.primary,
  },
  attribution: {
    minHeight: 48,
    justifyContent: "center",
    alignSelf: "flex-end",
    paddingHorizontal: 4,
  },
  attributionText: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.7,
  },
});
