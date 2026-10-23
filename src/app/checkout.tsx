// Confirm Order: opened from the floating cart bar. Delivery ETA banner, a
// static map preview of the drop-off, address + drop-off instructions, the
// cart lines (expandable: options, note, quantity), rider support and the
// price summary, with a sticky "Place order" footer.
//
// Money is integer pesewas (lib/cart/checkoutTotals). The fee / ETA come from
// the server quote (useDeliveryQuote; local estimate as placeholder / mock
// fallback). Place order calls place_order (usePlaceOrder), which re-prices
// everything server-side; the totals here are what the user expects to pay.
import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { type ReactNode, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ClearCartSheet } from "../components/cart/ClearCartSheet";
import { RiderWagesSheet } from "../components/checkout/RiderWagesSheet";
import { ServiceChargeSheet } from "../components/checkout/ServiceChargeSheet";
import { useDropoff } from "../components/stores/useDropoff";
import { AnimatedCount } from "../components/ui/AnimatedCount";
import { ExtraIcon } from "../components/ui/ExtraIcon";
import { Icon } from "../components/ui/Icon";
import { getItemsByIds } from "../data/mock/catalog";
import { useDeliveryQuote } from "../hooks/useDeliveryQuote";
import { usePlaceOrder } from "../hooks/usePlaceOrder";
import { friendlyOrderMessage } from "../lib/backend/errors";
import {
  type CartLine,
  clearCart,
  getCart,
  lineTotal,
  MAX_LINE_QTY,
  updateLineQty,
  useCart,
} from "../lib/cart/cartStore";
import {
  clampExtraCash,
  computeCheckoutTotals,
  EXTRA_CASH_STEP_MINOR,
  type RiderSupport,
} from "../lib/cart/checkoutTotals";
import {
  formatMinorFixed,
  minorToText,
  parseGhsToMinor,
  PRICE_FORMAT_ERROR,
} from "../lib/discovery/money";
import { errorHaptic, lightHaptic, selectionHaptic, successHaptic } from "../lib/haptics";
import { useDeliveryAddress } from "../lib/location/DeliveryAddressContext";
import { colors, fontFamily } from "../theme";

const SIDE = 16;
const MAP_HEIGHT = 150;
const MAP_DELTA = { latitudeDelta: 0.006, longitudeDelta: 0.006 };
const PIN = 36;
const THUMB = 56;
const NOTE_MAX = 200;
// Same bundled orange pin as CenterPin (Icons8; attribution required).
const MAP_PIN = require("../../assets/icons/location/map-pin.png");
// Up to 7 whole digits and 2 decimals while typing ("12.", "12.5" allowed).
const EXTRA_TYPING = /^\d{0,7}([.,]\d{0,2})?$/;

type SupportKind = RiderSupport["kind"];

