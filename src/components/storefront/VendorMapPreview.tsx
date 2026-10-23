// Static map preview for the "More info" sheet, centred on the vendor.
// react-native-maps is "Included in Expo Go" for SDK 57
// (https://docs.expo.dev/versions/v57.0.0/sdk/map-view/), default provider
// (Apple Maps on iOS, Google on Android; no key needed in Expo Go).
//
// - Gestures off and pointerEvents "none" on the map, so it never traps the
//   sheet's scroll; a transparent Pressable on top opens directions.
// - Lite mode on Android (a bitmap, cheap inside a scroll view).
// - The marker is a centred overlay (the map can't move, so the centre is
//   always the vendor): no native marker snapshotting.
// - Hidden from screen readers: the "Get directions" button below does the
//   same thing and is labelled.
import { Platform, Pressable, StyleSheet, View } from "react-native";
import MapView from "react-native-maps";

import type { Coordinates } from "../../lib/discovery/types";
import { colors } from "../../theme";
import { Icon } from "../ui/Icon";

const HEIGHT = 200;
const DELTA = 0.006;
const MARKER = 40;

type Props = {
  coords: Coordinates;
  onPress: () => void;
};

export function VendorMapPreview({ coords, onPress }: Props) {
  return (
    <View
      style={styles.frame}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={{ ...coords, latitudeDelta: DELTA, longitudeDelta: DELTA }}
          liteMode={Platform.OS === "android"}
          scrollEnabled={false}
          zoomEnabled={false}
          zoomTapEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          showsPointsOfInterests={false}
          showsCompass={false}
          mapType="standard"
          userInterfaceStyle="light"
        />
        <View style={styles.markerWrap}>
          <View style={styles.marker}>
            <Icon name="store" filled size={20} color={colors.white} />
          </View>
        </View>
      </View>
      <Pressable
        onPress={onPress}
        accessible={false}
        style={({ pressed }) => [StyleSheet.absoluteFill, pressed && styles.pressed]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: HEIGHT,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
  },
  markerWrap: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  marker: {
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    backgroundColor: colors.text,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    backgroundColor: "rgba(0,0,0,0.06)",
  },
});
