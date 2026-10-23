// Vendor storefront (root stack route above the tabs). Reached by tapping any
// food/catalog item card, which routes to the owning vendor via
// router.push("/storefront/[vendorId]"). Auto-registers under the root
// <Stack> (headerShown:false default) and draws its own header.
//
// Two states of ONE screen, driven by the scroll offset on the UI thread
// (useStorefrontScroll):
// - Expanded: cover photo hero, white rounded sheet with the logo on the
//   seam, name, More info, stats, promo row, Search / Categories buttons.
// - Collapsed: the hero scrolls away (parallax), a white compact header with
//   the vendor name fades in, and the category tab strip pins under it; the
//   active tab follows the section in view, tapping a tab scrolls to it.
//
// Layering (bottom -> top): hero (absolute, behind) -> Animated.ScrollView
// (transparent spacer, then white content) -> tab strip overlay (single
// instance, translateY = max(bar, stripY - scrollY)) -> header bar overlay.
// No overscroll bounce; no blur/glass views; transform/opacity only.
//
// Cart: tapping a menu row opens ONE screen-level ItemDetailSheet for that
// item (its "View <vendor> ›" link just closes here, see
// isOnVendorStorefront). "+" quick-adds one unit (decideQuickAdd): items
// with a required option open the sheet instead, another vendor's cart asks
// "Start a new cart?" (ReplaceCartSheet), unavailable items are disabled.
// The floating CartBar (placement "stack", no tab bar here) goes to checkout.
//
// TODO(perf): one ScrollView (no virtualization) is fine for today's mock
// menus (<= ~30 items). Switch to a virtualized list past ~100 items.
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { AccessibilityInfo, Pressable, Share, StyleSheet, Text, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CartBar } from "../../components/cart/CartBar";
import { ReplaceCartSheet } from "../../components/cart/ReplaceCartSheet";
import { useCartBarInset } from "../../components/cart/useCartBarInset";
import { catalogItemToFoodCardItem } from "../../components/discovery/cardItem";
import type { FoodCardItem } from "../../components/home/FoodCard";
import { ItemDetailSheet } from "../../components/item/ItemDetailSheet";
import { searchStyles } from "../../components/search/searchStyles";
import { CategoriesSheet } from "../../components/storefront/CategoriesSheet";
import { CategoryTabStrip } from "../../components/storefront/CategoryTabStrip";
import { InfoSheet } from "../../components/storefront/InfoSheet";
import { MenuItemRow } from "../../components/storefront/MenuItemRow";
import { SIDE, TAB_H } from "../../components/storefront/metrics";
import { StorefrontHeaderBar } from "../../components/storefront/StorefrontHeaderBar";
import { StorefrontHero } from "../../components/storefront/StorefrontHero";
import { StorefrontInfo } from "../../components/storefront/StorefrontInfo";
import { useStorefrontScroll } from "../../components/storefront/useStorefrontScroll";
import { EmptyState } from "../../components/ui/EmptyState";
import { Icon } from "../../components/ui/Icon";
import { CATEGORIES, getItemsByVendor, getVendorById } from "../../data/mock/catalog";
import { getOptionGroups } from "../../data/mock/itemOptions";
import { addToCart, getCart, newLineId } from "../../lib/cart/cartStore";
import { lightHaptic, selectionHaptic } from "../../lib/haptics";
import { isOrderable, vendorOpenAt } from "../../lib/discovery/predicate";
import type { ItemStatus, MockItem, MockVendor } from "../../lib/discovery/types";
import {
  itemSubtitle,
  maxDiscountPercent,
  storefrontDeliveryEstimate,
} from "../../lib/storefront/storefrontDisplay";
import { decideQuickAdd, quickAddLine } from "../../lib/storefront/quickAdd";
import { buildStorefrontSections, filterMenuItems } from "../../lib/storefront/storefrontSections";
import { colors, fontFamily } from "../../theme";

// Empty-state illustration reused from the Favourites screen (Icons8 asset;
// attribution handled there — see favourites.tsx).
const EMPTY_ILLUSTRATION = require("../../../assets/icons/favourites/empty-favourites.png");

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
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();

  const vendor = useMemo(() => getVendorById(vendorId), [vendorId]);

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
        {/* Transparent overlay back-bar, same pattern as favourites / notifications. */}
        <View
          style={[styles.topBar, { paddingTop: insets.top }]}
          pointerEvents="box-none"
        >
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
      </View>
    );
  }

  return <StorefrontContent vendor={vendor} />;
}

