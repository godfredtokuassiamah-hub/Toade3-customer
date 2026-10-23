// "More info" full-screen sheet: name, allergy note, hours / call / map
// rows, map preview, Get directions, service types and the rating block.
//
// Presentation: the shared BottomSheet at full height (topGapRatio 0, so it
// starts just under the status bar). It slides up with a 300 ms ease-out
// timing (no spring), only fades under Reduce Motion, closes on Android back
// (Modal onRequestClose), the VoiceOver escape gesture, a swipe down on the
// top bar (handle + header are the drag area) or the back arrow. The root
// Stack is owned by another workflow, so no router modal presentation.
//
// Rows with missing MOCK data are hidden (infoRowVisibility). Linking
// failures fall back to an Alert with the number/address (openExternal).
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { MockVendor } from "../../lib/discovery/types";
import {
  addressLine,
  coordinatesText,
  directionsUrls,
  hoursRange,
  infoRowVisibility,
  mapUrls,
  openStatusTitle,
  ratingBasisText,
  serviceTypeLabels,
  telUrl,
  toMapsPlatform,
  vendorCoordinates,
} from "../../lib/storefront/vendorInfo";
import { colors, fontFamily } from "../../theme";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";
import { SIDE } from "./metrics";
import { openExternal } from "./openExternal";
import { StoreGlyph } from "./StoreGlyph";
import { VendorMapPreview } from "./VendorMapPreview";

type Props = {
  visible: boolean;
  vendor: MockVendor;
  // vendorOpenAt(vendor, now), computed by the storefront screen.
  open: boolean;
  onClose: () => void;
  // The storefront header's share action (same message).
  onShare: () => void;
};

const ICON = 24;
const ALLERGY_NOTE =
  "Get in touch with the venue if you have allergies to learn about their ingredients and cooking methods.";

