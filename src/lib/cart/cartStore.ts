// Device-local cart: pure helpers (unit-tested) plus a module-level
// external store (useSyncExternalStore), so useCart() works on every screen,
// including root-stack routes, without a provider. Persisted in AsyncStorage.
//
// One vendor per cart: adding a line from another vendor requires
// replacing the cart (the caller confirms with the user first).
//
// TODO(cart): the server checkout quote (server-priced subtotal, delivery
// fee) once it exists; checkout totals are display estimates until then.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

export const CART_KEY = "toade3.cart";
export const MAX_LINE_QTY = 20;

export type CartOption = { optionId: string; label: string; priceMinor: number };

export type CartLine = {
  lineId: string;
  itemId: string;
  vendorId: string;
  vendorName: string;
  name: string;
  // Base item price per unit, pesewas (options are priced separately).
  unitPriceMinor: number;
  options: CartOption[];
  note: string;
  qty: number;
};

export type Cart = { lines: CartLine[] };

export const EMPTY_CART: Cart = { lines: [] };

// ---- Pure helpers ----

export function cartVendorId(cart: Cart): string | null {
  return cart.lines[0]?.vendorId ?? null;
}

// True when adding from `vendorId` would mix vendors.
export function needsNewCart(cart: Cart, vendorId: string): boolean {
  const current = cartVendorId(cart);
  return current != null && current !== vendorId;
}

// Same item, same options and same note merge into one line.
export function sameLine(a: CartLine, b: CartLine): boolean {
  if (a.itemId !== b.itemId || a.note.trim() !== b.note.trim()) return false;
  const ka = a.options.map((o) => o.optionId).sort().join("|");
  const kb = b.options.map((o) => o.optionId).sort().join("|");
  return ka === kb;
}

// Adds a line. replace = true clears the cart first (new vendor).
// Throws if mixing vendors without replace (callers check needsNewCart).
export function addLine(cart: Cart, line: CartLine, replace: boolean): Cart {
  const base = replace ? EMPTY_CART : cart;
  if (needsNewCart(base, line.vendorId)) {
    throw new Error("Cart holds another vendor's items");
  }
  const existing = base.lines.find((l) => sameLine(l, line));
  if (existing) {
    return {
      lines: base.lines.map((l) =>
        l === existing ? { ...l, qty: Math.min(MAX_LINE_QTY, l.qty + line.qty) } : l,
      ),
    };
  }
  return { lines: [...base.lines, { ...line, qty: Math.min(MAX_LINE_QTY, line.qty) }] };
}

// Sets a line's quantity (capped); 0 or less removes the line.
export function setLineQty(cart: Cart, lineId: string, qty: number): Cart {
  if (qty <= 0) return { lines: cart.lines.filter((l) => l.lineId !== lineId) };
  const next = Math.min(MAX_LINE_QTY, Math.floor(qty));
  return { lines: cart.lines.map((l) => (l.lineId === lineId ? { ...l, qty: next } : l)) };
}

export function lineTotal(line: CartLine): number {
  const options = line.options.reduce((s, o) => s + o.priceMinor, 0);
  return (line.unitPriceMinor + options) * line.qty;
}

export function cartSubtotalMinor(cart: Cart): number {
  return cart.lines.reduce((s, l) => s + lineTotal(l), 0);
}

export function cartCount(cart: Cart): number {
  return cart.lines.reduce((s, l) => s + l.qty, 0);
}

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v);
}

function parseOption(v: unknown): CartOption | null {
  if (typeof v !== "object" || v == null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.optionId !== "string" || typeof o.label !== "string" || !isInt(o.priceMinor)) {
    return null;
  }
  return { optionId: o.optionId, label: o.label, priceMinor: o.priceMinor };
}

