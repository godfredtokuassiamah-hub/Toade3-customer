// White content sheet that overlaps the hero: logo on the seam, vendor name,
// status + "More info", stats row (rating / fee / ETA), promo row,
// presentation disclaimer, and the Search / Categories buttons. No fixed
// heights on text containers, so large Dynamic Type grows the block (its
// height is measured by the screen, never assumed).
import { Image } from "expo-image";
import { memo, type ReactNode } from "react";
import { type ImageSourcePropType, Pressable, StyleSheet, Text, View } from "react-native";

import { formatCedi } from "../../lib/discovery/money";
import type { MockVendor } from "../../lib/discovery/types";
import { getInitials } from "../../lib/format";
import {
  etaSpanAccessibilityLabel,
  formatEtaSpan,
  formatRating,
  ratingAccessibilityLabel,
  type StorefrontEstimate,
} from "../../lib/storefront/storefrontDisplay";
import { colors, fontFamily } from "../../theme";
import { Icon } from "../ui/Icon";
import { LOGO, SHEET_RADIUS, SIDE } from "./metrics";
import { StoreGlyph } from "./StoreGlyph";

// TODO(promo-icon): the user's Icons8 link
// (https://img.icons8.com/?size=100&id=undefined&format=png&color=000000)
// 404s because its id is literally "undefined". The user must provide the
// correct Icons8 URL; then set this to
// { uri: "https://img.icons8.com/?size=100&id=<ID>&format=png&color=000000" }
// (Icons8 needs attribution or a paid licence before release).
// null keeps the red % badge.
const PROMO_BADGE_SOURCE: ImageSourcePropType | null = null;

type Props = {
  vendor: MockVendor;
  open: boolean;
  statusLine: string;
  estimate: StorefrontEstimate | null;
  maxDiscount: number | null;
  onMoreInfo: () => void;
  onSearch: () => void;
  onCategories: () => void;
  categoriesDisabled: boolean;
};

