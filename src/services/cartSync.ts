// Background sync of the local cart with public.cart_drafts (one row per
// customer, RLS own-row only; supabase/migrations/0005), so a signed-in
// user's cart follows them across devices.
//
// The local cart (src/lib/cart/cartStore.ts) is the source of truth for the
// UI and is NEVER blocked: every sync call is fire-and-forget, errors are
// swallowed (logged once in __DEV__ by the fallback runner), and nothing runs
// in mock mode, with the dev login (no Supabase session), or once the table
// is known to be missing (latched for the session).
//
//   SIGNED_IN / INITIAL_SESSION -> pull + mergeCarts (last-write-wins,
//                                  whole cart) -> apply or push
//   local cart change           -> push after 1.5 s of quiet
//   SIGNED_OUT                  -> stop pushing
import { BACKEND_MODE } from "../lib/backend/config";
import { mapBackendError } from "../lib/backend/errors";
import { backend, unwrap } from "../lib/backend/runner";
import { mergeCarts, type RemoteCartState, toRemoteDraft } from "../lib/cart/cartMerge";
import { retryAfterMsFromPayload } from "../lib/security/rateLimitError";
import {
  getCart,
  getCartUpdatedAt,
  loadCart,
  replaceCart,
  subscribeCart,
} from "../lib/cart/cartStore";
import { supabase } from "../lib/supabase";

const PUSH_DEBOUNCE_MS = 1500;
const RESOURCE = "cart";

type DraftRow = { lines: unknown; vendor_id: string | null; updated_at: string };

export async function pullCart(userId: string): Promise<RemoteCartState | null> {
  return backend.run<RemoteCartState | null>({
    resource: RESOURCE,
    op: "read",
    requiresAuth: true,
    remote: async () => {
      const res = await supabase
        .from("cart_drafts")
        .select("lines, vendor_id, updated_at")
        .eq("customer_id", userId)
        .maybeSingle();
      if (res.error) unwrap(res as { data: null; error: unknown; status: number });
      const row = res.data as DraftRow | null;
      if (!row) return null;
      return { lines: row.lines, vendorId: row.vendor_id, updatedAt: Date.parse(row.updated_at) || 0 };
    },
    // No server cart: nothing to merge.
    mock: () => null,
  });
}

export async function pushCart(userId: string): Promise<void> {
  const cart = getCart();
  const updatedAt = getCartUpdatedAt();
  await backend.run<void>({
    resource: RESOURCE,
    op: "write",
    requiresAuth: true,
    remote: async () => {
      const res = await supabase
        .from("cart_drafts")
        .upsert({ customer_id: userId, ...toRemoteDraft(cart, updatedAt) }, { onConflict: "customer_id" });
      if (res.error) unwrap(res as { data: null; error: unknown; status: number });
    },
    mock: () => undefined,
  });
}

let started = false;
let userId: string | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
// updatedAt last known to match the server (skip echo pushes).
let syncedAt = -1;

function quiet(e: unknown) {
  if (__DEV__) console.log("[cartSync] skipped:", e instanceof Error ? e.message : e);
}

async function syncOnSignIn(uid: string) {
  await loadCart();
  const remote = await pullCart(uid);
  const result = mergeCarts({ cart: getCart(), updatedAt: getCartUpdatedAt() }, remote);
  if (result.action === "apply-remote") {
    // Mark as synced first: replaceCart emits, and schedulePush must not
    // echo the server's own cart back.
    syncedAt = result.updatedAt;
    replaceCart(result.cart, result.updatedAt);
  } else if (result.action === "push-local") {
    await pushCart(uid);
    syncedAt = getCartUpdatedAt();
  } else {
    syncedAt = getCartUpdatedAt();
  }
}

// Server rate limit (cart.write, 0009): wait for Retry-After (5-60 s), then
// re-push ONCE. Safe: the push is a whole-state last-write-wins upsert.
const RATE_LIMIT_MIN_WAIT_MS = 5000;
const RATE_LIMIT_MAX_WAIT_MS = 60_000;
let pushNotBefore = 0;

function schedulePush(isRetry = false) {
  if (!userId || backend.isLatched(RESOURCE)) return;
  if (getCartUpdatedAt() === syncedAt) return;
  if (pushTimer) clearTimeout(pushTimer);
  const delay = Math.max(PUSH_DEBOUNCE_MS, pushNotBefore - Date.now());
  pushTimer = setTimeout(() => {
    pushTimer = null;
    const uid = userId;
    if (!uid) return;
    const at = getCartUpdatedAt();
    pushCart(uid)
      .then(() => {
        syncedAt = at;
      })
      .catch((e: unknown) => {
        const err = mapBackendError(e);
        if (err.code === "RATE_LIMITED") {
          const wait = retryAfterMsFromPayload(err) ?? RATE_LIMIT_MIN_WAIT_MS;
          pushNotBefore =
            Date.now() + Math.min(RATE_LIMIT_MAX_WAIT_MS, Math.max(RATE_LIMIT_MIN_WAIT_MS, wait));
          if (!isRetry) {
            schedulePush(true);
            return;
          }
        }
        quiet(e);
      });
  }, delay);
}

// Starts the sync once per app run; returns a stop function.
export function startCartSync(): () => void {
  if (BACKEND_MODE === "mock" || started) return () => {};
  started = true;
  const unsubscribeCart = subscribeCart(() => schedulePush());
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    // Supabase calls must not run inside this callback (they can deadlock
    // the auth lock): defer them.
    if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
      const uid = session.user.id;
      if (uid === userId) return;
      userId = uid;
      setTimeout(() => {
        syncOnSignIn(uid).catch(quiet);
      }, 0);
    } else if (event === "SIGNED_OUT") {
      userId = null;
      syncedAt = -1;
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = null;
    }
  });
  return () => {
    started = false;
    unsubscribeCart();
    data.subscription.unsubscribe();
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = null;
    userId = null;
  };
}
