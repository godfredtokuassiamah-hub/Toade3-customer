// Order tracking screen body (order/[id].tsx once "Track order" is tapped,
// or when an order is opened later). Layout follows the design mockups:
//
//   header: back, vendor name (fades in on scroll), share, map
//   hero:   store art, vendor name, status title, arrival window, banner,
//           4-step progress
//   cards:  Order #N (collapsible items + price breakdown), Delivery to,
//           Ordered from (View menu / Call / Get directions), Need help?
//   footer actions: Get help, Cancel order
//
// Cancel logic (lib/orders/orderTracking): enabled ONLY while the order is
// pending (waiting for the store). Once the store accepts, the button is
// disabled and "Why I can't cancel the order?" explains why. Cancelling asks
// for confirmation and sends the version the user saw, so a race with the
// store accepting returns STALE_VERSION and a clear message instead.
import { Image } from "expo-image";
import { router } from "expo-router";
import { type ReactNode, useEffect, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  BackHandler,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getItemsByIds, getVendorById } from "../../data/mock/catalog";
import { getVendorLocation } from "../../data/mock/vendorLocations";
import { useCancelOrder } from "../../hooks/useMyOrders";
import { formatMinorFixed } from "../../lib/discovery/money";
import { errorHaptic, lightHaptic, successHaptic } from "../../lib/haptics";
import { shortOrderRef } from "../../lib/orders/orderPlaced";
import {
  acceptDeadlineText,
  canCancel,
  cancelErrorMessage,
  etaLabels,
  isRealPoint,
  stepIndex,
  TRACKING_STEPS,
  type TrackingTone,
  trackingCopy,
  WAITING_ILLUSTRATION_URL,
} from "../../lib/orders/orderTracking";
import {
  addressLine,
  directionsUrls,
  telUrl,
  toMapsPlatform,
  vendorCoordinates,
} from "../../lib/storefront/vendorInfo";
import type { OrderDetail, OrderTracking } from "../../services/orders";
import { colors, fontFamily } from "../../theme";
import { openExternal } from "../storefront/openExternal";
import { ExtraIcon } from "../ui/ExtraIcon";
import { Icon } from "../ui/Icon";
import { OrderTrackingMap } from "./OrderTrackingMap";

const SIDE = 16;
const HEADER_TITLE_AFTER = 140;

const TONE: Record<TrackingTone, { bg: string; fg: string }> = {
  waiting: { bg: colors.primaryLight, fg: colors.primary },
  active: { bg: "#E7F5EC", fg: colors.success },
  done: { bg: "#E7F5EC", fg: colors.success },
  error: { bg: "#FDECEA", fg: colors.error },
};

type Props = {
  order: OrderDetail;
  // Live timeline + ETA (server when 0010 is deployed, else estimated on the
  // device with the same model).
  tracking: OrderTracking;
  // Refetch in flight (background poll): shows a small spinner, never blocks.
  refreshing: boolean;
  onBack: () => void;
};

