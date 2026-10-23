import { cartCount, useCart } from "../../lib/cart/cartStore";

export const CART_BAR_HEIGHT = 56;
// Gap between the cart bar and whatever sits under it (tab bar / inset).
export const CART_BAR_GAP = 10;
// Extra bottom padding a screen needs while the bar shows.
export const CART_BAR_INSET = CART_BAR_HEIGHT + CART_BAR_GAP;

// Bottom padding to add for the floating cart bar (0 when the cart is empty).
export function useCartBarInset(): number {
  const { cart } = useCart();
  return cartCount(cart) > 0 ? CART_BAR_INSET : 0;
}
