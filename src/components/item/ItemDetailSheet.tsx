// Item detail bottom sheet: opened from any FoodCard (no route, so it works
// on every screen). Hero card, option-group cards, a note, and a sticky
// footer with a quantity stepper and the Add button. Built on the shared
// BottomSheet (RN Modal + reanimated/gesture-handler), dim backdrop, ~92%
// of the window tall.
//
// Pricing is integer pesewas: (base + selected options) x qty.
// Required groups are validated on Add: the sheet scrolls to the first
// unsatisfied group, flashes its card red and plays an error haptic.
import { Image } from "expo-image";
import { router, usePathname } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getItemsByIds, getVendorById } from "../../data/mock/catalog";
import { useProduct } from "../../hooks/useProduct";
import {
  getCompareAtMinor,
  getItemDescription,
  getOptionGroups,
  type OptionGroup,
} from "../../data/mock/itemOptions";
import { addToCart, getCart, needsNewCart, newLineId } from "../../lib/cart/cartStore";
import { formatMinorFixed } from "../../lib/discovery/money";
import { isOrderable, vendorOpenAt } from "../../lib/discovery/predicate";
import type { ItemStatus } from "../../lib/discovery/types";
import { errorHaptic, lightHaptic, selectionHaptic, successHaptic } from "../../lib/haptics";
import {
  clampQty,
  firstUnsatisfiedGroup,
  initialSelection,
  isSingleSelect,
  lineTotalMinor,
  MAX_QTY,
  MIN_QTY,
  type Selection,
  selectedOptions,
  toggle,
} from "../../lib/item/itemSelection";
import { isOnVendorStorefront } from "../../lib/storefront/storefrontLink";
import { colors, fontFamily } from "../../theme";
import { ReplaceCartSheet } from "../cart/ReplaceCartSheet";
import type { FoodCardItem } from "../home/FoodCard";
import { StoreGlyph } from "../storefront/StoreGlyph";
import { AnimatedCount } from "../ui/AnimatedCount";
import { BottomSheet } from "../ui/BottomSheet";
import { FavouriteButton } from "../ui/FavouriteButton";
import { Icon } from "../ui/Icon";

type Props = {
  item: FoodCardItem;
  visible: boolean;
  onClose: () => void;
  // After the exit animation (the card unmounts the sheet then).
  onClosed?: () => void;
};

const BG = "#F5F5F5";
const CARD_MARGIN = 14;
const NOTE_MAX = 200;
const FLASH_MS = 900;
const ADDED_CLOSE_MS = 700;
const CONTROL = 22;
const STEPPER_BORDER = "#DDDDDD";
const CONTROL_OFF = "#C4C4C4";
// colors.requiredRed at ~11% alpha.
const REQUIRED_BG = `${colors.requiredRed}1C`;
// 36pt circle + 4pt slop each side = 44pt touch target.
const HEADER_SLOP = 4;

function resolveStatus(card: FoodCardItem, itemId: string): ItemStatus {
  if (card.status) return card.status;
  const catalog = getItemsByIds([itemId])[0];
  if (!catalog) return "available";
  const vendor = getVendorById(catalog.vendor_id);
  const open = vendor ? vendorOpenAt(vendor, new Date()) : false;
  if (!open) return "closed";
  return isOrderable(catalog) ? "available" : "sold_out";
}