export default function Checkout() {
  const insets = useSafeAreaInsets();
  const { cart } = useCart();
  const { active } = useDeliveryAddress();
  const { dropoff } = useDropoff();
  const lines = cart.lines;
  const vendorId = lines[0]?.vendorId ?? null;
  const vendorName = lines[0]?.vendorName ?? "";

  const [instructionsOpen, setInstructionsOpen] = useState(false);
  // TODO(checkout): persist the drop-off instructions with the order.
  const [instructions, setInstructions] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [supportKind, setSupportKind] = useState<SupportKind>("none");
  const [extraText, setExtraText] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const [serviceChargeOpen, setServiceChargeOpen] = useState(false);
  const [riderWagesOpen, setRiderWagesOpen] = useState(false);

  // Server quote (quote_delivery) through the query cache; the placeholder
  // is the local fare-matrix estimate, so the fee / ETA show instantly.
  const { quote } = useDeliveryQuote(vendorId, dropoff);
  const deliverable = quote?.deliverable === true;
  const feeMinor = quote && quote.deliverable ? quote.feeMinor : null;
  const eta = quote && quote.deliverable ? quote.etaMins : null;
  const placeOrder = usePlaceOrder();

  const parsedExtra = parseGhsToMinor(extraText);
  const extraMinor = parsedExtra.ok ? (parsedExtra.value ?? 0) : 0;
  const support: RiderSupport =
    supportKind === "extra" ? { kind: "extra", amountMinor: extraMinor } : { kind: supportKind };
  const totals = computeCheckoutTotals({
    lines,
    deliveryFeeMinor: feeMinor,
    support,
    ...(quote && quote.deliverable ? { serviceChargeMinor: quote.serviceFeeMinor } : null),
  });

  const thumbs = useMemo(() => {
    const items = getItemsByIds(lines.map((l) => l.itemId));
    return new Map(items.map((i) => [i.item_id, i.image]));
  }, [lines]);

  if (lines.length === 0) {
    return (
      <View style={[styles.root, styles.emptyRoot, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <View style={[styles.header, styles.emptyHeader]}>
          <HeaderButton label="Close" onPress={() => router.back()}>
            <Icon name="close" size={16} color={colors.text} weight="semibold" />
          </HeaderButton>
        </View>
        <View style={styles.emptyBody}>
          <View style={styles.emptyCircle}>
            <ExtraIcon name="basket" size={40} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle} accessibilityRole="header">
            Your cart is empty
          </Text>
          <Pressable
            onPress={() => router.navigate("/home")}
            accessibilityRole="button"
            accessibilityLabel="Browse food"
            style={({ pressed }) => [styles.browse, pressed && styles.pressed]}
          >
            <Text style={styles.browseText}>Browse food</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const onClear = () => {
    lightHaptic();
    setClearOpen(true);
  };
  const confirmClear = () => {
    setClearOpen(false);
    clearCart();
    router.back();
  };

  const onQty = (line: CartLine, next: number) => {
    selectionHaptic();
    updateLineQty(line.lineId, next);
    if (getCart().lines.length === 0) {
      router.back();
      return;
    }
    AccessibilityInfo.announceForAccessibility(
      next <= 0 ? `${line.name} removed` : `${line.name}, quantity ${next}`,
    );
  };

  const toggleSupport = (kind: Exclude<SupportKind, "none">) => {
    selectionHaptic();
    setSupportKind((current) => (current === kind ? "none" : kind));
  };

  const onExtraText = (text: string) => {
    if (EXTRA_TYPING.test(text)) setExtraText(text);
  };
  const stepExtra = (delta: number) => {
    lightHaptic();
    setSupportKind("extra");
    setExtraText(minorToText(clampExtraCash(extraMinor + delta)));
  };

  const placing = placeOrder.isPending;
  const canPlace = deliverable && lines.length > 0 && !placing;
  const placeLabel = `Place order · ${formatMinorFixed(totals.totalMinor)}`;
  const placeError = placeOrder.error ? friendlyOrderMessage(placeOrder.error.code) : null;
  // The server re-prices everything and reuses the same idempotency key on a
  // retry, so a timeout never creates a second order.
  const onPlace = () => {
    if (!vendorId || !canPlace) return;
    lightHaptic();
    placeOrder.mutate(
      {
        vendorId,
        lines,
        dropoff: { ...dropoff, label: active?.title ?? "Drop-off pin" },
        instructions,
        tipMinor: totals.riderSupportMinor,
      },
      {
        onSuccess: (order) => {
          successHaptic();
          router.replace({ pathname: "/order/[id]", params: { id: order.orderId } });
          clearCart();
        },
        onError: (e) => {
          errorHaptic();
          AccessibilityInfo.announceForAccessibility(friendlyOrderMessage(e.code));
        },
      },
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <HeaderButton label="Close" onPress={() => router.back()}>
          <Icon name="close" size={16} color={colors.text} weight="semibold" />
        </HeaderButton>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          Confirm Order
        </Text>
        <HeaderButton label="Clear cart" onPress={onClear}>
          <Icon name="trash" size={18} color={colors.error} />
        </HeaderButton>
      </View>

      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {/* Deliver now */}
          <View style={styles.banner}>
            <Icon name="delivery" size={22} color={colors.primary} />
            <View style={styles.flexText}>
              <Text style={styles.bannerLabel}>Deliver now</Text>
              <Text style={styles.bannerEta}>
                {eta ? `Est. arrival in ${eta[0]}-${eta[1]} mins` : "Too far to deliver"}
              </Text>
            </View>
            <Pressable
              onPress={() => Alert.alert("Scheduled delivery is coming soon")}
              accessibilityRole="button"
              accessibilityLabel="Schedule delivery"
              style={({ pressed }) => [styles.iconTarget, pressed && styles.pressed]}
            >
              <ExtraIcon name="edit" size={20} color={colors.text} />
            </Pressable>
          </View>

          {/* Map preview (static: no gestures, never animated). */}
          <View style={styles.mapWrap}>
            <MapView
              style={StyleSheet.absoluteFill}
              region={{ ...dropoff, ...MAP_DELTA }}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              toolbarEnabled={false}
              liteMode={Platform.OS === "android"}
              showsPointsOfInterests={false}
              userInterfaceStyle="light"
              pointerEvents="none"
              accessible={false}
              importantForAccessibility="no-hide-descendants"
            />
            <Image
              source={MAP_PIN}
              style={styles.pin}
              contentFit="contain"
              pointerEvents="none"
              accessible={false}
            />
            <Pressable
              onPress={() => router.push("/location-picker")}
              accessibilityRole="button"
              accessibilityLabel="Edit drop-off pin"
              style={({ pressed }) => [styles.editPin, pressed && styles.pressed]}
            >
              <Text style={styles.editPinText}>EDIT PIN</Text>
            </Pressable>
          </View>

          {/* Address */}
          <Pressable
            onPress={() => router.push("/location-picker")}
            accessibilityRole="button"
            accessibilityLabel={
              active ? `Delivery address, ${active.title}. Change` : "Set delivery address"
            }
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Icon name="location" size={20} color={colors.text} />
            <View style={styles.flexText}>
              {active ? (
                <>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {active.title}
                  </Text>
                  {active.subtitle ? (
                    <Text style={styles.rowSub} numberOfLines={2}>
                      {active.subtitle}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={[styles.rowTitle, styles.orange]}>Set delivery address</Text>
              )}
            </View>
            <Icon name="chevronRight" size={16} color={colors.textMuted} />
          </Pressable>

          {/* Drop-off instructions */}
          <View style={styles.row}>
            <ExtraIcon name="document" size={20} color={colors.text} />
            <View style={styles.flexText}>
              <Text style={styles.rowTitle}>Add drop-off instructions</Text>
              <Text style={styles.rowSub}>e.g. “Meet me at the gate” or a landmark</Text>
            </View>
            <Pressable
              onPress={() => setInstructionsOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityLabel={instructionsOpen ? "Hide drop-off instructions" : "Add drop-off instructions"}
              accessibilityState={{ expanded: instructionsOpen }}
              style={({ pressed }) => [styles.textTarget, pressed && styles.pressed]}
            >
              <Text style={styles.addText}>{instructionsOpen ? "Done" : instructions ? "Edit" : "Add"}</Text>
            </Pressable>
          </View>
          {instructionsOpen ? (
            <TextInput
              value={instructions}
              onChangeText={setInstructions}
              placeholder="Drop-off instructions"
              placeholderTextColor={colors.placeholder}
              multiline
              maxLength={NOTE_MAX}
              autoFocus
              style={styles.instructions}
              accessibilityLabel="Drop-off instructions"
            />
          ) : null}

          <View style={styles.divider} />

          {/* Cart lines */}
          <Text style={styles.sectionTitle} accessibilityRole="header">
            From {vendorName}
          </Text>
          {lines.map((line) => (
            <LineRow
              key={line.lineId}
              line={line}
              image={thumbs.get(line.itemId)}
              expanded={expandedId === line.lineId}
              onToggle={() =>
                setExpandedId((id) => (id === line.lineId ? null : line.lineId))
              }
              onQty={(next) => onQty(line, next)}
            />
          ))}

          <View style={styles.divider} />

          {/* Rider support */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, styles.flexText]} accessibilityRole="header">
              Support for fair rider wages
            </Text>
            <Pressable
              onPress={() => setRiderWagesOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="About rider support"
              style={({ pressed }) => [styles.iconTarget, pressed && styles.pressed]}
            >
              <ExtraIcon name="help" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
          <Radio
            checked={supportKind === "round_up"}
            onPress={() => toggleSupport("round_up")}
            title="Round up my bill"
            subtitle="Bill will be rounded to the nearest whole cedi"
          />
          <Radio
            checked={supportKind === "extra"}
            onPress={() => toggleSupport("extra")}
            title="Add extra cash"
            subtitle="Choose an amount for your rider"
          />
          {supportKind === "extra" ? (
            <View style={styles.extraRow}>
              <Pressable
                onPress={() => stepExtra(-EXTRA_CASH_STEP_MINOR)}
                disabled={extraMinor <= 0}
                accessibilityRole="button"
                accessibilityLabel="Decrease extra cash by GHS 1.00"
                accessibilityState={{ disabled: extraMinor <= 0 }}
                style={({ pressed }) => [styles.iconTarget, pressed && styles.pressed]}
              >
                <ExtraIcon
                  name="minusCircle"
                  size={28}
                  color={extraMinor <= 0 ? colors.disabledText : colors.primary}
                />
              </Pressable>
              <View style={styles.extraField}>
                <Text style={styles.extraPrefix}>GHS</Text>
                <TextInput
                  value={extraText}
                  onChangeText={onExtraText}
                  placeholder="0.00"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="decimal-pad"
                  style={styles.extraInput}
                  accessibilityLabel="Extra cash for your rider, GHS"
                />
              </View>
              <Pressable
                onPress={() => stepExtra(EXTRA_CASH_STEP_MINOR)}
                accessibilityRole="button"
                accessibilityLabel="Increase extra cash by GHS 1.00"
                style={({ pressed }) => [styles.iconTarget, pressed && styles.pressed]}
              >
                <ExtraIcon name="plusCircle" size={28} color={colors.primary} />
              </Pressable>
            </View>
          ) : null}
          {supportKind === "extra" && !parsedExtra.ok ? (
            <Text style={styles.error}>{PRICE_FORMAT_ERROR}</Text>
          ) : null}

          <View style={styles.divider} />

          {/* Price summary */}
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Summary
          </Text>
          <SummaryRow label="Subtotal" value={formatMinorFixed(totals.subtotalMinor)} />
          <SummaryRow
            label="Delivery fee"
            value={feeMinor != null ? formatMinorFixed(feeMinor) : "Too far to deliver"}
            warn={feeMinor == null}
          />
          <SummaryRow
            label="Service charge"
            value={formatMinorFixed(totals.serviceChargeMinor)}
            onHelp={() => setServiceChargeOpen(true)}
          />
          {totals.riderSupportMinor > 0 ? (
            <SummaryRow label="Rider support" value={formatMinorFixed(totals.riderSupportMinor)} />
          ) : null}
          <SummaryRow label="Total" value={formatMinorFixed(totals.totalMinor)} bold />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {placeError && !placing ? (
            <Text
              style={styles.placeError}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {placeError}
            </Text>
          ) : null}
          <Pressable
            onPress={onPlace}
            disabled={!canPlace}
            accessibilityRole="button"
            accessibilityLabel={
              placing
                ? "Placing order"
                : canPlace
                  ? placeLabel
                  : "Place order, too far to deliver"
            }
            accessibilityState={{ disabled: !canPlace, busy: placing }}
            style={({ pressed }) => [
              styles.place,
              !canPlace && !placing && styles.placeDisabled,
              pressed && canPlace && styles.pressed,
            ]}
          >
            {placing ? (
              <View style={styles.placingRow}>
                <ActivityIndicator color={colors.white} />
                <Text style={styles.placeText}>Placing order…</Text>
              </View>
            ) : (
              <Text style={[styles.placeText, !canPlace && styles.placeTextDisabled]}>
                {canPlace ? placeLabel : "Too far to deliver"}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      <ClearCartSheet
        visible={clearOpen}
        vendorName={vendorName}
        onConfirm={confirmClear}
        onCancel={() => setClearOpen(false)}
      />
      <ServiceChargeSheet
        visible={serviceChargeOpen}
        onClose={() => setServiceChargeOpen(false)}
      />
      <RiderWagesSheet visible={riderWagesOpen} onClose={() => setRiderWagesOpen(false)} />
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
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

function LineRow({
  line,
  image,
  expanded,
  onToggle,
  onQty,
}: {
  line: CartLine;
  image: ReturnType<typeof getItemsByIds>[number]["image"];
  expanded: boolean;
  onToggle: () => void;
  onQty: (next: number) => void;
}) {
  const totalText = formatMinorFixed(lineTotal(line));
  const qtyText = line.qty === 1 ? "1 item" : `${line.qty} items`;
  return (
    <View style={styles.line}>
      <View style={styles.lineMain}>
        <View style={styles.thumb}>
          {image ? (
            <Image
              source={image}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              accessible={false}
            />
          ) : (
            <Icon name="orders" size={22} color={colors.imagePlaceholderIcon} />
          )}
        </View>
        <View style={styles.flexText}>
          <Text style={styles.lineName} numberOfLines={2}>
            {line.name}
          </Text>
          <Text style={styles.rowSub}>
            {qtyText} · {totalText}
          </Text>
        </View>
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={`${line.name} details`}
          accessibilityState={{ expanded }}
          style={({ pressed }) => [styles.iconTarget, pressed && styles.pressed]}
        >
          <View style={[styles.chevronCircle, expanded && styles.chevronOpen]}>
            <Icon name="chevronDown" size={14} color={colors.text} weight="semibold" />
          </View>
        </Pressable>
      </View>
      {expanded ? (
        <View style={styles.lineDetails}>
          {line.options.map((o) => (
            <View key={o.optionId} style={styles.optionRow}>
              <Text style={[styles.rowSub, styles.flexText]}>{o.label}</Text>
              <Text style={styles.rowSub}>+{formatMinorFixed(o.priceMinor)}</Text>
            </View>
          ))}
          {line.note ? <Text style={styles.note}>Note: {line.note}</Text> : null}
          <View style={styles.lineActions}>
            <Pressable
              onPress={() => onQty(0)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${line.name}`}
              style={({ pressed }) => [styles.textTarget, pressed && styles.pressed]}
            >
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => onQty(line.qty - 1)}
                accessibilityRole="button"
                accessibilityLabel={line.qty <= 1 ? `Remove ${line.name}` : `Decrease ${line.name} quantity`}
                accessibilityValue={{ text: `${line.qty}` }}
                style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
              >
                <View style={styles.bar} />
              </Pressable>
              <AnimatedCount
                value={line.qty}
                fontSize={15}
                color={colors.text}
                fontFamily={fontFamily.semibold}
                accessibilityLabel={`Quantity ${line.qty}`}
              />
              <Pressable
                onPress={() => onQty(line.qty + 1)}
                disabled={line.qty >= MAX_LINE_QTY}
                accessibilityRole="button"
                accessibilityLabel={`Increase ${line.name} quantity`}
                accessibilityValue={{ text: `${line.qty}` }}
                accessibilityState={{ disabled: line.qty >= MAX_LINE_QTY }}
                style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
              >
                <View style={[styles.bar, line.qty >= MAX_LINE_QTY && styles.dimmed]} />
                <View
                  style={[styles.bar, styles.barVertical, line.qty >= MAX_LINE_QTY && styles.dimmed]}
                />
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Radio({
  checked,
  onPress,
  title,
  subtitle,
}: {
  checked: boolean;
  onPress: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      accessibilityLabel={`${title}. ${subtitle}`}
      style={({ pressed }) => [styles.radioRow, pressed && styles.pressed]}
    >
      <View style={[styles.radio, checked && styles.radioOn]}>
        {checked ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={styles.flexText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

function SummaryRow({
  label,
  value,
  bold,
  warn,
  onHelp,
}: {
  label: string;
  value: string;
  bold?: boolean;
  warn?: boolean;
  onHelp?: () => void;
}) {
  return (
    <View style={[styles.summaryRow, bold && styles.summaryTotal]}>
      <View style={styles.summaryLabelRow}>
        <Text style={[styles.summaryLabel, bold && styles.summaryBold]}>{label}</Text>
        {onHelp ? (
          <Pressable
            onPress={onHelp}
            accessibilityRole="button"
            accessibilityLabel={`About ${label.toLowerCase()}`}
            hitSlop={12}
            style={({ pressed }) => [styles.helpSmall, pressed && styles.pressed]}
          >
            <ExtraIcon name="help" size={15} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <Text
        style={[styles.summaryValue, bold && styles.summaryBold, warn && styles.warn]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  fill: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontFamily: fontFamily.bold,
    fontSize: 17,
    color: colors.text,
  },
  content: {
    paddingHorizontal: SIDE,
    paddingTop: 8,
    paddingBottom: 24,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
  },
  flexText: {
    flex: 1,
  },
  bannerLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  bannerEta: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.primary,
  },
  iconTarget: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  textTarget: {
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  mapWrap: {
    height: MAP_HEIGHT,
    marginTop: 12,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.imagePlaceholder,
  },
  pin: {
    position: "absolute",
    width: PIN,
    height: PIN,
    left: "50%",
    top: MAP_HEIGHT / 2 - PIN,
    marginLeft: -PIN / 2,
  },
  editPin: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    minHeight: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  },
  editPinText: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
  },
  rowTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  rowSub: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  orange: {
    color: colors.primary,
  },
  addText: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.primary,
  },
  instructions: {
    minHeight: 72,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: "top",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
    marginVertical: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    marginVertical: 6,
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.text,
  },
  line: {
    paddingVertical: 8,
  },
  lineMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.imagePlaceholder,
    alignItems: "center",
    justifyContent: "center",
  },
  lineName: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  chevronCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  chevronOpen: {
    transform: [{ rotate: "180deg" }],
  },
  lineDetails: {
    marginTop: 8,
    marginLeft: THUMB + 12,
    gap: 4,
  },
  optionRow: {
    flexDirection: "row",
    gap: 8,
  },
  note: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    fontStyle: "italic",
    color: colors.textMuted,
  },
  lineActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  remove: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.error,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#DDDDDD",
    borderRadius: 999,
  },
  stepButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  bar: {
    width: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.text,
  },
  barVertical: {
    position: "absolute",
    width: 2,
    height: 12,
  },
  dimmed: {
    opacity: 0.3,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#C4C4C4",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  extraRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 26,
  },
  extraField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  extraPrefix: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.textMuted,
  },
  extraInput: {
    flex: 1,
    paddingVertical: 8,
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  error: {
    marginTop: 4,
    marginLeft: 26,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.error,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 32,
  },
  summaryTotal: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  summaryLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  summaryLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
  summaryValue: {
    flexShrink: 0,
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: colors.text,
  },
  summaryBold: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.text,
  },
  warn: {
    color: colors.error,
  },
  helpSmall: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: SIDE,
    paddingTop: 12,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  place: {
    minHeight: 56,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  placeDisabled: {
    backgroundColor: colors.disabledFill,
  },
  placeText: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: colors.white,
  },
  placeTextDisabled: {
    color: colors.disabledText,
  },
  placingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  placeError: {
    marginBottom: 8,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.error,
    textAlign: "center",
  },
  emptyRoot: {
    alignItems: "stretch",
  },
  emptyHeader: {
    justifyContent: "flex-start",
  },
  emptyBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SIDE,
    paddingBottom: 80,
  },
  emptyCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 16,
    fontFamily: fontFamily.bold,
    fontSize: 20,
    color: colors.text,
  },
  browse: {
    marginTop: 20,
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  browseText: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.white,
  },
});
