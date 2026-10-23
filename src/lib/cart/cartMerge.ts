// Local vs server cart merge for the background sync. Pure (unit-tested).
//
// Last-write-wins on updatedAt, WHOLE cart: lines from two carts are never
// mixed, so a vendor mismatch simply takes the newer cart (one vendor per
// order). Ties keep the local cart. A cleared cart is a real change (e.g.
// an order placed on another device), so a newer empty cart wins too.
import { type Cart, cartVendorId, EMPTY_CART, parseCart } from "./cartStore";

export type LocalCartState = { cart: Cart; updatedAt: number };
export type RemoteCartState = { lines: unknown; vendorId: string | null; updatedAt: number };

export type MergeAction =
  // Nothing to do (same content, or both empty).
  | "none"
  // Local is newer / remote missing: upload local.
  | "push-local"
  // Remote is newer: replace local.
  | "apply-remote";

export type MergeResult = { action: MergeAction; cart: Cart; updatedAt: number };

// Defensive parse of the server lines (same rules as the local store).
export function parseRemoteLines(lines: unknown): Cart {
  if (!Array.isArray(lines)) return EMPTY_CART;
  return parseCart(JSON.stringify({ lines }));
}

function sameContent(a: Cart, b: Cart): boolean {
  return JSON.stringify(a.lines) === JSON.stringify(b.lines);
}

export function mergeCarts(local: LocalCartState, remote: RemoteCartState | null): MergeResult {
  if (!remote) {
    return local.cart.lines.length > 0
      ? { action: "push-local", cart: local.cart, updatedAt: local.updatedAt }
      : { action: "none", cart: local.cart, updatedAt: local.updatedAt };
  }
  const remoteCart = parseRemoteLines(remote.lines);
  if (sameContent(local.cart, remoteCart)) {
    return { action: "none", cart: local.cart, updatedAt: Math.max(local.updatedAt, remote.updatedAt) };
  }
  if (remote.updatedAt > local.updatedAt) {
    return { action: "apply-remote", cart: remoteCart, updatedAt: remote.updatedAt };
  }
  return { action: "push-local", cart: local.cart, updatedAt: local.updatedAt };
}

// Row shape written to public.cart_drafts.
export function toRemoteDraft(cart: Cart, updatedAt: number) {
  return {
    vendor_id: cartVendorId(cart),
    lines: cart.lines,
    updated_at: new Date(updatedAt > 0 ? updatedAt : Date.now()).toISOString(),
  };
}