export function ItemDetailSheet({ item, visible, onClose, onClosed }: Props) {
  const insets = useSafeAreaInsets();

  // Product + option groups through the query cache (useProduct). Its
  // placeholder is the mock record (catalog.ts + itemOptions.ts), so the
  // sheet renders exactly as before until / unless the backend answers.
  // Items unknown to the catalog fall back to the card's own fields.
  const { data: product } = useProduct(item.id);
  const data = useMemo(() => {
    const vendorId = product?.vendorId || item.vendorId;
    const priceMinor =
      product?.priceMinor ?? item.priceMinor ?? Math.round((item.priceGhs ?? 0) * 100);
    return {
      vendorId,
      vendorName: product?.vendorName || getVendorById(vendorId)?.name || item.vendor,
      priceMinor,
      compareAtMinor: product ? product.compareAtMinor : getCompareAtMinor(item.id, priceMinor),
      description: product?.description ?? getItemDescription(item.id, []),
      groups: product?.optionGroups ?? getOptionGroups(item.id, []),
      status: resolveStatus(item, item.id),
    };
  }, [item, product]);
  const { groups } = data;

  const [selection, setSelection] = useState<Selection>(() => initialSelection(groups));
  // Reset the choices if the option groups change (remote data replacing the
  // placeholder with a different menu).
  const groupsKey = groups
    .map((g) => `${g.id}:${g.options.map((o) => o.id).join(",")}`)
    .join("|");
  const [selectionKey, setSelectionKey] = useState(groupsKey);
  if (selectionKey !== groupsKey) {
    setSelectionKey(groupsKey);
    setSelection(initialSelection(groups));
  }
  const [qty, setQty] = useState(MIN_QTY);
  const [note, setNote] = useState("");
  const [flashGroupId, setFlashGroupId] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  // Current cart's vendor name while the replace-cart confirm is open.
  const [replaceFrom, setReplaceFrom] = useState<string | null>(null);
  const [lastReplaceFrom, setLastReplaceFrom] = useState("");
  if (replaceFrom != null && replaceFrom !== lastReplaceFrom) setLastReplaceFrom(replaceFrom);

  const scrollRef = useRef<ScrollView>(null);
  const nameRef = useRef<Text>(null);
  const groupY = useRef<Record<string, number>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Storefront link: vendor to open once the sheet has closed, and a guard
  // against double taps while it closes.
  const pathname = usePathname();
  const pendingVendorRef = useRef<string | null>(null);
  const leaving = useRef(false);
  useEffect(
    () => () => {
      for (const t of timers.current) clearTimeout(t);
    },
    [],
  );
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const total = lineTotalMinor(data.priceMinor, groups, selection, qty);
  const totalText = formatMinorFixed(total);

  const onToggle = (groupId: string, optionId: string) => {
    const res = toggle(groups, selection, groupId, optionId);
    if (!res.accepted) {
      // Max reached: ignore with a gentle tick.
      selectionHaptic();
      return;
    }
    lightHaptic();
    setSelection(res.selection);
  };

  const changeQty = (delta: number) => {
    const next = clampQty(qty + delta);
    if (next === qty) return;
    selectionHaptic();
    setQty(next);
    AccessibilityInfo.announceForAccessibility(`Quantity ${next}`);
  };

  const onShare = () => {
    lightHaptic();
    // TODO: append the deep link https://toade3.app/item/{id} once deep
    // linking exists.
    Share.share({
      message: `${item.name} from ${data.vendorName} on Toade3 — ${formatMinorFixed(data.priceMinor)}`,
      title: item.name,
    }).catch(() => {
      // Dismissal resolves normally; a failure has nothing to recover.
    });
  };

  const commit = (replace: boolean) => {
    addToCart(
      {
        lineId: newLineId(),
        itemId: item.id,
        vendorId: data.vendorId,
        vendorName: data.vendorName,
        name: item.name,
        unitPriceMinor: data.priceMinor,
        options: selectedOptions(groups, selection).map((o) => ({
          optionId: o.optionId,
          label: o.label,
          priceMinor: o.priceMinor,
        })),
        note: note.trim(),
        qty,
      },
      replace,
    );
    successHaptic();
    setAdded(true);
    AccessibilityInfo.announceForAccessibility("Added to cart");
    // Brief in-button confirmation, then close.
    later(onClose, ADDED_CLOSE_MS);
  };

  const onAdd = () => {
    if (added) return;
    const missing = firstUnsatisfiedGroup(groups, selection);
    if (missing) {
      errorHaptic();
      const y = groupY.current[missing.id];
      if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - CARD_MARGIN), animated: true });
      setFlashGroupId(missing.id);
      later(() => setFlashGroupId(null), FLASH_MS);
      AccessibilityInfo.announceForAccessibility(`${missing.title} is required`);
      return;
    }
    const cart = getCart();
    // One vendor per cart: the store's rule decides, the sheet confirms.
    if (needsNewCart(cart, data.vendorId)) {
      setReplaceFrom(cart.lines[0]?.vendorName ?? "another store");
      return;
    }
    commit(false);
  };

  const confirmReplace = () => {
    setReplaceFrom(null);
    // Clears the cart and adds this line; the item sheet closes after the
    // brief "Added" state, by which time the confirm sheet has gone.
    commit(true);
  };

  // "View <vendor> ›": close first; the push runs after the exit animation
  // (handleClosed).
  const onViewStore = () => {
    if (leaving.current) return;
    leaving.current = true;
    lightHaptic();
    // Already on this vendor's storefront: just close, don't stack a duplicate.
    pendingVendorRef.current = isOnVendorStorefront(pathname, data.vendorId)
      ? null
      : data.vendorId;
    onClose();
  };

  const handleClosed = () => {
    const vendorId = pendingVendorRef.current;
    pendingVendorRef.current = null;
    leaving.current = false;
    onClosed?.();
    // One frame after the Modal unmount commits (BottomSheet sets
    // visible=false just before onClosed), so the native-stack push never
    // races the Modal dismissal on iOS. Not `later()`: the card unmounts this
    // sheet in onClosed, which would clear that timer. RN Modal onDismiss is
    // iOS-only and not exposed by BottomSheet.
    if (vendorId) {
      requestAnimationFrame(() =>
        router.push({ pathname: "/storefront/[vendorId]", params: { vendorId } }),
      );
    }
  };

  const moveFocusToName = () => {
    if (nameRef.current) AccessibilityInfo.sendAccessibilityEvent(nameRef.current, "focus");
  };

  const unavailable =
    data.status === "sold_out" ? "Sold out" : data.status === "closed" ? "Store closed" : null;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onClosed={handleClosed}
      onOpened={moveFocusToName}
      backdrop="dim"
      topGapRatio={0.08}
      accessibilityLabel={item.name}
      header={
        <View style={styles.headerRow}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={HEADER_SLOP}
            style={({ pressed }) => [styles.iconCircle, pressed && styles.pressed]}
          >
            <Icon name="close" size={14} color={colors.text} weight="semibold" />
          </Pressable>
          <View style={styles.headerActions}>
            <Pressable
              onPress={onShare}
              accessibilityRole="button"
              accessibilityLabel={`Share ${item.name}`}
              hitSlop={HEADER_SLOP}
              style={({ pressed }) => [styles.iconCircle, pressed && styles.pressed]}
            >
              <StoreGlyph name="share" size={18} color={colors.text} />
            </Pressable>
            <FavouriteButton
              itemId={item.id}
              size={18}
              offColor={colors.text}
              style={styles.iconCircle}
            />
          </View>
        </View>
      }
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={styles.card}>
          <View style={styles.hero}>
            {item.image ? (
              <Image
                source={item.image}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={150}
                cachePolicy="memory-disk"
                accessible={false}
              />
            ) : (
              <Icon name="orders" size={36} color={colors.imagePlaceholderIcon} />
            )}
          </View>
          <Text ref={nameRef} style={styles.name} accessibilityRole="header">
            {item.name}
          </Text>
          <Text style={styles.price}>{formatMinorFixed(data.priceMinor)}</Text>
          {data.compareAtMinor != null ? (
            <Text
              style={styles.oldPrice}
              accessibilityLabel={`Was ${formatMinorFixed(data.compareAtMinor)}`}
            >
              {formatMinorFixed(data.compareAtMinor)}
            </Text>
          ) : null}
          <Text style={styles.description}>{data.description}</Text>
          {data.vendorId ? (
            <Pressable
              onPress={onViewStore}
              accessibilityRole="link"
              accessibilityLabel={`View ${data.vendorName} storefront`}
              style={({ pressed }) => [
                styles.vendorRow,
                styles.vendorLink,
                pressed && styles.pressed,
              ]}
            >
              <Icon name="store" size={14} color={colors.primary} />
              <Text style={[styles.vendor, styles.vendorLinkText]} numberOfLines={1}>
                {`View ${data.vendorName} ›`}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.vendorRow}>
              <Icon name="store" size={14} color={colors.textMuted} />
              <Text style={styles.vendor}>{data.vendorName}</Text>
            </View>
          )}
        </View>

        {groups.map((group) => (
          <View
            key={group.id}
            onLayout={(e) => {
              groupY.current[group.id] = e.nativeEvent.layout.y;
            }}
            style={[styles.card, flashGroupId === group.id && styles.cardFlash]}
          >
            <GroupCard
              group={group}
              selected={selection[group.id] ?? []}
              onToggle={onToggle}
            />
          </View>
        ))}

        <View style={styles.card}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add a note"
            placeholderTextColor={colors.placeholder}
            multiline
            maxLength={NOTE_MAX}
            style={styles.note}
            accessibilityLabel="Add a note"
            accessibilityHint="It may not be possible to meet all requests."
            onFocus={() => later(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
          />
          <Text style={styles.helper}>It may not be possible to meet all requests.</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {unavailable ? (
          <View
            style={[styles.addButton, styles.addDisabled]}
            accessible
            accessibilityRole="button"
            accessibilityLabel={unavailable}
            accessibilityState={{ disabled: true }}
          >
            <Text style={[styles.addText, styles.addDisabledText]}>{unavailable}</Text>
          </View>
        ) : (
          <>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => changeQty(-1)}
                disabled={qty <= MIN_QTY}
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity"
                accessibilityValue={{ text: `${qty}` }}
                accessibilityState={{ disabled: qty <= MIN_QTY }}
                style={({ pressed }) => [styles.stepButton, pressed && styles.stepPressed]}
              >
                <View style={[styles.bar, qty <= MIN_QTY && styles.barDimmed]} />
              </Pressable>
              <AnimatedCount
                value={qty}
                fontSize={16}
                color={colors.text}
                fontFamily={fontFamily.semibold}
                accessibilityLabel={`Quantity ${qty}`}
              />
              <Pressable
                onPress={() => changeQty(1)}
                disabled={qty >= MAX_QTY}
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
                accessibilityValue={{ text: `${qty}` }}
                accessibilityState={{ disabled: qty >= MAX_QTY }}
                style={({ pressed }) => [styles.stepButton, pressed && styles.stepPressed]}
              >
                <View style={[styles.bar, qty >= MAX_QTY && styles.barDimmed]} />
                <View style={[styles.bar, styles.barVertical, qty >= MAX_QTY && styles.barDimmed]} />
              </Pressable>
            </View>
            <Pressable
              onPress={onAdd}
              accessibilityRole="button"
              accessibilityLabel={
                added ? "Added to cart" : `Add ${qty} to cart, total ${totalText}`
              }
              style={({ pressed }) => [styles.addButton, pressed && !added && styles.pressed]}
            >
              {added ? (
                <View style={styles.addedRow}>
                  <Icon name="check" size={16} color={colors.white} weight="semibold" />
                  <Text style={styles.addText}>Added to cart</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.addText}>Add</Text>
                  <Text style={styles.addText}>{totalText}</Text>
                </>
              )}
            </Pressable>
          </>
        )}
      </View>
      {/* Inside this sheet's Modal tree, so its Modal presents above it. */}
      <ReplaceCartSheet
        visible={replaceFrom != null}
        oldVendor={lastReplaceFrom}
        newVendor={data.vendorName}
        onConfirm={confirmReplace}
        onCancel={() => setReplaceFrom(null)}
      />
    </BottomSheet>
  );
}

