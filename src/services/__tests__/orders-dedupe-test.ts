/// <reference types="jest" />
import AsyncStorage from "@react-native-async-storage/async-storage";

import { IDEMPOTENCY_STORAGE_KEY } from "../../lib/backend/idempotency";
import type { CartLine } from "../../lib/cart/cartStore";
import { supabase } from "../../lib/supabase";
import { cancelOrder, placeOrder, type PlaceOrderInput } from "../orders";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../../lib/supabase", () => ({
  supabase: {
    rpc: jest.fn(),
    auth: {
      getSession: jest.fn(() =>
        Promise.resolve({ data: { session: { user: { id: "user-1" } } }, error: null }),
      ),
    },
  },
}));

const rpc = supabase.rpc as unknown as jest.Mock;

const INPUT: PlaceOrderInput = {
  vendorId: "v-campus-grill",
  lines: [
    {
      itemId: "i-1",
      vendorId: "v-campus-grill",
      vendorName: "Campus Grill",
      name: "Jollof",
      unitPriceMinor: 2500,
      qty: 1,
      note: "",
      options: [],
    } as unknown as CartLine,
  ],
  dropoff: { latitude: 5.65, longitude: -0.186, label: "Hall 1" },
  instructions: "",
  tipMinor: 0,
};

const PLACED = {
  order_id: "o-1",
  order_number: 1001,
  status: "pending",
  version: 1,
  items_total_minor: 2500,
  delivery_fee_minor: 500,
  service_fee_minor: 300,
  tip_minor: 0,
  total_minor: 3300,
  distance_km: 0.8,
  replayed: false,
};

beforeEach(async () => {
  rpc.mockReset();
  await AsyncStorage.clear();
});

describe("placeOrder de-dupe", () => {
  test("two concurrent calls for the same checkout -> ONE place_order RPC", async () => {
    let release!: () => void;
    rpc.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ data: PLACED, error: null, status: 200 });
        }),
    );
    const a = placeOrder(INPUT);
    const b = placeOrder(INPUT);
    // Let both reach the RPC (or the shared promise).
    for (let i = 0; i < 20 && !release; i++) await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    release();
    const [ra, rb] = await Promise.all([a, b]);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(ra.orderId).toBe("o-1");
    expect(rb.orderId).toBe("o-1");
  });

  test("RATE_LIMITED keeps the idempotency key; the user's retry reuses it", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "T3429", message: "RATE_LIMITED", details: '{"action":"order.place","retry_after":20}' },
      status: 429,
    });
    await expect(placeOrder(INPUT)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem(IDEMPOTENCY_STORAGE_KEY)).not.toBeNull();
    const firstKey = (rpc.mock.calls[0][1] as { p_idempotency_key: string }).p_idempotency_key;

    rpc.mockResolvedValueOnce({ data: { ...PLACED, replayed: false }, error: null, status: 200 });
    await placeOrder(INPUT);
    const secondKey = (rpc.mock.calls[1][1] as { p_idempotency_key: string }).p_idempotency_key;
    expect(secondKey).toBe(firstKey);
    // Success clears the key.
    expect(await AsyncStorage.getItem(IDEMPOTENCY_STORAGE_KEY)).toBeNull();
  });
});

describe("cancelOrder de-dupe", () => {
  test("identical concurrent cancels -> one cancel_order RPC, never retried", async () => {
    rpc.mockResolvedValue({ data: { order_id: "o-1", status: "cancelled", version: 2 }, error: null, status: 200 });
    const [a, b] = await Promise.all([cancelOrder("o-1", 1), cancelOrder("o-1", 1)]);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  test("a failure is not retried automatically", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "", message: "Service Unavailable" }, status: 503 });
    await expect(cancelOrder("o-1", 1)).rejects.toBeDefined();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
