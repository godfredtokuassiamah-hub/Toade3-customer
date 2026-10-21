// Vendor storefront (root stack route above the tabs). Reached by tapping any
// food/catalog item card, which routes to the owning vendor via
// router.push("/storefront/[vendorId]"). Lists that vendor's full menu grouped
// by category, reusing FoodCard's visual language. Auto-registers under the
// root <Stack> (headerShown:false default); draws its own transparent back-bar
// like favourites.tsx / notifications.tsx.
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import {
  Pressable,
  SectionList,
  type SectionListRenderItem,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { catalogItemToFoodCardItem } from "../../components/discovery/cardItem";
import { FoodCard, type FoodCardItem } from "../../components/home/FoodCard";
import { searchStyles } from "../../components/search/searchStyles";
import { Avatar } from "../../components/ui/Avatar";
import { EmptyState } from "../../components/ui/EmptyState";
import { Icon } from "../../components/ui/Icon";
import { CATEGORIES, getItemsByVendor, getVendorById } from "../../data/mock/catalog";
import { groupItemsByCategory } from "../../lib/discovery/menuSections";
import { isOrderable, vendorOpenAt } from "../../lib/discovery/predicate";
import type { ItemStatus, MockItem } from "../../lib/discovery/types";
import { formatEta } from "../../lib/format";
import { colors, fontFamily } from "../../theme";

const SIDE = 14;
// Height of the transparent top bar below the safe-area inset.
const TOP_BAR_HEIGHT = 52;

// Empty-state illustration reused from the Favourites screen (Icons8 asset;
// attribution handled there — see favourites.tsx).
const EMPTY_ILLUSTRATION = require("../../../assets/icons/favourites/empty-favourites.png");

type Row = FoodCardItem & { status?: ItemStatus };

// Shared status derivation (matches oracle.ts): closed if the vendor is shut,
// sold-out if the item can't be ordered, else available. Keeps sold-out /
// closed rows visible and marked, like the cards elsewhere.
function deriveStatus(item: MockItem, vendorOpen: boolean): ItemStatus {
  if (!vendorOpen) return "closed";
  if (!isOrderable(item)) return "sold_out";
  return "available";
}

export default function Storefront() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();

  const vendor = useMemo(() => getVendorById(vendorId), [vendorId]);
  const open = useMemo(() => (vendor ? vendorOpenAt(vendor, new Date()) : false), [vendor]);

  const items = useMemo(() => (vendor ? getItemsByVendor(vendorId) : []), [vendor, vendorId]);

  // Minimum ETA across the menu for a cheap, real delivery note (no fake
  // ratings). undefined when the vendor has no visible items.
  const minEta = useMemo(
    () => (items.length > 0 ? Math.min(...items.map((i) => i.eta_mins)) : undefined),
    [items],
  );

  const sections = useMemo(() => {
    const grouped = groupItemsByCategory(items, CATEGORIES);
    return grouped.map((section) => ({
      ...section,
      data: section.data.map<Row>((item) => ({
        ...catalogItemToFoodCardItem(item),
        status: deriveStatus(item, open),
      })),
    }));
  }, [items, open]);

  const cardWidth = width - SIDE * 2;
  const barHeight = insets.top + TOP_BAR_HEIGHT;

  const renderItem: SectionListRenderItem<Row> = ({ item }) => (
    <View style={styles.rowWrap}>
      <FoodCard item={item} width={cardWidth} />
    </View>
  );

  // Transparent overlay back-bar, same pattern as favourites / notifications.
  const topBar = (
    <View style={[styles.topBar, { paddingTop: insets.top }]} pointerEvents="box-none">
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={4}
        style={({ pressed }) => [styles.iconButton, pressed && searchStyles.pressed]}
      >
        <Icon name="arrowLeft" size={20} color={colors.text} weight="medium" />
      </Pressable>
    </View>
  );

  if (!vendor) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <EmptyState
          image={EMPTY_ILLUSTRATION}
          title="Restaurant not found"
          body="We couldn't find this restaurant. It may have closed or the link is out of date."
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [styles.backButton, pressed && searchStyles.pressed]}
          >
            <Text style={styles.backButtonText}>Go back</Text>
          </Pressable>
        </EmptyState>
        {topBar}
      </View>
    );
  }

  const statusLine = open
    ? `Open now · ${vendor.hours.open}–${vendor.hours.close}`
    : `Closed · opens ${vendor.hours.open}`;

  const header = (
    <View style={styles.header}>
      <Avatar name={vendor.name} size={64} />
      <Text style={styles.vendorName} accessibilityRole="header">
        {vendor.name}
      </Text>
      <Text style={[styles.statusText, open ? styles.open : styles.closed]}>{statusLine}</Text>
      {minEta != null ? (
        <Text style={styles.etaNote}>Delivery from {formatEta(minEta)}</Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader} accessibilityRole="header">
            {section.title}
          </Text>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Text style={styles.emptyMenu}>This restaurant has no items available right now.</Text>
        }
        stickySectionHeadersEnabled={false}
        initialNumToRender={8}
        windowSize={9}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          // Clear the absolute top bar, and (root stack route, no tab bar
          // shown) only the safe-area inset at the bottom.
          { paddingTop: barHeight, paddingBottom: insets.bottom + 24 },
        ]}
      />
      {topBar}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: SIDE,
    paddingBottom: 8,
    backgroundColor: "transparent",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: SIDE,
  },
  header: {
    alignItems: "flex-start",
    paddingTop: 8,
    paddingBottom: 4,
  },
  vendorName: {
    marginTop: 12,
    fontFamily: fontFamily.bold,
    fontSize: 22,
    color: colors.text,
  },
  statusText: {
    marginTop: 6,
    fontFamily: fontFamily.semibold,
    fontSize: 13,
  },
  open: {
    color: colors.primary,
  },
  closed: {
    color: colors.textMuted,
  },
  etaNote: {
    marginTop: 4,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  sectionHeader: {
    marginTop: 20,
    marginBottom: 10,
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: colors.text,
  },
  rowWrap: {
    marginBottom: 10,
  },
  emptyMenu: {
    marginTop: 24,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  backButton: {
    marginTop: 20,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.text,
  },
});