function GroupCard({
  group,
  selected,
  onToggle,
}: {
  group: OptionGroup;
  selected: readonly string[];
  onToggle: (groupId: string, optionId: string) => void;
}) {
  const single = isSingleSelect(group);
  const badge = group.required ? "Required" : "Optional";
  const subtitle = single ? "Choose 1" : `Choose up to ${group.max}`;
  return (
    <>
      <View
        style={styles.groupHeader}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${group.title}, ${badge}, ${subtitle}`}
      >
        <View style={styles.groupTitleRow}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          <View style={[styles.pill, group.required ? styles.pillRequired : styles.pillOptional]}>
            <Text
              style={[
                styles.pillText,
                group.required ? styles.pillTextRequired : styles.pillTextOptional,
              ]}
            >
              {badge}
            </Text>
          </View>
        </View>
        <Text style={styles.groupSubtitle}>{subtitle}</Text>
      </View>
      {group.options.map((option, index) => {
        const isOn = selected.includes(option.id);
        const priceText = `+${formatMinorFixed(option.priceMinor)}`;
        return (
          <Pressable
            key={option.id}
            onPress={() => onToggle(group.id, option.id)}
            accessibilityRole={single ? "radio" : "checkbox"}
            accessibilityState={{ checked: isOn }}
            accessibilityLabel={`${option.label}, ${priceText}`}
            style={({ pressed }) => [
              styles.optionRow,
              index > 0 && styles.optionDivider,
              pressed && styles.pressed,
            ]}
          >
            {single ? (
              <View style={[styles.radio, isOn && styles.controlOn]}>
                {isOn ? <View style={styles.radioDot} /> : null}
              </View>
            ) : (
              <View style={[styles.checkbox, isOn && styles.checkboxOn]}>
                {isOn ? (
                  <Icon name="check" size={14} color={colors.white} weight="semibold" />
                ) : null}
              </View>
            )}
            <Text style={styles.optionLabel}>{option.label}</Text>
            <Text style={styles.optionPrice}>{priceText}</Text>
          </Pressable>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: CARD_MARGIN,
    paddingTop: 4,
    paddingBottom: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
  },
  pressed: {
    opacity: 0.7,
  },
  stepPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.92 }],
  },
  scroll: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    padding: CARD_MARGIN,
    gap: 12,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  cardFlash: {
    borderColor: colors.requiredRed,
  },
  hero: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.imagePlaceholder,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    marginTop: 14,
    fontFamily: fontFamily.bold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
  },
  price: {
    marginTop: 6,
    fontFamily: fontFamily.bold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
  },
  oldPrice: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textDecorationLine: "line-through",
  },
  description: {
    marginTop: 10,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  vendorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  vendor: {
    flexShrink: 1,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  // >= 44pt touch target for the storefront link.
  vendorLink: {
    minHeight: 44,
    alignSelf: "flex-start",
    paddingRight: 8,
  },
  vendorLinkText: {
    fontFamily: fontFamily.semibold,
    color: colors.primary,
  },
  groupHeader: {
    paddingBottom: 6,
  },
  groupTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  groupTitle: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.text,
  },
  groupSubtitle: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pillRequired: {
    backgroundColor: REQUIRED_BG,
  },
  pillOptional: {
    backgroundColor: colors.surfaceMuted,
  },
  pillText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
  },
  pillTextRequired: {
    color: colors.requiredRed,
  },
  pillTextOptional: {
    color: colors.textMuted,
  },
  optionRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  optionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  radio: {
    width: CONTROL,
    height: CONTROL,
    borderRadius: CONTROL / 2,
    borderWidth: 2,
    borderColor: CONTROL_OFF,
    alignItems: "center",
    justifyContent: "center",
  },
  controlOn: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  checkbox: {
    width: CONTROL,
    height: CONTROL,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: CONTROL_OFF,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  optionLabel: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 15,
    color: colors.text,
  },
  optionPrice: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
  note: {
    minHeight: 72,
    padding: 0,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
    textAlignVertical: "top",
  },
  helper: {
    marginTop: 8,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: CARD_MARGIN,
    paddingTop: 12,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  stepper: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: STEPPER_BORDER,
    borderRadius: 999,
  },
  stepButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  bar: {
    width: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.text,
  },
  barVertical: {
    position: "absolute",
    width: 2,
    height: 14,
  },
  barDimmed: {
    opacity: 0.3,
  },
  addButton: {
    flex: 1,
    minHeight: 52,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  addDisabled: {
    backgroundColor: colors.disabledFill,
  },
  addText: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.white,
  },
  addDisabledText: {
    color: colors.disabledText,
  },
  addedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
