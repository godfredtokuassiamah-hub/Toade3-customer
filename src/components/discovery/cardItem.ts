import { VENDORS } from "../../data/mock/catalog";
import type { DiscoveryItem, MockItem } from "../../lib/discovery/types";
import type { FoodCardItem } from "../home/FoodCard";

// Discovery item -> card display model (price stays in pesewas).
export function toFoodCardItem(item: DiscoveryItem): FoodCardItem {
  return {
    id: item.item_id,
    name: item.name,
    vendor: item.vendor_name,
    vendorId: item.vendor_id,
    etaMins: item.eta_mins,
    image: item.image,
    priceMinor: item.price_minor,
    status: item.status,
  };
}

const VENDOR_NAMES = new Map(VENDORS.map((v) => [v.vendor_id, v.name]));

// Catalog item -> card model (Favourites grid). `id` is the catalog item_id,
// the same id the Home cards and discovery results heart, so a favourite
// saved anywhere resolves here via getItemsByIds.
export function catalogItemToFoodCardItem(item: MockItem): FoodCardItem {
  return {
    id: item.item_id,
    name: item.name,
    vendor: VENDOR_NAMES.get(item.vendor_id) ?? "",
    vendorId: item.vendor_id,
    etaMins: item.eta_mins,
    image: item.image,
    priceMinor: item.price_minor,
  };
}
