import type { DiscoveryItem } from "../../lib/discovery/types";
import type { FoodCardItem } from "../home/FoodCard";

// Discovery item -> card display model (price stays in pesewas).
export function toFoodCardItem(item: DiscoveryItem): FoodCardItem {
  return {
    id: item.item_id,
    name: item.name,
    vendor: item.vendor_name,
    etaMins: item.eta_mins,
    image: item.image,
    priceMinor: item.price_minor,
    status: item.status,
  };
}
