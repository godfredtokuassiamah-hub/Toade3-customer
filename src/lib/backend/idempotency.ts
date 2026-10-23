// Checkout idempotency key: generated once per checkout attempt and kept
// (AsyncStorage) until the attempt succeeds or fails definitively, so a
// retry after a timeout / app kill reuses it and place_order returns the
// original order instead of creating a second one.
//
//   same fingerprint, < 24 h old  -> reuse the stored key
//   fingerprint changed (cart, drop-off, tip, instructions) -> new key
//   success / business error      -> key cleared
//   NETWORK / UNKNOWN / 5xx       -> key kept (the order may exist)
//
// Pure core with injectable storage / clock / uuid (unit-tested).
import AsyncStorage from "@react-native-async-storage/async-storage";

import { type BackendErrorCode, isBusinessError } from "./errors";

export const IDEMPOTENCY_STORAGE_KEY = "toade3.checkout.idempotency";
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export type KeyStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type StoredCheckoutKey = { key: string; fingerprint: string; createdAt: number };

export type SettleOutcome = "success" | "definitive" | "retryable";

export type FingerprintInput = {
  vendorId: string;
  lines: readonly { itemId: string; qty: number; note: string; options: readonly { optionId: string }[] }[];
  dropoff: { latitude: number; longitude: number; label: string };
  instructions: string;
  tipMinor: number;
};

// Stable text for "the same checkout attempt". Line order doesn't matter.
export function checkoutFingerprint(input: FingerprintInput): string {
  const lines = input.lines
    .map((l) => `${l.itemId}*${l.qty}[${l.options.map((o) => o.optionId).sort().join(",")}]${l.note.trim()}`)
    .sort();
  return JSON.stringify([
    input.vendorId,
    lines,
    input.dropoff.latitude.toFixed(5),
    input.dropoff.longitude.toFixed(5),
    input.dropoff.label.trim(),
    input.instructions.trim(),
    input.tipMinor,
  ]);
}

export function outcomeForError(code: BackendErrorCode): SettleOutcome {
  return isBusinessError(code) ? "definitive" : "retryable";
}

// RFC 4122 v4. crypto.getRandomValues when present (Hermes may lack it);
// otherwise Math.random. Keys only need to be unique per customer (the DB
// constraint is unique (customer_id, idempotency_key)).
export function uuidV4(): string {
  const bytes = new Uint8Array(16);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function parseStored(raw: string | null): StoredCheckoutKey | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredCheckoutKey>;
    if (typeof v.key !== "string" || typeof v.fingerprint !== "string" || typeof v.createdAt !== "number") {
      return null;
    }
    return { key: v.key, fingerprint: v.fingerprint, createdAt: v.createdAt };
  } catch {
    return null;
  }
}

export type IdempotencyStore = {
  getOrCreate(fingerprint: string): Promise<string>;
  settle(outcome: SettleOutcome): Promise<void>;
};

export function createIdempotencyStore(deps: {
  storage: KeyStorage;
  now: () => number;
  uuid: () => string;
}): IdempotencyStore {
  // In-memory copy, so retries in this session reuse the key even when
  // storage fails.
  let memory: StoredCheckoutKey | null = null;
  return {
    async getOrCreate(fingerprint) {
      let stored: StoredCheckoutKey | null = null;
      try {
        stored = parseStored(await deps.storage.getItem(IDEMPOTENCY_STORAGE_KEY));
      } catch {
        stored = null;
      }
      stored = stored ?? memory;
      if (
        stored &&
        stored.fingerprint === fingerprint &&
        deps.now() - stored.createdAt < IDEMPOTENCY_TTL_MS
      ) {
        return stored.key;
      }
      const next: StoredCheckoutKey = { key: deps.uuid(), fingerprint, createdAt: deps.now() };
      memory = next;
      try {
        await deps.storage.setItem(IDEMPOTENCY_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage failure: the key still covers retries in this session.
      }
      return next.key;
    },
    async settle(outcome) {
      if (outcome === "retryable") return;
      memory = null;
      try {
        await deps.storage.removeItem(IDEMPOTENCY_STORAGE_KEY);
      } catch {
        // Nothing to recover; a stale key expires after 24 h.
      }
    },
  };
}

export const checkoutKeys = createIdempotencyStore({
  storage: AsyncStorage,
  now: () => Date.now(),
  uuid: uuidV4,
});