function StorefrontContent({ vendor }: { vendor: MockVendor }) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const open = useMemo(() => vendorOpenAt(vendor, new Date()), [vendor]);
  const items = useMemo(() => getItemsByVendor(vendor.vendor_id), [vendor]);
  const labelById = useMemo(() => new Map(CATEGORIES.map((c) => [c.id, c.label])), []);
  // DISPLAY ESTIMATE: zone-2 matrix fee + min..max item eta (see helper).
  const estimate = useMemo(() => storefrontDeliveryEstimate(items), [items]);
  // MOCK promo flags (display only).
  const maxDiscount = useMemo(() => maxDiscountPercent(items), [items]);
  // Vendor cover art if set, else the first item photo, else the placeholder.
  const cover = useMemo(
    () => vendor.cover ?? items.find((i) => i.image)?.image,
    [vendor, items],
  );

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  // TODO(favourite-stores): local-only toggle. FavouriteButton stores ITEM
  // ids, so vendor ids must not go into that list.
  const [saved, setSaved] = useState(false);

  // Item detail sheet (FoodCard's mounted/visible pattern; the item doubles
  // as the "mounted" flag and is cleared after the exit animation).
  const [sheetItem, setSheetItem] = useState<FoodCardItem | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  // "+" on another vendor's cart: the item waiting for the confirm, and the
  // current cart's vendor name (mirrored so the text doesn't blank while the
  // confirm sheet animates out, as in ItemDetailSheet).
  const [pendingReplace, setPendingReplace] = useState<MockItem | null>(null);
  const [replaceFrom, setReplaceFrom] = useState<string | null>(null);
  const [lastReplaceFrom, setLastReplaceFrom] = useState("");
  if (replaceFrom != null && replaceFrom !== lastReplaceFrom) setLastReplaceFrom(replaceFrom);
  const cartInset = useCartBarInset();

  const searching = query.trim() !== "";
  const sections = useMemo(
    () =>
      buildStorefrontSections(filterMenuItems(items, query), CATEGORIES, {
        includeFeatured: !searching,
      }),
    [items, query, searching],
  );
  const sectionIds = useMemo(() => sections.map((s) => s.id), [sections]);

  // Destructured so the React Compiler lint tracks the ref on its own
  // binding (an object holding a ref is treated as a ref during render).
  const {
    layout,
    scrollRef,
    onScroll,
    activeIndex,
    collapsed,
    stripReady,
    viewportH,
    heroStyle,
    barBgStyle,
    titleStyle,
    circleStyle,
    stripStyle,
    onStripLayout,
    onSectionLayout,
    onContentSizeChange,
    onViewportLayout,
    scrollToSection,
    scrollToPinned,
    setForceCompact,
  } = useStorefrontScroll({
    sectionIds,
    insetTop: insets.top,
    reducedMotion,
  });

  const statusLine = open
    ? `Open now · ${vendor.hours.open}–${vendor.hours.close}`
    : `Closed · opens ${vendor.hours.open}`;

  // Last block fills the viewport under the pinned chrome so every section
  // (and the search pin position) can be scrolled to exactly.
  const fillMin = Math.max(0, viewportH - layout.pinnedH);

  const openSearch = () => {
    setSearchOpen(true);
    setForceCompact(true);
    scrollToPinned();
  };
  const closeSearch = () => {
    setQuery("");
    setSearchOpen(false);
    setForceCompact(false);
  };

  const onShare = () => {
    const url = Linking.createURL(`storefront/${vendor.vendor_id}`);
    Share.share({ message: `${vendor.name} on Toade3: ${url}` }).catch(() => {});
  };

  const onToggleSave = () => {
    lightHaptic();
    setSaved((s) => !s);
  };

  const onSelectCategory = (index: number) => {
    setCategoriesOpen(false);
    scrollToSection(index);
  };

  const openItem = (item: MockItem) => {
    setSheetItem({ ...catalogItemToFoodCardItem(item), status: deriveStatus(item, open) });
    setSheetVisible(true);
  };

  // Returns true when a line was added now (the row then shows its check).
  const quickAdd = (item: MockItem): boolean => {
    const decision = decideQuickAdd({
      status: deriveStatus(item, open),
      groups: getOptionGroups(item.item_id, item.category_ids),
      // Read at press time, as the item sheet does.
      cart: getCart(),
      vendorId: vendor.vendor_id,
    });
    switch (decision.kind) {
      case "disabled":
        return false;
      case "open-sheet":
        openItem(item);
        return false;
      case "replace-cart":
        setPendingReplace(item);
        setReplaceFrom(decision.fromVendor);
        return false;
      case "add":
        addToCart(quickAddLine(item, vendor.name, newLineId()), false);
        selectionHaptic();
        return true;
    }
  };

  const cancelReplace = () => {
    setReplaceFrom(null);
    setPendingReplace(null);
  };

  const confirmReplace = () => {
    if (pendingReplace) {
      // Clears the other vendor's cart and adds this line.
      addToCart(quickAddLine(pendingReplace, vendor.name, newLineId()), true);
      selectionHaptic();
      AccessibilityInfo.announceForAccessibility(`Added ${pendingReplace.name} to cart`);
    }
    cancelReplace();
  };

  return (
    <View style={styles.root}>
      <StatusBar style={collapsed || searchOpen ? "dark" : "light"} />
      <StorefrontHero image={cover} insetTop={insets.top} style={heroStyle} />

      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onContentSizeChange={onContentSizeChange}
        onLayout={onViewportLayout}
        style={styles.scroll}
      >
        {/* Transparent: the hero shows through. */}
        <View style={{ height: layout.sheetTop }} />
        <StorefrontInfo
          vendor={vendor}
          open={open}
          statusLine={statusLine}
          estimate={estimate}
          maxDiscount={maxDiscount}
          onMoreInfo={() => setInfoOpen(true)}
          onSearch={openSearch}
          onCategories={() => setCategoriesOpen(true)}
          categoriesDisabled={sections.length === 0}
        />
        {/* In-flow slot the sticky tab strip overlay sits on until it pins. */}
        <View
          style={styles.stripSlot}
          onLayout={onStripLayout}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        />
        {sections.length === 0 ? (
          <View
            style={[
              styles.section,
              { minHeight: fillMin, paddingBottom: insets.bottom + 24 + cartInset },
            ]}
          >
            <Text style={styles.emptyMenu}>
              {searching
                ? `No items match "${query.trim()}"`
                : "This restaurant has no items available right now."}
            </Text>
          </View>
        ) : (
          sections.map((section, i) => {
            const last = i === sections.length - 1;
            return (
              <View
                key={section.id}
                onLayout={onSectionLayout(section.id)}
                style={[
                  styles.section,
                  last && {
                    minHeight: fillMin,
                    paddingBottom: insets.bottom + 24 + cartInset,
                  },
                ]}
              >
                <Text style={styles.sectionHeader} accessibilityRole="header">
                  {section.title}
                </Text>
                {section.data.map((item) => (
                  <MenuItemRow
                    key={`${section.id}:${item.item_id}`}
                    item={item}
                    subtitle={itemSubtitle(item, labelById)}
                    status={deriveStatus(item, open)}
                    onOpen={openItem}
                    onAdd={quickAdd}
                  />
                ))}
              </View>
            );
          })
        )}
      </Animated.ScrollView>

      {sections.length > 0 ? (
        <Animated.View
          style={[styles.strip, stripStyle]}
          pointerEvents={stripReady ? "box-none" : "none"}
        >
          <CategoryTabStrip
            sections={sections}
            activeIndex={activeIndex}
            onPressTab={scrollToSection}
          />
        </Animated.View>
      ) : null}

      <StorefrontHeaderBar
        vendorName={vendor.name}
        insetTop={insets.top}
        collapsed={collapsed}
        bgStyle={barBgStyle}
        titleStyle={titleStyle}
        circleStyle={circleStyle}
        saved={saved}
        onToggleSave={onToggleSave}
        onShare={onShare}
        searchOpen={searchOpen}
        query={query}
        onChangeQuery={setQuery}
        onOpenSearch={openSearch}
        onCloseSearch={closeSearch}
      />

      <CartBar placement="stack" />

      <CategoriesSheet
        visible={categoriesOpen}
        sections={sections}
        onClose={() => setCategoriesOpen(false)}
        onSelect={onSelectCategory}
      />
      <InfoSheet
        visible={infoOpen}
        vendor={vendor}
        open={open}
        onClose={() => setInfoOpen(false)}
        onShare={onShare}
      />
      {sheetItem ? (
        <ItemDetailSheet
          key={sheetItem.id}
          item={sheetItem}
          visible={sheetVisible}
          onClose={() => setSheetVisible(false)}
          onClosed={() => setSheetItem(null)}
        />
      ) : null}
      <ReplaceCartSheet
        visible={replaceFrom != null}
        oldVendor={lastReplaceFrom}
        newVendor={vendor.name}
        onConfirm={confirmReplace}
        onCancel={cancelReplace}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scroll: {
    flex: 1,
    backgroundColor: "transparent",
  },
  stripSlot: {
    height: TAB_H,
    backgroundColor: colors.white,
  },
  strip: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  section: {
    backgroundColor: colors.white,
    paddingHorizontal: SIDE,
  },
  sectionHeader: {
    marginTop: 20,
    marginBottom: 2,
    fontFamily: fontFamily.semibold,
    fontSize: 18,
    color: colors.text,
  },
  emptyMenu: {
    marginTop: 24,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
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
