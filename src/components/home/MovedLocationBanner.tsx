// "You've moved" card under the Home top bar. When the device is 500 m+
// from the confirmed delivery address (lib/location/movedPrompt), offer to
// deliver to the current position instead. Never switches on its own: the
// confirmed address is where orders go, so the user decides.
//
// - "Deliver here" confirms the current position as the delivery address
//   (same path as the location picker: becomes active + first recent).
// - The close button keeps the current address and silences the prompt
//   until the user moves another 500 m. The dismissed point is stored in
//   AsyncStorage so it survives restarts.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useDeliveryAddress } from "../../lib/location/DeliveryAddressContext";
import {
  liveToAddress,
  type LivePlace,
  parsePoint,
  type Point,
  shouldOfferMove,
} from "../../lib/location/movedPrompt";
import { lightHaptic, successHaptic } from "../../lib/haptics";
import { colors, fontFamily } from "../../theme";
import { Icon } from "../ui/Icon";

const DISMISSED_KEY = "toade3.movedPromptDismissedAt";

export function MovedLocationBanner({ livePlace }: { livePlace: LivePlace | null }) {
  const { active, ready, confirmAddress } = useDeliveryAddress();
  // undefined = not read yet (render nothing until storage answers).
  const [dismissedAt, setDismissedAt] = useState<Point | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(DISMISSED_KEY)
      .then((raw) => {
        if (!cancelled) setDismissedAt(parsePoint(raw));
      })
      .catch(() => {
        if (!cancelled) setDismissedAt(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onUseHere = useCallback(async () => {
    if (!livePlace || saving) return;
    setSaving(true);
    successHaptic();
    try {
      await confirmAddress(liveToAddress(livePlace));
    } finally {
      setSaving(false);
    }
  }, [livePlace, saving, confirmAddress]);

  const onDismiss = useCallback(() => {
    if (!livePlace) return;
    lightHaptic();
    const point = { latitude: livePlace.lat, longitude: livePlace.lng };
    setDismissedAt(point);
    void AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(point)).catch(() => {
      // Storage failure: still dismissed for this session.
    });
  }, [livePlace]);

  if (!ready || dismissedAt === undefined) return null;
  if (!shouldOfferMove({ active, live: livePlace, dismissedAt })) return null;
  if (!livePlace || !active) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.card} accessibilityLiveRegion="polite">
        <View style={styles.icon}>
          <Icon name="pin" size={16} color={colors.primary} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {`You're near ${livePlace.shortLabel}`}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {`Delivering to ${active.title}`}
          </Text>
        </View>
        <Pressable
          onPress={onUseHere}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={`Deliver to ${livePlace.shortLabel} instead`}
          accessibilityState={{ disabled: saving, busy: saving }}
          style={({ pressed }) => [styles.use, (pressed || saving) && styles.pressed]}
        >
          <Text style={styles.useText}>Deliver here</Text>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={`Keep delivering to ${active.title}`}
          hitSlop={10}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Icon name="close" size={14} color={colors.textMuted} weight="semibold" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    backgroundColor: colors.white,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 8,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
  },
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.text,
  },
  subtitle: {
    marginTop: 1,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  use: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  useText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: colors.white,
  },
  close: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
});