function StorefrontInfoBase({
  vendor,
  open,
  statusLine,
  estimate,
  maxDiscount,
  onMoreInfo,
  onSearch,
  onCategories,
  categoriesDisabled,
}: Props) {
  // MOCK rating (demo placeholder, replace with real reviews S7 before
  // release). No rating -> the column isn't rendered at all.
  const rating = vendor.rating;
  const columns: { key: string; label: string; node: ReactNode }[] = [];
  if (rating) {
    columns.push({
      key: "rating",
      label: ratingAccessibilityLabel(rating),
      node: (
        <>
          <StoreGlyph name="star" size={14} color={colors.text} />
          <Text style={styles.statText}>{formatRating(rating)}</Text>
        </>
      ),
    });
  }
  if (estimate) {
    // DISPLAY ESTIMATE (see storefrontDeliveryEstimate); checkout quotes.
    columns.push({
      key: "fee",
      label: `Delivery fee about ${formatCedi(estimate.feeMinor)}, estimate`,
      node: (
        <>
          <Icon name="delivery" size={14} color={colors.text} />
          <Text style={styles.statText}>{formatCedi(estimate.feeMinor)} delivery</Text>
        </>
      ),
    });
    columns.push({
      key: "eta",
      label: `${etaSpanAccessibilityLabel(estimate.etaMins)}, estimate`,
      node: (
        <>
          <Icon name="clock" size={14} color={colors.text} />
          <Text style={styles.statText}>{formatEtaSpan(estimate.etaMins)}</Text>
        </>
      ),
    });
  }

  return (
    <View style={styles.sheet}>
      <View
        style={styles.logo}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {vendor.logo ? (
          // Inner clip so the outer badge keeps its shadow on iOS.
          <View style={styles.logoClip}>
            <Image
              source={vendor.logo}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessible={false}
            />
          </View>
        ) : (
          <Text style={styles.logoText}>{getInitials(vendor.name)}</Text>
        )}
      </View>

      <Text style={styles.name} accessibilityRole="header" numberOfLines={2}>
        {vendor.name}
      </Text>

      <View style={styles.statusRow}>
        <Text style={[styles.status, open ? styles.open : styles.closed]}>{statusLine}</Text>
        <Pressable
          onPress={onMoreInfo}
          accessibilityRole="button"
          accessibilityLabel={`More info about ${vendor.name}`}
          hitSlop={8}
          style={({ pressed }) => [styles.moreInfo, pressed && styles.pressed]}
        >
          <Text style={styles.moreInfoText}>More info</Text>
          <Icon name="chevronRight" size={12} color={colors.text} />
        </Pressable>
      </View>

      {columns.length > 0 ? (
        <View style={styles.stats}>
          {columns.map((c, i) => (
            <View key={c.key} style={styles.statCell}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.stat} accessible accessibilityLabel={c.label}>
                {c.node}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {maxDiscount != null ? (
        // MOCK promo (no promo system yet) — display only.
        <View
          style={styles.promo}
          accessible
          accessibilityLabel={`Offer: ${maxDiscount}% off selected items`}
        >
          {PROMO_BADGE_SOURCE ? (
            <Image
              source={PROMO_BADGE_SOURCE}
              style={styles.promoIcon}
              contentFit="contain"
              accessible={false}
            />
          ) : (
            <View style={styles.promoBadge}>
              <StoreGlyph name="percent" size={13} color={colors.white} weight="bold" />
            </View>
          )}
          <Text style={styles.promoText}>{maxDiscount}% off selected items</Text>
        </View>
      ) : null}

      <Text style={styles.disclaimer}>Images are for presentation purposes only!</Text>

      <View style={styles.actions}>
        <Pressable
          onPress={onSearch}
          accessibilityRole="button"
          accessibilityLabel="Search"
          accessibilityHint={`Filters ${vendor.name}'s menu`}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Icon name="search" size={18} color={colors.text} />
          <Text style={styles.actionText}>Search</Text>
        </Pressable>
        <Pressable
          onPress={onCategories}
          disabled={categoriesDisabled}
          accessibilityRole="button"
          accessibilityLabel="Categories"
          accessibilityHint="Jump to a menu section"
          accessibilityState={{ disabled: categoriesDisabled }}
          style={({ pressed }) => [
            styles.action,
            categoriesDisabled && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <StoreGlyph name="list" size={18} color={colors.text} />
          <Text style={styles.actionText}>Categories</Text>
        </Pressable>
      </View>
    </View>
  );
}

export const StorefrontInfo = memo(StorefrontInfoBase);

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    paddingTop: LOGO / 2 + 12,
    paddingHorizontal: SIDE,
    paddingBottom: 12,
  },
  logo: {
    position: "absolute",
    top: -LOGO / 2,
    alignSelf: "center",
    width: LOGO,
    height: LOGO,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    boxShadow: "0px 2px 8px rgba(0,0,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoClip: {
    ...StyleSheet.absoluteFill,
    borderRadius: 18,
    overflow: "hidden",
  },
  logoText: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    color: colors.primary,
  },
  name: {
    textAlign: "center",
    fontFamily: fontFamily.bold,
    fontSize: 24,
    color: colors.text,
  },
  statusRow: {
    marginTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    columnGap: 10,
    rowGap: 4,
  },
  status: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
  },
  open: {
    color: colors.primary,
  },
  closed: {
    color: colors.textMuted,
  },
  moreInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: 24,
  },
  moreInfoText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: colors.text,
    textDecorationLine: "underline",
  },
  stats: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "stretch",
  },
  statCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: colors.hairline,
  },
  stat: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
  },
  statText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: colors.text,
    textAlign: "center",
  },
  promo: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    // 16 (was 12): +8dp total height.
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
  },
  promoIcon: {
    width: 24,
    height: 24,
  },
  promoBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  promoText: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.text,
  },
  disclaimer: {
    marginTop: 12,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  actions: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  action: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionText: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
