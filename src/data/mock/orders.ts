// TODO(orders): placeholder order history until the real orders backend (S5)
// exists. Used only by the Orders tab to render dummy cards. Prices are in
// integer pesewas (GHS minor units), like the catalog.
import type { ImageSourcePropType } from "react-native";

import { foodImages } from "./foodImages";

export type OrderStatus = "delivered" | "cancelled" | "active";

export type MockOrder = {
  id: string;
  vendorName: string;
  logo?: ImageSourcePropType;
  totalMinor: number;
  /** ISO timestamp of when the order was placed. */
  placedAt: string;
  status: OrderStatus;
  /** Shown for an active order instead of a plain status word. */
  activeLabel?: string;
};

// Reuse the real food photos already shipped for the Home feed, so the
// cards look consistent with the rest of the app.
export const MOCK_ORDERS: MockOrder[] = [
  {
    id: "TD-0042",
    vendorName: "Campus Grill",
    logo: foodImages["lm-grilled-chicken-wedges"],
    totalMinor: 9045,
    placedAt: "2026-10-10T15:15:00Z",
    status: "delivered",
  },
  {
    id: "TD-0041",
    vendorName: "Auntie Ama's Waakye",
    logo: foodImages["lm-jollof-chicken"],
    totalMinor: 5365,
    placedAt: "2026-10-10T14:25:00Z",
    status: "cancelled",
  },
  {
    id: "TD-0038",
    vendorName: "Sweet Sip Bar",
    logo: foodImages["dr-matcha-bubble-tea"],
    totalMinor: 6389,
    placedAt: "2026-09-10T10:58:00Z",
    status: "delivered",
  },
];