export function InfoSheet({ visible, vendor, open, onClose, onShare }: Props) {
  const insets = useSafeAreaInsets();
  const platform = toMapsPlatform(Platform.OS);
  const show = infoRowVisibility(vendor);
  const coords = vendorCoordinates(vendor);
  const address = addressLine(vendor);
  const statusTitle = openStatusTitle(vendor, open);
  const range = hoursRange(vendor.hours);
  const services = serviceTypeLabels(vendor.serviceTypes);
  const tel = telUrl(vendor.phone);

  const mapsFailed = () => {
    const lines = [vendor.addressLabel?.trim(), coords ? coordinatesText(coords) : null].filter(
      Boolean,
    );
    Alert.alert("Couldn't open maps", lines.join("\n") || vendor.name);
  };

  const onCall = () => {
    if (!tel) return;
    void openExternal({ primary: tel }, () =>
      Alert.alert("Can't start a call", `Call ${vendor.name} on ${vendor.phone}.`),
    );
  };

  const onViewMap = () => {
    const urls = mapUrls(vendor, platform);
    if (urls) void openExternal(urls, mapsFailed);
  };

  const onDirections = () => {
    if (coords) void openExternal(directionsUrls(coords, vendor.name, platform), mapsFailed);
  };

  const onRatingInfo = () =>
    Alert.alert(
      "Ratings",
      "Ratings come from customers who ordered from this venue. These are sample ratings for now.",
    );

  const header = (
    <View style={styles.topBar}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}
      >
        <Icon name="arrowLeft" size={22} color={colors.text} weight="medium" />
      </Pressable>
      <Pressable
        onPress={onShare}
        accessibilityRole="button"
        accessibilityLabel={`Share ${vendor.name}`}
        style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}
      >
        <StoreGlyph name="share" size={22} color={colors.text} weight="medium" />
      </Pressable>
    </View>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      header={header}
      accessibilityLabel={`About ${vendor.name}`}
      // "dim": no blur, and the drag spring-back never overshoots (no bounce).
      backdrop="dim"
      topGapRatio={0}
    >
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.name} accessibilityRole="header">
          {vendor.name}
        </Text>
        <Text style={styles.note}>{ALLERGY_NOTE}</Text>

        <View style={styles.rows}>
          <View
            style={styles.row}
            accessible
            accessibilityLabel={`${statusTitle}, hours ${range}`}
          >
            <Icon name="clock" filled size={ICON} color={colors.text} />
            <RowText title={statusTitle} subtitle={range} />
          </View>

          {show.call && vendor.phone ? (
            <Pressable
              onPress={onCall}
              accessibilityRole="button"
              accessibilityLabel={`Call ${vendor.name}, ${vendor.phone}`}
              style={({ pressed }) => [styles.row, styles.rowDivider, pressed && styles.pressed]}
            >
              <StoreGlyph name="phone" size={ICON} color={colors.text} />
              <RowText title="Call us" subtitle={vendor.phone} />
            </Pressable>
          ) : null}

          {show.address && address ? (
            <Pressable
              onPress={onViewMap}
              accessibilityRole="button"
              accessibilityLabel={`Open map for ${vendor.name}`}
              accessibilityHint={address}
              style={({ pressed }) => [styles.row, styles.rowDivider, pressed && styles.pressed]}
            >
              <Icon name="pin" filled size={ICON} color={colors.text} />
              <RowText title="View map" subtitle={address} />
            </Pressable>
          ) : null}
        </View>

        {show.map && coords ? (
          <>
            <VendorMapPreview coords={coords} onPress={onDirections} />
            <Pressable
              onPress={onDirections}
              accessibilityRole="button"
              accessibilityLabel={`Get directions to ${vendor.name}`}
              style={({ pressed }) => [styles.directions, pressed && styles.pressed]}
            >
              <Icon name="navigation" filled size={20} color={colors.text} />
              <Text style={styles.directionsText}>Get directions</Text>
            </Pressable>
          </>
        ) : null}

        {show.services ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Service types
            </Text>
            {services.map((label) => (
              <Text key={label} style={styles.bullet}>
                {"\u2022"} {label}
              </Text>
            ))}
          </View>
        ) : null}

        {show.rating && vendor.rating ? (
          <View style={styles.ratingRow}>
            <View
              style={styles.ratingGroup}
              accessible
              accessibilityLabel={`Rated ${vendor.rating.value.toFixed(1)} out of 5, ${ratingBasisText(vendor.rating.count)}`}
            >
              <View style={styles.ratingSquare}>
                <Text style={styles.ratingValue}>{vendor.rating.value.toFixed(1)}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Rating</Text>
                <Text style={styles.rowSubtitle}>{ratingBasisText(vendor.rating.count)}</Text>
              </View>
            </View>
            <Pressable
              onPress={onRatingInfo}
              accessibilityRole="button"
              accessibilityLabel="About ratings"
              style={({ pressed }) => [styles.infoButton, pressed && styles.pressed]}
            >
              <StoreGlyph name="info" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

function RowText({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.rowText}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowSubtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SIDE - 12,
    paddingBottom: 4,
  },
  topButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    paddingHorizontal: SIDE,
    paddingTop: 4,
  },
  name: {
    fontFamily: fontFamily.bold,
    fontSize: 28,
    color: colors.text,
  },
  note: {
    marginTop: 8,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  rows: {
    marginTop: 12,
    marginBottom: 16,
  },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 12,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: colors.text,
  },
  rowSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
  directions: {
    marginTop: 12,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  directionsText: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: colors.text,
  },
  section: {
    marginTop: 28,
    gap: 6,
  },
  sectionTitle: {
    marginBottom: 2,
    fontFamily: fontFamily.semibold,
    fontSize: 18,
    color: colors.text,
  },
  bullet: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  ratingRow: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ratingGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  ratingSquare: {
    // min sizes, so large text grows the square instead of clipping.
    minWidth: 64,
    minHeight: 64,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingValue: {
    fontFamily: fontFamily.bold,
    fontSize: 24,
    color: colors.text,
  },
  infoButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
});
