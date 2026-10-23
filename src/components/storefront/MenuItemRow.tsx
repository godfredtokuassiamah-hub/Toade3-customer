// Horizontal storefront menu row (mockup): text on the left (badges, name,
// subtitle, price with struck-through original for MOCK discounts), photo on
// the right with a round "+" button over its corner.
//
// Tapping the row body calls onOpen (the screen opens the item sheet).
// "+" is a sibling hit target (not nested, so VoiceOver reaches both) that
// calls onAdd; the screen decides (add / open sheet / replace-cart) and
// returns true only when a line was added now, which shows a brief check
// and announces it. Haptics live in the screen, which knows the outcome.
import { Image } from "expo-image";
import { memo, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";

import { formatCedi } from "../../lib/discovery/money";
import type { ItemStatus, MockItem } from "../../lib/discovery/types";
import { originalPriceFromDiscount } from "../../lib/storefront/storefrontDisplay";
import { colors, fontFamily } from "../../theme";
import { Icon } from "../ui/Icon";
import { ADD_SIZE, ADDED_MS, ROW_IMAGE, ROW_PAD_V } from "./metrics";
import { StoreGlyph } from "./StoreGlyph";

const STATUS_LABEL: Record<Exclude<ItemStatus, "available">, string> = {
  closed: "Closed",
  sold_out: "Sold out",
};

type Props = {
  item: MockItem;
  subtitle: string;
  status: ItemStatus;
  onOpen: (item: MockItem) => void;
  // True when the item was added to the cart by this press.
  onAdd: (item: MockItem) => boolean;
};

function MenuItemRowBase({ item, subtitle, status, onOpen, onAdd }: Props) {
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const available = status === "available";
  const statusLabel = status !== "available" ? STATUS_LABEL[status] : null;
  const price = formatCedi(item.price_minor);
  // MOCK promo (display only): original derived from discountPercent.
  const original = originalPriceFromDiscount(item.price_minor, item.discountPercent);
  const originalText = original != null ? formatCedi(original) : null;

  const label = [
    item.name,
    price,
    originalText != null ? `was ${originalText}, ${item.discountPercent}% off` : null,
    item.popular ? "popular" : null,
    statusLabel,
    subtitle,
  ]
    .filter(Boolean)
    .join(", ");

  const onPressAdd = () => {
    if (!onAdd(item)) return;
    setAdded(true);
    AccessibilityInfo.announceForAccessibility(`Added ${item.name} to cart`);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), ADDED_MS);
  };

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onOpen(item)}
        accessibilityRole="button"
        accessibilityLabel={`${label}, opens item details`}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
      >
        <View style={styles.text}>
          {item.popular || originalText != null ? (
            <View style={styles.badges}>
              {item.popular ? (
                <View style={[styles.badge, styles.popular]}>
                  <Text style={[styles.badgeText, styles.popularText]}>Popular</Text>
                </View>
              ) : null}
              {originalText != null ? (
                <View style={[styles.badge, styles.discount]}>
                  <Text style={[styles.badgeText, styles.discountText]}>
                    -{item.discountPercent}%
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
          <View style={styles.priceRow}>
            <Text style={[styles.price, originalText != null && styles.priceDiscounted]}>
              {price}
            </Text>
            {originalText != null ? <Text style={styles.original}>{originalText}</Text> : null}
          </View>
          {statusLabel ? <Text style={styles.status}>{statusLabel}</Text> : null}
        </View>

        <View style={[styles.imageBox, !available && styles.dimmed]}>
          {item.image ? (
            <Image
              source={item.image}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
              recyclingKey={item.item_id}
              accessible={false}
            />
          ) : (
            <Icon name="orders" size={24} color={colors.imagePlaceholderIcon} />
          )}
        </View>
      </Pressable>

      {/* Sibling of the body, drawn over the image corner; renders last so it
          wins touches there. 32dp + hitSlop 6 = 44dp target. */}
      <Pressable
        onPress={onPressAdd}
        disabled={!available}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Add ${item.name} to cart`}
        accessibilityHint={statusLabel ?? undefined}
        accessibilityState={{ disabled: !available }}
        style={({ pressed }) => [
          styles.add,
          !available && styles.addDisabled,
          pressed && styles.pressed,
        ]}
      >
        {added ? (
          <Icon name="check" size={16} color={colors.primary} weight="semibold" />
        ) : (
          <StoreGlyph name="plus" size={16} color={colors.text} weight="semibold" />
        )}
      </Pressable>
    </View>
  );
}

export const MenuItemRow = memo(MenuItemRowBase);

const styles = StyleSheet.create({
  row: {
    position: "relative",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  body: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    minHeight: 112,
    paddingVertical: ROW_PAD_V,
  },
  text: {
    flex: 1,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
  },
  popular: {
    backgroundColor: colors.primaryLight,
  },
  popularText: {
    color: colors.primary,
  },
  discount: {
    backgroundColor: colors.error,
  },
  discountText: {
    color: colors.white,
  },
  name: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  priceRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    columnGap: 8,
  },
  price: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: colors.text,
  },
  priceDiscounted: {
    color: colors.error,
  },
  original: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
  status: {
    marginTop: 4,
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: colors.textMuted,
  },
  imageBox: {
    width: ROW_IMAGE,
    height: ROW_IMAGE,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.imagePlaceholder,
    alignItems: "center",
    justifyContent: "center",
  },
  dimmed: {
    opacity: 0.45,
  },
  add: {
    position: "absolute",
    // Same spot as before: 6dp past the image's bottom-right corner.
    right: -6,
    top: ROW_PAD_V + ROW_IMAGE + 6 - ADD_SIZE,
    width: ADD_SIZE,
    height: ADD_SIZE,
    borderRadius: ADD_SIZE / 2,
    backgroundColor: colors.white,
    boxShadow: "0px 1px 4px rgba(0,0,0,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  addDisabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
