// Rows of the filtered Home: server item rails (bounded), the matching
// vendor rail, and one classified empty / loading state. Plain Views; no
// layout animations (rows mount/unmount under FlatList virtualization).
import { memo, useCallback, useMemo } from "react";
import { FlatList, type ListRenderItem, StyleSheet, View } from "react-native";

import type { DiscoveryModule, DiscoveryVendor } from "../../lib/discovery/types";
import { toFoodCardItem } from "../discovery/cardItem";
import { SearchLoading } from "../search/SearchStateView";
import { StoreCard } from "../search/StoreCard";
import { FoodRow } from "./FoodRow";
import { SectionHeader } from "./SectionHeader";

const vendorKey = (v: DiscoveryVendor) => v.vendor_id;

function VendorGap() {
  return <View style={styles.vendorGap} />;
}

// TODO(store): open the storefront once it exists.
const openStore = () => {};

export const FilteredModule = memo(function FilteredModule({
  module,
  onViewAll,
}: {
  module: DiscoveryModule;
  onViewAll: (categoryId: string) => void;
}) {
  const items = useMemo(
    () => (module.type === "items" ? module.items.map(toFoodCardItem) : []),
    [module],
  );
  const renderVendor = useCallback<ListRenderItem<DiscoveryVendor>>(
    ({ item }) => <StoreCard store={item} onPress={openStore} />,
    [],
  );
  if (module.type === "items") {
    return (
      <View>
        <SectionHeader title={module.title} onViewAll={() => onViewAll(module.category_id)} />
        <FoodRow items={items} />
      </View>
    );
  }
  return (
    <View>
      <SectionHeader title={module.title} />
      <FlatList
        data={module.vendors}
        keyExtractor={vendorKey}
        renderItem={renderVendor}
        horizontal
        showsHorizontalScrollIndicator={false}
        ItemSeparatorComponent={VendorGap}
        contentContainerStyle={styles.vendors}
      />
    </View>
  );
});

export function FilteredLoading() {
  return <SearchLoading />;
}

const styles = StyleSheet.create({
  vendors: {
    paddingHorizontal: 14,
  },
  vendorGap: {
    width: 10,
  },
});
