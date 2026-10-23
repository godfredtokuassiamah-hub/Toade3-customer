// "See all" for one Stores section: every store in it, full-width cards in
// a plain vertical FlatList. Root stack route above the tabs. Unknown or
// missing params fall back to "Near you" / no category.
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo } from "react";
import {
  FlatList,
  type ListRenderItem,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CartBar } from "../components/cart/CartBar";
import { useCartBarInset } from "../components/cart/useCartBarInset";
import { searchStyles } from "../components/search/searchStyles";
import { StoreCard } from "../components/stores/StoreCard";
import { openStorefront } from "../components/stores/StoreRow";
import { useDropoff } from "../components/stores/useDropoff";
import { Icon } from "../components/ui/Icon";
import { isStoreCategory } from "../data/mock/stores";
import { useStores } from "../hooks/useStores";
import {
  isStoreSectionId,
  type QuotedStore,
  sectionTitle,
  storesForSection,
} from "../lib/stores/storeSections";
import { colors, fontFamily } from "../theme";

const SIDE = 14;
const GAP = 12;

const keyExtractor = (item: QuotedStore) => item.store.id;

function Separator() {
  return <View style={styles.separator} />;
}

export default function StoresList() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ section?: string; category?: string }>();
  const section = isStoreSectionId(params.section) ? params.section : "near-you";
  const category = isStoreCategory(params.category) ? params.category : null;
  const { dropoff } = useDropoff();
  const cartInset = useCartBarInset();

  const { stores: directory } = useStores();
  const stores = useMemo(
    () => storesForSection(directory, dropoff, section, category),
    [directory, dropoff, section, category],
  );
  const cardWidth = width - SIDE * 2;

  const renderItem = useCallback<ListRenderItem<QuotedStore>>(
    ({ item }) => <StoreCard item={item} width={cardWidth} onPress={openStorefront} />,
    [cardWidth],
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={4}
          style={({ pressed }) => [styles.iconButton, pressed && searchStyles.pressed]}
        >
          <Icon name="arrowLeft" size={20} color={colors.text} weight="medium" />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {sectionTitle(section)}
        </Text>
      </View>
      <FlatList
        data={stores}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={<Text style={styles.empty}>No stores here yet.</Text>}
        initialNumToRender={6}
        windowSize={9}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 + cartInset }]}
      />
      <CartBar placement="stack" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: SIDE,
    paddingVertical: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flexShrink: 1,
    fontFamily: fontFamily.bold,
    fontSize: 20,
    color: colors.text,
  },
  content: {
    paddingHorizontal: SIDE,
    paddingTop: 8,
  },
  separator: {
    height: GAP,
  },
  empty: {
    marginTop: 24,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
  },
});