export function OrderTrackingView({ order, tracking, refreshing, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const platform = toMapsPlatform(Platform.OS);
  // Clock for the accept-deadline line; ticks so it disappears on time.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const vendor = getVendorById(order.vendorId);
  const vendorName = order.vendorName || vendor?.name || "Store";
  // Whichever source has seen the newer version wins (both are polled).
  const live = tracking.version >= order.version;
  const status = live ? tracking.status : order.status;
  const version = live ? tracking.version : order.version;
  const rider = live ? tracking.rider : null;
  const copy = trackingCopy(status, vendorName, {
    rider: rider?.name,
    rejectReason: live ? tracking.rejectReason : null,
  });
  const tone = TONE[copy.tone];
  const step = stepIndex(status);
  const labels = etaLabels(live ? tracking.eta : { kind: "none" });
  const arrival = labels.arrival;
  const deadline = status === "pending" ? acceptDeadlineText(tracking.acceptDeadline, now) : null;
  const orderRef = shortOrderRef(order.orderId, order.orderNumber);
  const cancellable = canCancel(status);
  // Same store point the ETA model uses (vendor profile, else the mock
  // pickup point), so the map and the time agree.
  const vendorPoint = vendor ? vendorCoordinates(vendor) : null;
  const coords = vendorPoint ?? (order.vendorId ? getVendorLocation(order.vendorId) : null);
  const tel = telUrl(vendor?.phone);

  const [expanded, setExpanded] = useState(false);
  const [showHeaderTitle, setShowHeaderTitle] = useState(false);
  const cancel = useCancelOrder();
  const [cancelError, setCancelError] = useState<string | null>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = e.nativeEvent.contentOffset.y > HEADER_TITLE_AFTER;
    if (next !== showHeaderTitle) setShowHeaderTitle(next);
  };

  const mapsFailed = () => Alert.alert("Couldn't open maps", vendor?.addressLabel ?? vendorName);

  const onShare = () => {
    void Share.share({ message: `My Toade3 order ${orderRef} from ${vendorName}: ${copy.title}.` });
  };
  // Map button: in-app map view (store, drop-off, dashed line, details
  // sheet). Android back returns to the list view first.
  const [mapOpen, setMapOpen] = useState(false);
  useEffect(() => {
    if (!mapOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setMapOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [mapOpen]);
  const dropoffPoint = { latitude: order.dropoff.latitude, longitude: order.dropoff.longitude };
  const hasMap = coords != null || isRealPoint(dropoffPoint);
  const onMap = () => {
    lightHaptic();
    setMapOpen(true);
  };
  const onDirections = () => {
    if (coords) void openExternal(directionsUrls(coords, vendorName, platform), mapsFailed);
  };
  const onCall = () => {
    if (!tel) return;
    void openExternal({ primary: tel }, () =>
      Alert.alert("Can't start a call", `Call ${vendorName} on ${vendor?.phone}.`),
    );
  };
  const onMenu = () => {
    if (!order.vendorId) return;
    router.push({ pathname: "/storefront/[vendorId]", params: { vendorId: order.vendorId } });
  };

  // TODO(support): open the support chat once it exists.
  const onGetHelp = () =>
    Alert.alert("Get help", `Support chat is coming soon. For now, call ${vendorName} about order ${orderRef}.`);

  const help: { key: string; label: string; onPress: () => void }[] = [
    {
      key: "tech",
      label: "Technical issue?",
      onPress: () =>
        Alert.alert("Technical issue", "Close and reopen the app, then open this order from the Orders tab. Your order is safe."),
    },
    {
      key: "allergy",
      label: "Food allergy and intolerance info",
      onPress: () =>
        Alert.alert(
          "Allergies",
          `Contact ${vendorName} to learn about their ingredients and cooking methods.`,
        ),
    },
    {
      key: "receive",
      label: "Not able to receive the delivery?",
      onPress: () =>
        Alert.alert("Can't receive it?", "Call the store as soon as possible so they can tell your rider."),
    },
    {
      key: "cancel",
      label: cancellable ? "How do I cancel the order?" : "Why I can't cancel the order?",
      onPress: () =>
        Alert.alert(
          cancellable ? "Cancelling" : "Why you can't cancel",
          cancellable
            ? `You can cancel until ${vendorName} accepts your order. Tap Cancel order below.`
            : status === "cancelled" || status === "rejected"
              ? "This order has already ended."
              : `${vendorName} has accepted your order and started on it, so it can't be cancelled now. Use Get help if something is wrong.`,
        ),
    },
  ];

  const doCancel = () => {
    setCancelError(null);
    cancel.mutate(
      { orderId: order.orderId, expectedVersion: version },
      {
        onSuccess: () => {
          successHaptic();
          AccessibilityInfo.announceForAccessibility("Order cancelled");
        },
        onError: (e) => {
          errorHaptic();
          const msg = cancelErrorMessage(e.code);
          setCancelError(msg);
          AccessibilityInfo.announceForAccessibility(msg);
        },
      },
    );
  };
  const onCancel = () => {
    if (!cancellable || cancel.isPending) return;
    lightHaptic();
    Alert.alert("Cancel this order?", `${vendorName} hasn't accepted it yet, so you won't be charged.`, [
      { text: "Keep order", style: "cancel" },
      { text: "Cancel order", style: "destructive", onPress: doCancel },
    ]);
  };

  const first = order.items[0];
  const visibleItems = expanded ? order.items : first ? [first] : [];

  // Hero art: the waiting illustration while pending, else the store logo.
  const heroArt =
    status === "pending" ? (
      // Waiting for the store: Icons8 illustration (decorative).
      <Image
        source={{ uri: WAITING_ILLUSTRATION_URL }}
        style={styles.artImage}
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={150}
        accessible={false}
      />
    ) : vendor?.logo ? (
      <Image source={vendor.logo} style={styles.artImage} contentFit="cover" accessible={false} />
    ) : (
      <Icon name="store" size={44} color={colors.primary} />
    );

  // Order detail cards: shared by the list view and the map view's sheet.
  const details = (
    <>
        {/* Order */}
        <View style={styles.card}>
          <Pressable
            onPress={() => setExpanded((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={`Order ${orderRef}, ${order.itemCount} ${order.itemCount === 1 ? "item" : "items"}, ${formatMinorFixed(order.totalMinor)}`}
            accessibilityHint={expanded ? "Hides the price breakdown" : "Shows all items and the price breakdown"}
            style={styles.orderHead}
          >
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>Order {orderRef}</Text>
              <Text style={styles.orderMeta}>
                {`${order.itemCount} ${order.itemCount === 1 ? "item" : "items"} \u2022 ${formatMinorFixed(order.totalMinor)}`}
              </Text>
            </View>
            <View style={[styles.chevron, expanded && styles.chevronUp]}>
              <Icon name="chevronDown" size={16} color={colors.text} weight="semibold" />
            </View>
          </Pressable>

          {visibleItems.map((item, index) => {
            const image = item.productId ? getItemsByIds([item.productId])[0]?.image : undefined;
            const options = item.options.map((o) => o.label);
            return (
              <View key={`${item.productId ?? item.name}-${index}`} style={styles.itemRow}>
                <View style={styles.thumb}>
                  {image ? (
                    <Image source={image} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
                  ) : (
                    <Icon name="orders" size={20} color={colors.imagePlaceholderIcon} />
                  )}
                </View>
                <View style={styles.flex}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.qty > 1 ? `${item.qty}\u00d7 ${item.name}` : item.name}
                  </Text>
                  {options.length > 0 ? (
                    expanded ? (
                      options.map((o) => (
                        <Text key={o} style={styles.muted}>
                          {o}
                        </Text>
                      ))
                    ) : (
                      <Text style={styles.muted} numberOfLines={1}>
                        {options.join(", ")}
                      </Text>
                    )
                  ) : null}
                  {expanded && item.note ? <Text style={styles.muted}>Note: {item.note}</Text> : null}
                </View>
                <Text style={styles.amount}>{formatMinorFixed(item.lineTotalMinor)}</Text>
              </View>
            );
          })}
          {!expanded && order.items.length > 1 ? (
            <Text style={styles.more}>+{order.items.length - 1} more</Text>
          ) : null}

          {expanded ? (
            <View style={styles.breakdown}>
              <PriceRow label="Subtotal" value={order.itemsTotalMinor} bold />
              <PriceRow label="Service fee" value={order.serviceFeeMinor} />
              <PriceRow label="Delivery fee" value={order.deliveryFeeMinor} />
              {order.tipMinor > 0 ? <PriceRow label="Rider support" value={order.tipMinor} /> : null}
              <View style={styles.divider} />
              <View style={styles.priceRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatMinorFixed(order.totalMinor)}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* Delivery to */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery to</Text>
          <View style={styles.placeRow}>
            <View style={styles.placeIcon}>
              <Icon name="location" size={22} color={colors.text} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.placeTitle} numberOfLines={2}>
                {order.dropoff.label || "Drop-off pin"}
              </Text>
              {order.instructions ? (
                <Text style={styles.muted} numberOfLines={2}>
                  {order.instructions}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Ordered from */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ordered from</Text>
          <View style={styles.placeRow}>
            <View style={styles.placeIcon}>
              {vendor?.logo ? (
                <Image source={vendor.logo} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
              ) : (
                <Icon name="store" size={22} color={colors.text} />
              )}
            </View>
            <View style={styles.flex}>
              <Text style={styles.placeTitle} numberOfLines={1}>
                {vendorName}
              </Text>
              {vendor && addressLine(vendor) ? (
                <Text style={styles.muted} numberOfLines={1}>
                  {addressLine(vendor)}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.chips}>
            {order.vendorId ? (
              <Chip label="View menu" onPress={onMenu} icon={<ExtraIcon name="menuBook" size={16} />} />
            ) : null}
            {tel ? <Chip label="Call" onPress={onCall} icon={<ExtraIcon name="phone" size={16} />} /> : null}
            {coords ? (
              <Chip
                label="Get directions"
                onPress={onDirections}
                icon={<Icon name="navigation" size={16} color={colors.text} />}
              />
            ) : null}
          </View>
        </View>

        {/* Need help */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Need help?</Text>
          {help.map((h, i) => (
            <Pressable
              key={h.key}
              onPress={h.onPress}
              accessibilityRole="button"
              accessibilityLabel={h.label}
              style={({ pressed }) => [styles.helpRow, i > 0 && styles.helpBorder, pressed && styles.pressed]}
            >
              <Text style={styles.helpText}>{h.label}</Text>
              <Icon name="chevronRight" size={16} color={colors.textMuted} />
            </Pressable>
          ))}

          <Pressable
            onPress={onGetHelp}
            accessibilityRole="button"
            accessibilityLabel="Get help"
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Text style={styles.actionText}>Get help</Text>
          </Pressable>
          {status !== "cancelled" && status !== "rejected" && status !== "delivered" ? (
            <Pressable
              onPress={onCancel}
              disabled={!cancellable || cancel.isPending}
              accessibilityRole="button"
              accessibilityLabel="Cancel order"
              accessibilityState={{ disabled: !cancellable || cancel.isPending, busy: cancel.isPending }}
              accessibilityHint={
                cancellable ? "Asks for confirmation" : `${vendorName} already accepted the order`
              }
              style={({ pressed }) => [
                styles.action,
                cancellable ? styles.cancelEnabled : styles.cancelDisabled,
                pressed && styles.pressed,
              ]}
            >
              {cancel.isPending ? (
                <ActivityIndicator color={colors.error} />
              ) : (
                <Text style={[styles.actionText, cancellable ? styles.cancelText : styles.disabledText]}>
                  Cancel order
                </Text>
              )}
            </Pressable>
          ) : null}
          {cancelError ? (
            <Text style={styles.error} accessibilityRole="alert">
              {cancelError}
            </Text>
          ) : null}
          {__DEV__ && tracking.simulated ? (
            <Text style={styles.devNote}>Simulated order (dev): the store accepts after 30 s, then a rider delivers it.</Text>
          ) : null}
        </View>
    </>
  );

  if (mapOpen) {
    return (
      <OrderTrackingMap
        vendorName={vendorName}
        vendorLogo={vendor?.logo}
        vendorRating={vendor?.rating}
        vendorPoint={coords ? { latitude: coords.latitude, longitude: coords.longitude } : null}
        dropoffPoint={dropoffPoint}
        dropoffBy={labels.dropoffBy}
        title={copy.title}
        arrival={arrival}
        late={labels.late}
        deadline={deadline}
        riderPoint={rider && rider.lat != null && rider.lng != null ? { latitude: rider.lat, longitude: rider.lng } : null}
        riderName={rider?.name ?? null}
        banner={copy.banner}
        tone={{ ...tone, kind: copy.tone }}
        art={heroArt}
        onClose={() => setMapOpen(false)}
        onShare={onShare}
      >
        <View style={styles.mapDetails}>{details}</View>
      </OrderTrackingMap>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <HeaderButton label="Back" onPress={onBack}>
          <Icon name="arrowLeft" size={22} color={colors.text} />
        </HeaderButton>
        <Text style={[styles.headerTitle, !showHeaderTitle && styles.hidden]} numberOfLines={1}>
          {vendorName}
        </Text>
        {refreshing ? <ActivityIndicator size="small" color={colors.textMuted} style={styles.spinner} /> : null}
        <HeaderButton label="Share order" onPress={onShare}>
          <ExtraIcon name="share" size={20} color={colors.text} />
        </HeaderButton>
        {hasMap ? (
          <HeaderButton label="Show the order on the map" onPress={onMap}>
            <Icon name="map" size={20} color={colors.text} />
          </HeaderButton>
        ) : null}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
        onScroll={onScroll}
        scrollEventThrottle={32}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={[styles.card, styles.hero]}>
          <View style={[styles.art, status === "pending" && styles.artPlain]}>{heroArt}</View>
          <Text style={styles.vendor}>{vendorName}</Text>
          <Text style={styles.title} accessibilityRole="header" accessibilityLiveRegion="polite">
            {copy.title}
          </Text>
          {arrival ? <Text style={[styles.arrival, labels.late && styles.late]}>{arrival}</Text> : null}
          {deadline ? <Text style={styles.deadline}>{deadline}</Text> : null}
          <View style={[styles.banner, { backgroundColor: tone.bg }]} accessibilityLiveRegion="polite">
            <View style={[styles.dot, { backgroundColor: tone.fg }]} />
            <Text style={[styles.bannerText, { color: tone.fg }]}>{copy.banner}</Text>
          </View>
          {step != null ? <Progress step={step} /> : null}
        </View>

        {details}
      </ScrollView>
    </View>
  );
}

function HeaderButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

function Chip({ label, icon, onPress }: { label: string; icon: ReactNode; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      {icon}
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

function PriceRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View style={styles.priceRow}>
      <Text style={[styles.priceLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.priceValue, bold && styles.bold]}>{formatMinorFixed(value)}</Text>
    </View>
  );
}

// 4 segments: Confirmed, Preparing, On the way, Delivered. step -1 = none
// filled yet (waiting for the store).
function Progress({ step }: { step: number }) {
  const label = step < 0 ? "Waiting for the store" : TRACKING_STEPS[step];
  return (
    <View
      style={styles.progress}
      accessible
      accessibilityLabel={`Progress: ${label}, step ${Math.max(step + 1, 0)} of ${TRACKING_STEPS.length}`}
    >
      <View style={styles.segments}>
        {TRACKING_STEPS.map((s, i) => (
          <View key={s} style={[styles.segment, i <= step && styles.segmentOn]} />
        ))}
      </View>
      <View style={styles.segments}>
        {TRACKING_STEPS.map((s, i) => (
          <Text key={s} style={[styles.stepLabel, i === step && styles.stepLabelOn]} numberOfLines={1}>
            {s}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  header: {
    height: 52,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.white,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: 17,
    color: colors.text,
  },
  hidden: {
    opacity: 0,
  },
  spinner: {
    marginRight: 4,
  },
  scroll: {
    flex: 1,
  },
  card: {
    marginTop: 10,
    paddingHorizontal: SIDE,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: colors.white,
  },
  hero: {
    marginTop: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    alignItems: "center",
  },
  art: {
    width: 112,
    height: 112,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  // The illustration has its own shape: no tinted tile behind it.
  artPlain: {
    backgroundColor: "transparent",
  },
  artImage: {
    width: "100%",
    height: "100%",
  },
  vendor: {
    marginTop: 14,
    fontFamily: fontFamily.medium,
    fontSize: 15,
    color: colors.text,
  },
  title: {
    marginTop: 4,
    fontFamily: fontFamily.bold,
    fontSize: 26,
    lineHeight: 32,
    color: colors.text,
    textAlign: "center",
  },
  arrival: {
    marginTop: 4,
    fontFamily: fontFamily.medium,
    fontSize: 15,
    color: colors.text,
  },
  banner: {
    alignSelf: "stretch",
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bannerText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 19,
  },
  progress: {
    alignSelf: "stretch",
    marginTop: 16,
    gap: 6,
  },
  segments: {
    flexDirection: "row",
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairline,
  },
  segmentOn: {
    backgroundColor: colors.success,
  },
  stepLabel: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: colors.textMuted,
  },
  stepLabelOn: {
    fontFamily: fontFamily.semibold,
    color: colors.text,
  },
  orderHead: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  flex: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 19,
    color: colors.text,
  },
  orderMeta: {
    marginTop: 2,
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.text,
  },
  chevron: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  chevronUp: {
    transform: [{ rotate: "180deg" }],
  },
  itemRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.imagePlaceholder,
    alignItems: "center",
    justifyContent: "center",
  },
  itemName: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    color: colors.text,
  },
  muted: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  amount: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    color: colors.text,
  },
  more: {
    marginTop: 8,
    marginLeft: 76,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
  breakdown: {
    marginTop: 14,
  },
  priceRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
  priceValue: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.text,
  },
  bold: {
    fontFamily: fontFamily.semibold,
    color: colors.text,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
    marginVertical: 10,
  },
  totalLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.text,
  },
  totalValue: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.text,
  },
  placeRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  placeIcon: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  placeTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  chips: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: colors.text,
  },
  helpRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  helpBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  helpText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: colors.text,
  },
  action: {
    marginTop: 12,
    minHeight: 56,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: colors.text,
  },
  cancelEnabled: {
    backgroundColor: "#FDECEA",
  },
  cancelDisabled: {
    backgroundColor: colors.surfaceMuted,
  },
  cancelText: {
    color: colors.error,
  },
  disabledText: {
    color: colors.disabledText,
  },
  error: {
    marginTop: 10,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.error,
    textAlign: "center",
  },
  devNote: {
    marginTop: 10,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
  },
  late: {
    color: colors.primary,
  },
  deadline: {
    marginTop: 4,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  // Inside the map sheet: the first card sits flush under the grab handle.
  mapDetails: {
    marginTop: -10,
  },
  pressed: {
    opacity: 0.7,
  },
});
