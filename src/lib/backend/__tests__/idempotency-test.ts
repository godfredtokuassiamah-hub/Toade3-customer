/// <reference types="jest" />
import {
  checkoutFingerprint,
  createIdempotencyStore,
  type FingerprintInput,
  IDEMPOTENCY_TTL_MS,
  type KeyStorage,
  outcomeForError,
  uuidV4,
} from "../idempotency";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

function memoryStorage(): KeyStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
    removeItem: async (k) => {
      data.delete(k);
    },
  };
}

function setup() {
  let now = 1_000_000;
  let n = 0;
  const storage = memoryStorage();
  const store = createIdempotencyStore({ storage, now: () => now, uuid: () => `key-${++n}` });
  return { store, storage, advance: (ms: number) => (now += ms) };
}

const INPUT: FingerprintInput = {
  vendorId: "v-campus-grill",
  lines: [
    { itemId: "lm-a", qty: 2, note: "", options: [{ optionId: "b" }, { optionId: "a" }] },
    { itemId: "lm-b", qty: 1, note: "no ice", options: [] },
  ],
  dropoff: { latitude: 5.6037, longitude: -0.187, label: "Home" },
  instructions: "",
  tipMinor: 0,
};

describe("checkout idempotency key", () => {
  it("reuses the key on a retry after a retryable failure", async () => {
    const { store } = setup();
    const fp = checkoutFingerprint(INPUT);
    const first = await store.getOrCreate(fp);
    await store.settle("retryable");
    expect(await store.getOrCreate(fp)).toBe(first);
  });

  it("resets after success", async () => {
    const { store, storage } = setup();
    const fp = checkoutFingerprint(INPUT);
    const first = await store.getOrCreate(fp);
    await store.settle("success");
    expect(storage.data.size).toBe(0);
    expect(await store.getOrCreate(fp)).not.toBe(first);
  });

  it("resets after a definitive (business) failure", async () => {
    const { store } = setup();
    const fp = checkoutFingerprint(INPUT);
    const first = await store.getOrCreate(fp);
    await store.settle("definitive");
    expect(await store.getOrCreate(fp)).not.toBe(first);
  });

  it("issues a new key when the cart changes", async () => {
    const { store } = setup();
    const first = await store.getOrCreate(checkoutFingerprint(INPUT));
    const changed = { ...INPUT, lines: [{ ...INPUT.lines[0], qty: 3 }, INPUT.lines[1]] };
    expect(await store.getOrCreate(checkoutFingerprint(changed))).not.toBe(first);
  });

  it("expires after 24 h", async () => {
    const { store, advance } = setup();
    const fp = checkoutFingerprint(INPUT);
    const first = await store.getOrCreate(fp);
    advance(IDEMPOTENCY_TTL_MS + 1);
    expect(await store.getOrCreate(fp)).not.toBe(first);
  });

  it("survives a storage failure within the session", async () => {
    let n = 0;
    const broken: KeyStorage = {
      getItem: () => Promise.reject(new Error("io")),
      setItem: () => Promise.reject(new Error("io")),
      removeItem: () => Promise.reject(new Error("io")),
    };
    const store = createIdempotencyStore({ storage: broken, now: () => 1, uuid: () => `k${++n}` });
    const fp = checkoutFingerprint(INPUT);
    const first = await store.getOrCreate(fp);
    expect(await store.getOrCreate(fp)).toBe(first);
  });

  it("fingerprint ignores line and option order", () => {
    const reordered = {
      ...INPUT,
      lines: [INPUT.lines[1], { ...INPUT.lines[0], options: [{ optionId: "a" }, { optionId: "b" }] }],
    };
    expect(checkoutFingerprint(reordered)).toBe(checkoutFingerprint(INPUT));
    expect(checkoutFingerprint({ ...INPUT, tipMinor: 100 })).not.toBe(checkoutFingerprint(INPUT));
  });

  it("classifies outcomes", () => {
    expect(outcomeForError("ITEM_UNAVAILABLE")).toBe("definitive");
    expect(outcomeForError("OUT_OF_RADIUS")).toBe("definitive");
    expect(outcomeForError("NETWORK")).toBe("retryable");
    expect(outcomeForError("UNKNOWN")).toBe("retryable");
    expect(outcomeForError("BACKEND_MISSING")).toBe("retryable");
  });

  it("generates RFC 4122 v4 uuids", () => {
    const id = uuidV4();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuidV4()).not.toBe(id);
  });
});