function parseLine(v: unknown): CartLine | null {
  if (typeof v !== "object" || v == null) return null;
  const l = v as Record<string, unknown>;
  if (
    typeof l.lineId !== "string" ||
    typeof l.itemId !== "string" ||
    typeof l.vendorId !== "string" ||
    typeof l.vendorName !== "string" ||
    typeof l.name !== "string" ||
    !isInt(l.unitPriceMinor) ||
    !isInt(l.qty) ||
    l.qty < 1 ||
    !Array.isArray(l.options)
  ) {
    return null;
  }
  const options: CartOption[] = [];
  for (const o of l.options) {
    const parsed = parseOption(o);
    if (!parsed) return null;
    options.push(parsed);
  }
  return {
    lineId: l.lineId,
    itemId: l.itemId,
    vendorId: l.vendorId,
    vendorName: l.vendorName,
    name: l.name,
    unitPriceMinor: l.unitPriceMinor,
    options,
    note: typeof l.note === "string" ? l.note : "",
    qty: Math.min(MAX_LINE_QTY, l.qty),
  };
}

// Defensive parse: drops malformed lines and any line from a second vendor.
export function parseCart(raw: string | null): Cart {
  if (!raw) return EMPTY_CART;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value == null) return EMPTY_CART;
    const lines = (value as { lines?: unknown }).lines;
    if (!Array.isArray(lines)) return EMPTY_CART;
    const out: CartLine[] = [];
    for (const v of lines) {
      const line = parseLine(v);
      if (line && (out.length === 0 || out[0].vendorId === line.vendorId)) out.push(line);
    }
    return { lines: out };
  } catch {
    return EMPTY_CART;
  }
}

export function newLineId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Last-change time (ms) stored next to the lines, for the server cart sync
// (src/services/cartSync.ts, last-write-wins). 0 when unknown / legacy.
export function parseCartUpdatedAt(raw: string | null): number {
  if (!raw) return 0;
  try {
    const value = JSON.parse(raw) as { updatedAt?: unknown };
    return typeof value?.updatedAt === "number" && Number.isFinite(value.updatedAt)
      ? value.updatedAt
      : 0;
  } catch {
    return 0;
  }
}

// ---- Module-level store ----

let state: Cart = EMPTY_CART;
let updatedAt = 0;
let loadPromise: Promise<void> | null = null;
// Set once the user changes the cart, so a late load never overwrites it.
let dirty = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function startLoad(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = AsyncStorage.getItem(CART_KEY)
    .then((raw) => {
      if (dirty) return;
      state = parseCart(raw);
      updatedAt = parseCartUpdatedAt(raw);
      emit();
    })
    .catch(() => {
      // Storage unavailable: start empty for this session.
    });
  return loadPromise;
}

function persist(cart: Cart) {
  const write =
    cart.lines.length === 0
      ? AsyncStorage.removeItem(CART_KEY)
      : AsyncStorage.setItem(CART_KEY, JSON.stringify({ ...cart, updatedAt }));
  write.catch(() => {
    // Storage failure: the cart still applies for this session.
  });
}

function subscribe(listener: () => void): () => void {
  startLoad();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// A user change: new state, new timestamp.
function commitLocal(next: Cart) {
  state = next;
  updatedAt = Date.now();
  dirty = true;
  persist(state);
  emit();
}

export function getCart(): Cart {
  return state;
}

export function getCartUpdatedAt(): number {
  return updatedAt;
}

// Resolves once the persisted cart has been read (or failed to).
export function loadCart(): Promise<void> {
  return startLoad();
}

// Non-React subscription (cart sync). Also starts the load.
export function subscribeCart(listener: () => void): () => void {
  return subscribe(listener);
}

// Applies a cart from the server sync when it is newer than the local one.
// Returns false (no change) otherwise. Keeps the remote timestamp so the
// sync doesn't echo it back.
export function replaceCart(next: Cart, nextUpdatedAt: number): boolean {
  if (nextUpdatedAt <= updatedAt) return false;
  state = next;
  updatedAt = nextUpdatedAt;
  dirty = true;
  persist(state);
  emit();
  return true;
}

export function addToCart(line: CartLine, replace: boolean): void {
  commitLocal(addLine(state, line, replace));
}

export function updateLineQty(lineId: string, qty: number): void {
  commitLocal(setLineQty(state, lineId, qty));
}

export function clearCart(): void {
  commitLocal(EMPTY_CART);
}

export function useCart() {
  const cart = useSyncExternalStore(subscribe, getCart, getCart);
  return { cart, addToCart, clearCart, needsNewCart: (vendorId: string) => needsNewCart(cart, vendorId) };
}
