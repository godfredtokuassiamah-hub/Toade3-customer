# Toade3 notification engine: technical design

Status: Phase A draft for design review. Pairs with `Docs/notifications-requirements.md` (FR/NFR/AC references) and ADR-0001..0003. Sources: `Docs/Toade3_Notification_Architecture.md` (§n), the brief, and `.agents/tasks/notifications/workflow-brief.md` (decisions 1-6). Stack is locked by this design once approved.

## 0. Technology stack (locked)

- Client: Expo SDK 57, React Native 0.86.3 (new arch), expo-router ~57 (typed routes, reactCompiler), TypeScript strict, Reanimated 4.5.1 + worklets, `@supabase/supabase-js` ^2.118.0, Manrope via `@expo-google-fonts/manrope` + `expo-font` (already installed, confirmed Expo-Go-safe).
- New client deps, installed later with `npx expo install`: `react-native-svg` (Included in Expo Go, SDK 57 doc confirmed) for the capsule path; `expo-notifications`, `expo-device`, `expo-constants` for push (`expo-device`/`expo-constants` already in `package.json`). `expo-notifications` remote push is unavailable in Expo Go (ADR-0002) so it is loaded lazily behind a dynamic import.
- Backend: Supabase Postgres, `pgmq` via Supabase Queues as the durable transport (ADR-0001), private `messaging` schema, Edge Functions (Deno/TS) for workers and the Customer API, `pg_cron` + `pg_net` to drive the workers, Supabase Realtime private channels for foreground hints.
- Push provider: Expo Push Service (tickets + receipts), reached from the dispatch Edge Function.

## 1. Module layout

### 1.1 Client — `src/shared/notifications/`

```text
src/shared/notifications/
  core/                         # PURE: no react, no react-native, no expo, no supabase
    registry.ts                 # the 52 activities as data (FR-1)
    registry.data.ts            # the table rows
    types.ts                    # Priority, Surface, Audience, Kind, Intent, NotificationRecord, Hint, Snapshot
    priority.ts                 # ordering, banner durations (FR-15)
    coordinator.ts              # pure reducer: queue <=3, one banner, coalesce, suppress, expiry (FR-6..18)
    versioning.ts               # per-resource version compare + gap detection (FR-8,9,10)
    dedupe.ts                   # dedup_key builder + seen-id set (FR-18, FR-49)
    routing.ts                  # intent -> route allowlist + tap validation state machine (FR-3, FR-45)
    copy.ts                     # title/body/CTA resolution; placeholder whitelist (FR-2)
    phases.ts                   # 6 phases -> progress 0..1, ETA freshness, exception rules (FR-19..23)
    clock.ts                    # Clock interface (injected; tests use a fake)
  react/                        # React + RN glue (uses core)
    NotificationProvider.tsx    # listeners once, lifecycle, reconcile (FR-40,42,46)
    usePresentation.ts          # subscribes to the coordinator store
    PresentationHost.tsx        # renders one banner/capsule in a modal-safe host (FR-38,39)
    OrderStatusCapsule.tsx      # the pop-up shell for every event (FR-25..30)
    CapsuleProgressPath.tsx     # react-native-svg path, geometry from layout (FR-27)
    ActionRequiredBanner.tsx    # P0 exception variant (FR-31)
    InlineFeedback.tsx          # P2 local feedback (FR-32)
    NotificationInbox.tsx       # list + paging (FR-33)
    NotificationPreferences.tsx # groups + consent + quiet hours (FR-36)
    OrderSelector.tsx           # multi-order selector (FR-30)
  adapters/
    orderStateSource.ts         # OrderStateSource interface (FR-57)
    syntheticOrderSource.ts     # DEV-ONLY synthetic producer + emits
    unavailableOrderSource.ts   # production default until S5 exists
    realtimeManager.ts          # one private channel, authorize, reconnect (FR-41)
    pushAdapter.ts              # lazy expo-notifications; degrades in Expo Go (FR-43,44)
    liveActivityAdapter.ts      # stub (Out of scope; interface only)
    devPanel.tsx                # __DEV__ synthetic-event panel (FR-57)
  api/
    messagingApi.ts             # typed client for the Customer API routes (ADR-0003)
  index.ts
```

`core/` imports nothing platform-specific, so jest (roots `src/`) runs it directly and the Deno Edge Functions import the same files. See 1.3 for how the server reuses it.

### 1.2 Routes (expo-router, `src/app/`)

- `src/app/notifications.tsx` — inbox screen, `presentation: "card"`.
- `src/app/notification-preferences.tsx` — preferences screen.
- `src/app/(tabs)/orders.tsx` — replace the placeholder: active-order list + inbox entry (FR-34).
- `src/app/(tabs)/account.tsx` — add a "Notifications" row to the (placeholder) account screen opening preferences (FR-35).
- The `PresentationHost` mounts in `src/app/_layout.tsx` inside the providers, above the `Stack`, so it is present on every screen including the transparentModal routes.

Non-route code stays out of `src/app/` per AGENTS.md; all logic is under `src/shared/notifications/`.

### 1.3 Server — `supabase/`

```text
supabase/
  migrations/
    0004_messaging.sql          # schema, tables, indexes, grants, RLS, client RPCs/views, queue, outbox, cron
    0005_messaging_seed.sql     # policy_versions + templates seed (hash must equal code hash, FR-5)
  functions/
    _shared/                    # symlink-free COPY of core logic the workers need (see below)
      policyDecision.ts         # re-exports from a generated bundle of src/shared/notifications/core
      pushPayload.ts
    msg-consume/index.ts        # pull from queue, build notifications+recipients+jobs+hint (FR-47,48)
    msg-dispatch/index.ts       # recheck + Expo Push send, store tickets (FR-50,51)
    msg-receipts/index.ts       # fetch receipts, DeviceNotRegistered cleanup (FR-51)
    msg-escalate/index.ts       # reminder stages, recheck owner task (FR-53)
    msg-cleanup/index.ts        # expire, retention, dead-letter sweep (FR-52)
    msg-health/index.ts         # independent health snapshot (FR-54)
    customer-api/index.ts       # devices, notifications, read, preferences, realtime-authorizations (ADR-0003)
  tests/
    *.pgTAP.sql                 # RLS/grant tests, written, not executed (NFR-6)
```

Sharing the pure logic safely (decision 2). The worker decision logic (policy evaluation, dedup keys, backoff/jitter, expiry, per-resource version compare, push payload) lives once in `src/shared/notifications/core`. jest tests it. For Deno, we do **not** symlink across the `supabase/functions` import boundary (the deploy bundler only sees files under `functions/`). Instead a tiny build step (`scripts/sync-core.ts`, run by hand, documented in the runbook) copies the `core/*.ts` files into `supabase/functions/_shared/core/` and a jest test asserts the copy is byte-identical to the source (fails CI if someone edits only one copy). This keeps a single source of truth, keeps jest and Deno both able to import pure TS, and avoids an npm-publish step for a private monorepo-less repo. The alternative (publish `core` as a package) is rejected: heavier, and the repo has no package registry wired. The alternative (Deno `npm:`/HTTP import of `src`) is rejected: Edge deploy bundles only `functions/`.

## 2. Policy registry schema

`core/types.ts`:

```ts
type Audience = "customer" | "vendor" | "rider" | "admin";
type Priority = "P0" | "P1" | "P2" | "P3";
type Origin = "server" | "local";
type PushMode = "none" | "background" | "conditional" | "oncall" | "independent" | "optin";
type Surface =
  | "capsule" | "capsule_quiet" | "action_capsule" | "exception_capsule"
  | "banner" | "exception_banner" | "completion_banner"
  | "task_card" | "board_update" | "dashboard"
  | "inline_card" | "inline" | "confirmation_sheet" | "snackbar"
  | "badge" | "inbox_only" | "connectivity_strip";
type Coalesce = "order" | "case" | "resource" | "none";
type Dedupe = "resource_version" | "once" | "none";
type Wiring = "W" | "WP" | "G" | "E" | "P" | "C";

interface PolicyEntry {
  id: string;                 // "C04"
  kind: string;               // "customer.order.ready"
  audience: Audience;
  priority: Priority;
  surface: Surface;
  origin: Origin;
  push: PushMode;
  inbox: boolean;
  title: string;
  body: string;
  cta: string | null;
  intent: string | null;      // routing allowlist key
  category: PreferenceCategory;
  gate: Capability;           // "core" | feature flag
  coalesce: Coalesce;
  dedupe: Dedupe;
  wiring: Wiring;
  resourceType: "order" | "delivery" | "support_case" | "account" | "campaign" | "item" | null;
}
```

`registry.data.ts` holds the 52 rows (section 4 of the requirements). `registry.ts` builds `Map<kind, PolicyEntry>` and `Map<id, PolicyEntry>`, validates 52 unique IDs/kinds and exports `REGISTRY_HASH` (stable JSON + FNV-1a). Capability flags default to a `CAPABILITIES` record (all gated features `false`, `core` not listed). On the server the active `policy_versions.registry_hash` must equal `REGISTRY_HASH` or `msg-consume` refuses the event (FR-5).

## 3. Presentation coordinator algorithm

`core/coordinator.ts` is a pure reducer: `(State, Action, Clock) -> State` plus selectors. The React store (`usePresentation`) is a thin `useSyncExternalStore` wrapper, mirroring the existing `discoveryStore` pattern.

State:

```ts
interface CoordinatorState {
  sessionGen: number;                       // bumped on account switch/sign-out (FR-17)
  visible: Notice | null;                   // the one transient banner (FR-6)
  pending: Notice[];                        // <= 3 (FR-6)
  capsules: Record<string, CapsuleModel>;   // by orderId, persistent (FR-30)
  persistentTasks: Record<string, TaskCard>;// P0 cards surviving dismissal (FR-16,31)
  appliedVersion: Record<string, number>;   // key `${resourceType}:${resourceId}` (FR-8,9)
  seen: Set<string>;                        // notification_id dedupe (FR-18)
  ownCommands: Array<{correlationId: string; at: number}>; // 60s window (FR-13)
  focusedResource: { type: string; id: string } | null;    // current screen (FR-12)
}
```

Actions: `HINT`, `SNAPSHOT_APPLIED`, `SHOW`, `DISMISS`, `EXPIRE_TICK`, `FOCUS`, `OWN_COMMAND`, `SESSION_RESET`.

`ingest(notice)` algorithm:

1. If `notice.sessionGen !== state.sessionGen` → drop (FR-17).
2. If `notice.notification_id ∈ seen` → drop (push+Realtime dedupe, FR-18). Add to `seen`.
3. If `notice.expires_at <= clock.now()` → drop (FR-11).
4. Version/obsolescence (FR-8,9): `key = resourceType:resourceId`. If `notice.resourceVersion <= appliedVersion[key]` → drop. If the notice's phase ordinal < current capsule phase ordinal (e.g. `ready` after `on_the_way`) → update inbox only, no banner.
5. Gap (FR-10): if `notice.resourceVersion > appliedVersion[key] + 1` (and a resource exists), mark `needsSnapshot`; presentation waits for `SNAPSHOT_APPLIED`.
6. Capsule update (always for order kinds): upsert `capsules[orderId]` from the authorized snapshot (never from push copy). Set `appliedVersion[key]`.
7. Own-command (FR-13): if `notice.correlationId` matches an entry within 60 s and priority ∈ {P1,P2} → no banner (capsule already updated).
8. Focus (FR-12): if `focusedResource` equals the notice's resource, or that order's capsule is on Home → no banner.
9. Coalesce (FR-7): if `visible`/`pending` holds a notice with the same `coalesce` scope (e.g. same order) → replace it in place, keep `max(priority)`.
10. Slotting (FR-6,14): P0 → if `visible` is lower priority, displace it to the front of `pending` (if still valid) and show the P0. Else if no `visible` → show. Else if `pending.length < 3` → enqueue by priority. Else if the new notice outranks the lowest pending → replace it; otherwise drop the transient (inbox unaffected). P3 is slotted only when nothing P0/P1 is visible/pending/unresolved.
11. P0 also writes `persistentTasks[id]` so dismissal (FR-16) leaves the Orders-tab card.

`DISMISS` clears `visible`, promotes the next pending; never touches `persistentTasks` or `capsules`. `EXPIRE_TICK` (driven by a single timer in the provider) drops expired `pending` and auto-dismisses `visible` after its duration (FR-15; doubled, min 10 s, when a screen reader is active — the provider passes `screenReaderOn`). `SESSION_RESET` returns the initial state with `sessionGen+1`.

Push + Realtime dedupe is purely by `notification_id` (step 2), so whichever transport arrives first wins and the second is a no-op (FR-18). Both still cause a snapshot fetch only if a version gap exists.

## 4. Routing allowlist and tap validation

`core/routing.ts` holds `CUSTOMER_INTENTS: Record<string, (params) => Route | null>`. Only these customer intents resolve: `order.details`→`/orders/[id]` (pending real route; today `/orders`), `order.track`→`/orders`, `cart.review`/`cart.view`→`/` (cart not built; safe fallback with notice), `payment.view`/`refund.view`→`/orders` (gated), `order.rate`→`/orders` (gated), `support.view`→`/notifications` (support UI not built), `account.view`→`/account`, `settings.notifications`→`/notification-preferences`, `offer.view`/`item.view`→`/` (gated). Vendor/rider/admin intents return `null` from the customer resolver (FR-3) → safe fallback.

Tap validation state machine (`validateTap`, used for warm and cold start, FR-45):

```text
parse payload.data -> { schema_version, notification_id, app_kind }
if schema_version unsupported or app_kind != "customer" -> fallback /orders
if not signed in -> store ONE bounded intent {notification_id, expiresAt: now+10min}; route to sign-in; resume after auth
getCurrentUserId() (services/auth) -> if null -> fallback
fetch recipient record via GET /notifications?id=... (RLS-scoped to caller) -> if 404/forbidden -> fallback /notifications with "This update is no longer available"
resolve policy by kind -> if gated capability off -> fallback
validate current resource access (fetch order snapshot) -> if forbidden/gone -> fallback /orders
resolve intent via CUSTOMER_INTENTS -> if null -> fallback
mark inbox read (POST .../read) ; navigate
clear the processed response (Notifications.clearLastNotificationResponse) so it never replays
```

Cold start uses `getLastNotificationResponse()` at module top-level plus a startup check (per SDK 57 doc), warm uses `addNotificationResponseReceivedListener`; both funnel into `validateTap`. A tap never issues a business command (FR-45, AC-6).

## 5. NotificationProvider lifecycle

Mounted once in `_layout.tsx`. On a signed-in session (observed via `supabase.auth.onAuthStateChange`):

1. Register the response/receive listeners once (guard with a module flag so Fast Refresh doesn't double-register). The response listener and `getLastNotificationResponse()` top-level call live in a tiny module imported by `_layout` so a cold-start tap is caught as early as possible (SDK 57 guidance).
2. Start `realtimeManager` for `messaging:customer:{user_id}` after `supabase.realtime.setAuth()` (required for private channels).
3. Start the `OrderStateSource` (synthetic in `__DEV__`, else `unavailable`).
4. Reconcile (FR-42): fetch active-orders snapshot, inbox first page, unread count; seed `capsules` and `appliedVersion`.
5. Request push permission only when triggered (FR-37), never here.

`AppState` "active" and Realtime "SUBSCRIBED" both call `reconcile()`. On `SIGNED_OUT` or a user-id change: `SESSION_RESET`, stop the channel, stop the source, best-effort `DELETE /devices/{id}`, clear caches, `dismissAllNotificationsAsync` + reset badge, end live activities (stub) (FR-46). A single `EXPIRE_TICK` timer (1 s) runs only while something is visible/pending.

## 6. Realtime subscription manager

`realtimeManager.ts`: one `supabase.channel("messaging:customer:"+userId, { config: { private: true } })`, `.on("broadcast", { event: "hint" }, …)`. Authorization is RLS on `realtime.messages` (0004): the customer may read broadcasts on exactly their own topic (topic parsed, user-id compared to `auth.uid()`), matching the spec's `POST /realtime-authorizations` intent (ADR-0003 maps that route to `supabase.realtime.setAuth()` + the private channel, not a bespoke token endpoint — justified in ADR-0003). Hints carry `{notification_id, kind, resource_type, resource_id, resource_version, occurred_at}` only — never a protected row (FR-41, §14). On reconnect the manager calls `reconcile()` (hints may have been missed). JWT refresh re-sends `access_token` to keep the channel authorized; a short JWT window is assumed (§ Realtime authorization doc).

## 7. Push registration adapter

`pushAdapter.ts` never imports `expo-notifications` at module scope. `getPushAvailability()` returns `unavailable` when `Constants.executionEnvironment === "storeClient"` (Expo Go) or `!Device.isDevice`; otherwise it dynamically `import("expo-notifications")`. `register(userId)`:

- `Device.isDevice` guard; on Android create the channels (`order_updates`, default) **before** requesting a token (required for the Android 13 permission prompt and token fetch).
- `getExpoPushTokenAsync({ projectId: Constants.expoConfig.extra.eas.projectId })`; `POST /devices` with `{ expo_push_token, app_kind:"customer", environment, device_model, permission_status }` — the server derives the user.
- `addPushTokenListener` → re-`POST /devices` on rotation (FR, token rotation).
- `setNotificationHandler` returns `shouldShowBanner:false` for the customer app (coordinator owns foreground presentation, FR-44).
- Sign-out → `DELETE /devices/{installation_id}` (best effort) and local token discard.

In Expo Go the adapter reports `unavailable`, preferences show "Push needs the Toade3 app from the store" and everything else works (FR-43, ADR-0002).

## 8. Order-state source adapter

```ts
interface OrderSnapshot {
  orderId: string; reference: string; itemCount: number;
  resourceVersion: number;
  phase: "placed"|"accepted"|"preparing"|"ready"|"on_the_way"|"delivered"|"rejected"|"cancelled";
  handoverVerified: boolean;
  etaExpiresAt: string | null; etaText: string | null;  // only honoured if fresh (FR-22)
  riderAssigned: boolean;
}
interface OrderStateSource {
  subscribeActiveOrders(cb: (orders: OrderSnapshot[]) => void): () => void;
  getOrder(orderId: string): Promise<OrderSnapshot | null>;   // authorized read (tap validation)
  dispose(): void;
}
```

`syntheticOrderSource` (DEV): an in-memory store the dev panel drives; emits owner-style events through the same `HINT` path (and can fabricate duplicates, out-of-order, push+Realtime pairs, own-command correlation IDs, account switches). Clearly labelled, only constructed when `__DEV__`. `unavailableOrderSource` returns `[]` and `null` so production shows honest empty states until S5. The capsule reads **only** the snapshot; push copy is never trusted (FR-20, FR-22).

Owner-event contracts (S5/S7/S1), documented here for the real producers (release dependency): events follow §11's minimal envelope (`event_id, schema_version, event_type, producer, resource_type, resource_id, resource_version, occurred_at, correlation_id, data`). Customer-relevant: `order.created`, `order.status_changed{status}`, `order.assignment_changed`, `delivery.status_changed{status}`, `order.cart_validation`, `support.ticket_changed` (S7), `account.access_changed`/capability decisions (S1). Capability gates: payment/refund need S8 `payment.*`/`refund.*` + `payments` flag; proximity/arrival need S5 validated `proximity`/`arrival` milestones + their flags; review needs S7 `reviews`; item-watch needs S2 `item_watch` + consent; marketing needs `marketing_consent` + a valid campaign.

## 9. Supabase `messaging` schema (migration 0004)

Private schema `messaging`; no table is in the Data API. Clients touch only the `customer-api` Edge Function and the private Realtime channel. All tables RLS-enabled; base grants revoked from `anon`/`authenticated`; only named RPCs are `security definer` and granted.

Tables (columns abbreviated; full DDL in 0004):

- `messaging.outbox` — `id, producer, event_id uuid, event_type, resource_type, resource_id, resource_version int, occurred_at, correlation_id, payload jsonb, enqueued_at`. Owner domains insert here in their business transaction. Trigger `after insert` calls `pgmq.send('messaging_events', row_to_json)` in the same transaction (FR-47). Unique `(producer, event_id)`.
- `messaging.consumer_inbox` — `producer, event_id, processed_at, result`; PK `(producer, event_id)` (idempotent consume, FR-48). Version comparison is per `(resource_type, resource_id)` only (§11).
- `messaging.notifications` — `notification_id uuid pk, kind, app_kind, priority, resource_type, resource_id, resource_version, dedup_key text unique, policy_version, template_version, title, body, action_intent, occurred_at, expires_at, superseded_at`. `dedup_key` unique (FR-49 boundary 2).
- `messaging.notification_recipients` — `id, notification_id fk, recipient_user_id, app_kind, scope, read_at, dismissed_at`; unique `(notification_id, recipient_user_id, app_kind)`. Users may not change ownership/body/priority (column grants).
- `messaging.delivery_jobs` — `id, recipient_id fk, installation_id, channel, state, attempt_no, lease_until, not_before, ticket_id, receipt_status, last_error_class`; unique `(recipient_id, installation_id, channel)` (FR-49 boundary 3).
- `messaging.device_installations` — `installation_id uuid pk, user_id, app_kind, environment, project_id, push_token_enc, permission_status, active bool, token_rotated_at, last_seen_at`. Token encrypted at rest (pgcrypto or Vault key; worker-only `SELECT` of the token column via a restricted role). Unique `(push_token_enc)` partial where active, so a re-register under a new user flips `active` on the old row (FR-46, §14).
- `messaging.notification_preferences` — `user_id, app_kind, category, push_enabled, sound, haptics, marketing_consent bool, consent_revision, quiet_hours jsonb, timezone, updated_at, version`. PK `(user_id, app_kind, category)`.
- `messaging.policy_versions` — `id, registry_hash, active bool, created_at` (FR-5). `messaging.templates` — `kind, template_version, title, body, action_intent` (server-controlled copy; no executable UI).
- `messaging.scheduled_alerts` / `messaging.escalation_records` — `owner_resource, deadline_at, stage, next_check_at, state`; idempotent stage; resolved work cancels pending (FR-53).
- `messaging.dead_letters` — `id, source ('event'|'job'), ref, error_class, payload, created_at` + alarm flag (FR-52).
- `messaging.live_activity_registrations` — stub table, no worker writes yet (Out of scope).

Indexes: `notifications(resource_type, resource_id, resource_version)`, `notification_recipients(recipient_user_id, read_at)`, `delivery_jobs(state, not_before)` partial where `state='pending'`, `delivery_jobs(lease_until)` where leased, `scheduled_alerts(next_check_at)` where active, `device_installations(user_id) where active`.

Client-exposed surface (minimal, via `customer-api` only, mapped in ADR-0003): own inbox page, mark read, preferences get/patch, installation register/detach. Realtime authorization is RLS on `realtime.messages`, not a table. No client view exposes tokens, jobs, tickets or other users' rows.

RLS summary (pgTAP tests written, not executed): recipients `select`/`update(read_at,dismissed_at)` where `recipient_user_id = auth.uid()`; preferences where `user_id = auth.uid()`; installations `select`/`update(active)` where `user_id = auth.uid()` and the token column is **not** client-selectable (column grant); everything else no client policy (worker role only). `realtime.messages`: `select` where the topic equals `messaging:customer:` + `auth.uid()`.

## 10. Edge Functions and scheduling

All worker functions use `auth: 'secret'` (ADR-0003) and a restricted DB role; `customer-api` uses `auth: 'user'` so queries run under the caller's RLS. `pg_cron` + `pg_net` invoke the workers (Vault holds the URL + secret key, per the schedule-functions doc):

- `msg-consume` (every 10 s, or on a DB-trigger `pg_net` call): `pgmq.read('messaging_events', vt=60, qty=20)`; for each, in one transaction write `consumer_inbox` (skip on conflict = already processed), evaluate the policy from the shared `core`, insert `notifications` (on `dedup_key` conflict do nothing), `notification_recipients`, `delivery_jobs` (one per active installation + a `realtime` channel job), broadcast the hint via `realtime.send(private=true)`, then `pgmq.delete` the message. Crash before delete → message reappears after `vt`; idempotency keys make reprocessing safe (AC-8).
- `msg-dispatch` (every 10 s): lease due `delivery_jobs` (`update … set lease_until=now()+90s where state='pending' and not_before<=now() returning …`), recheck access/installation/supersession/expiry/preferences/quiet-hours/marketing-cap/capability from `core` + current rows, commit `state='sent'` intent, then call Expo Push (batch ≤100). Store `ticket_id`. 429/5xx/network → `not_before = now()+backoff(attempt)` with full jitter, bounded; malformed/oversize/credentials → `dead_letters` + ops; timeout → `receipt_status='unknown'` (external dup possible) (FR-50,51).
- `msg-receipts` (every 5 min; only acts on tickets ≥15 min old): `getReceipts` (≤1000 ids); `ok` → done; `DeviceNotRegistered` → set installation `active=false`; other errors classified (FR-51).
- `msg-escalate` (every minute): for `scheduled_alerts` with `next_check_at<=now()`, recheck the owner task; if resolved/withdrawn → cancel; else advance stage idempotently and enqueue the reminder notification (FR-53). Customer app has no escalations; this serves Vendor/Rider/Admin contracts.
- `msg-cleanup` (hourly): mark `superseded_at`, expire past-TTL jobs, delete inbox/notifications past retention (AC A5), sweep exhausted jobs to `dead_letters`.
- `msg-health` (on demand): returns queue age, dead-letter count, unknown-outcome count, provider error rate, missing receipts, config faults — read by an external monitor (FR-54). Not dependent on the queue it measures.

Edge limits honoured: ≤8 concurrent cron jobs, each <10 min, 256 MB, so batches are bounded (20 events, ≤100 push/batch) and loops are time-boxed.

## 11. Generic push payload

`core/pushPayload.ts` (shared with the dispatcher):

```json
{ "title": "Toade3 update",
  "body": "Open the app to view your latest update.",
  "data": { "schema_version": 1, "notification_id": "<uuid>", "app_kind": "customer" } }
```

Plus transport-only fields the dispatcher sets: `priority` (`high` for P0/P1, `normal` for P2/P3), `ttl` (from semantic expiry), `channelId` (`order_updates`), `collapseId`/`threadId` = opaque hash of `resource_type:resource_id` (coalescing in transit, never a readable value). Never OTPs, PINs, QR secrets, addresses, contacts, coordinates (NFR-1, §14). A jest test asserts the builder output keys for all 52 kinds (AC-16).

## 12. OrderStatusCapsule spec

`OrderStatusCapsule.tsx` + `CapsuleProgressPath.tsx`:

- Typeface Manrope: title `fontFamily.semibold` 16, subtitle `fontFamily.regular` 13 (#BDBDBD), action label 13 white. `allowFontScaling` on; `maxFontSizeMultiplier` generous; height grows with text (min height ~88 at 1.0).
- Body `#090909`, 1 pt black rim (`borderColor:"#000"`), radius = height/2, `borderCurve:"continuous"`.
- Leading region: 40 pt white circle, black shopping-bag glyph (`Icon name="orders"` → SF `takeoutbag…`, Material `takeout_dining`; shopping-bag-equivalent), not colour-only status.
- Action pill `#30302E`, white text, wrapped in a `Pressable` with a ≥48×48 hit area (`hitSlop` to pad the visual pill).
- Progress: an inset rounded-rect (capsule) `Path` in `react-native-svg`. Geometry recomputed in `onLayout` from measured `w,h`, inset = stroke/2 + 2, corner radius = (h/2)-inset. Track `#30302E`; progress `#FCB501` drawn as a second `Path` with `strokeDasharray=[len]` and an animated `strokeDashoffset` so the fill starts at top-centre and runs clockwise. `len` = total path length computed from the rounded-rect perimeter formula (no `getTotalLength` dependency). The dashoffset animates via `useAnimatedProps` on the UI thread (Reanimated SVG guide confirms `createAnimatedComponent(Path)` + `animatedProps`).
- Six phases → progress 0/0.2/0.4/0.6/0.8/1.0 (`phases.ts`). Exception (rejected/cancelled): no progress path at all, muted body, exception glyph. Delivered only when `handoverVerified` (FR-20).
- ETA text: shown only if `etaExpiresAt` is in the future after clock-skew correction; else phase fallback ("Preparing your meal" / subtitle "Checking the latest timing"). Never "Ready in 5 min" fabricated (FR-22).
- Hit target ≥48; placement below top safe area with a stable slot (persistent) vs overlay (transient). VoiceOver: one combined label "Order TD-0042, step 4 of 6, ready, View order"; progress path `accessibilityElementsHidden`.
- Reduce Motion: no transform/stroke animation; opacity-only entrance; stroke set instantly.
- Entrance/transition 220-300 ms with `Easing.out(Easing.cubic)` — no spring, no overshoot (FR-28). Multi-order: `OrderSelector` chips above the capsule; the capsule shows the selected order; Orders tab lists all.

## 13. Layering with the glass tab bar and filters modal

The `PresentationHost` is a top-level absolutely-positioned view (`pointerEvents="box-none"`) below the top safe area, mounted in `_layout.tsx` above the `Stack`. It renders a plain (non-glass) capsule/banner; it does **not** use GlassView/BlurView and does **not** animate the size/opacity of any glass ancestor, so the crash rule holds (FR-38, crash-glass plan). It never covers the floating tab bar (host sits at the top; tab bar at the bottom) (FR-39). While a transparentModal route (search/filters/location-picker) is focused, the host defers non-urgent (P1-P3) banners and only renders P0 (which it draws inside its own view, above the modal's content but not over the modal's action row — it sits in the top safe area). Deferral is driven by a `modalOpen` signal the modal routes set via a tiny module store (same pattern as `TabBarScrollContext`). Capsules on Home render in the normal flow, unaffected.

## 14. InlineFeedback wiring (P2 local)

Only flows that exist are wired (decision 5):

- L06 filters applied: `src/app/filters.tsx` already announces the result count via `AccessibilityInfo`. Add an `InlineFeedback` "Results updated — {count} items" rendered inside the sheet (no push/inbox). This is the one real P2 wiring.
- S03 push permission decision and S04 email-code feedback reuse existing inline patterns (S04 already exists on verify-code; left unchanged, marked `E`).
- L01/L02/L03/L05/L07 are contract-only: cart, support and durable-placement flows do not exist. Registry entries + component API are provided so the Vendor/Rider apps and the future cart can use them.

## 15. Orders tab and Account tab

- `orders.tsx`: header, an inbox entry row (`/notifications`) with an unread badge from `GET /notifications` unread count, and an active-orders list from `OrderStateSource.subscribeActiveOrders` rendering a compact capsule per order; empty state when the source is `unavailable` (FR-34). No Reanimated layout animation on list rows (crash rule, NFR-4).
- `account.tsx`: add a "Notifications" row opening `/notification-preferences` (FR-35).
- Preferences screen: grouped switches (order updates; support; account & security — push locked on; offers with quiet-hours presets), marketing consent off by default with a consent revision, sound/haptics toggles, a push-permission CTA (opens the explanation sheet or OS settings), inline "Saved". Versioned PATCH with conflict handling (FR-36).

## 16. Permission prompt timing

An in-app explanation sheet (reusing `BottomSheet`) is shown after the first order placement (synthetic in dev) or when the user taps "Turn on notifications" in preferences — never at launch (FR-37). On OS denial, no re-prompt; an "Open Settings" link appears when the user asks. Android 13 needs a channel before the prompt; `pushAdapter` creates channels first.

## 17. Live Activities adapter (stub)

`liveActivityAdapter.ts` exposes `start/update/end(orderId, model)` as no-ops that log in `__DEV__`, with a comment that iOS ActivityKit/WidgetKit + APNs activity tokens and an Android ongoing-notification equivalent are a separate native target (release dependency, §12, Out of scope). The coordinator calls `end` on terminal/withdrawal so wiring is proven.

## 18. Error handling (per operation)

| Operation | Failure | Recoverable? | Caller receives | Logged |
| --- | --- | --- | --- | --- |
| Realtime subscribe | auth/network | yes (retry + reconcile on reconnect) | silent; stale labels on screens | warn (client console in dev) |
| Snapshot fetch (tap/reconcile) | 401/403/404/network | yes→fallback route; no→safe orders/inbox | safe fallback + brief notice | warn |
| Tap validate | gated/forbidden/gone | n/a | safe fallback, inbox marked read only | info |
| `POST /devices` | network/5xx | yes (retry on next resume + token listener) | push stays "pending" | warn |
| Preferences PATCH | version conflict (409) | yes (refetch + merge, re-present) | "Preferences changed elsewhere, reloaded" | info |
| `pgmq.read`/consume | crash mid-tx | yes (vt re-delivery; idempotent) | n/a | error → health |
| Expo Push send | 429/5xx/network | yes (bounded backoff+jitter) | job `pending` with `not_before` | warn → metrics |
| Expo Push send | malformed/oversize/credentials | no | job→`dead_letters` | error → ops |
| Expo Push send | timeout | unknown | `receipt_status='unknown'` | warn → metrics |
| getReceipts | DeviceNotRegistered | n/a (disable token) | installation `active=false` | info |
| Escalation recheck | owner read fails | yes (retry next tick) | reminder deferred | warn |

## 19. Input validation (external inputs)

- Push `data`: `schema_version` (required int, must be supported), `notification_id` (required uuid), `app_kind` (required, must equal "customer"); any failure → safe fallback, no navigation (FR-45). Layer: `core/routing.parsePayload`.
- Customer API bodies: `POST /devices` requires a well-formed Expo push token, app_kind, environment (enum); `PATCH /preferences` validated against the category allowlist + a version int (conflict → 409); the user id always comes from the JWT, never the body (ADR-0003). Layer: `customer-api` handler + DB check constraints.
- Realtime hint: `resource_version` int ≥0, known `resource_type`; unknown types dropped by the coordinator. Layer: `core/coordinator`.
- Owner event envelope: validated against `schema_version` and required fields in `msg-consume`; bad events → `dead_letters` (never crash the loop). Layer: server.
- Invariant ownership: a notification's `dedup_key` and recipient scope are server-owned (column grants); clients can only flip `read_at`/`dismissed_at`. The server (worker role) is the sole owner of priority/body/recipient — enforced at the grant layer because RLS alone can't stop column writes.

## 20. Testability

Unit (jest, `src/`, pure `core` + injected `Clock`): registry (52, hashes, copy whitelist), coordinator (all FR-6..18 scenarios incl. duplicate, out-of-order, stale-after-pickup, push+Realtime, own-command, account switch, P0 displacement, ≤3 queue), versioning (cross-resource), routing (intent allowlist, tap validation incl. cold-start/signed-out/withdrawn/gated), phases (progress + ETA freshness), pushPayload (all kinds), backoff (bounds + jitter range), dedup-key, worker decision logic (recheck suppresses superseded/withdrawn/expired; dead-letter replay idempotency; escalation stops on resolution; DeviceNotRegistered; unknown outcome). Core-copy-parity test (byte-identical `supabase/functions/_shared/core`).

Integration-ish (jest with fakes): `realtimeManager` against a mocked channel; `pushAdapter` availability branch (Expo Go vs dev) with a mocked `expo-notifications`; provider reconcile against a fake source. Component snapshot/geometry tests for the capsule path at several widths.

Not unit-testable here (release gates): real OS push delivery, APNs/FCM receipts, cold-start from a real push, RLS on the live DB (pgTAP written for later), cross-app integration. A design that needed a live DB to test the decision logic would be wrong; keeping logic pure avoids that.

## 21. Test matrix (synthetic recipients)

| Case | Driver | Expectation |
| --- | --- | --- |
| Duplicate event | dev panel emits same event_id twice | one inbox row, one milestone (AC-1) |
| Out-of-order | emit v3 then v2 | v2 dropped; capsule shows v3 (FR-8) |
| Stale after pickup | ready(v2) after on_the_way(v3) | ready suppressed to inbox-only (FR-8, AC-3) |
| Push + Realtime | same notification_id both transports | one banner (FR-18, AC-4) |
| Own-command | place order with correlationId, then its C01 | no success banner; capsule updates (FR-13) |
| Permission denial | pushAdapter denied | in-app + inbox fully usable (AC-10) |
| Account switch | source emits SESSION_RESET + new user | old notices dropped; caches cleared (FR-17, AC-9) |
| Withdrawn assignment | worker recheck sees withdrawn | job suppressed; rider intent → safe fallback (AC-7) |
| Cold-start tap | validateTap with signed-out then gated then valid | fallback / hold-intent / navigate; response cleared (FR-45, AC-9) |
| Worker crash / lease expiry | consume throws post-read | vt re-delivery; no dup (AC-8) |
| Provider timeout (unknown) | push mock times out | receipt_status unknown; no retry storm (FR-51) |
| Receipts | getReceipts ok/DeviceNotRegistered | token disabled on DNR (FR-51) |
| Dead-letter replay | replay exhausted job | idempotent, no dup inbox/command (AC-8) |
| Escalation stops | resolve task before reminder | reminder cancelled (FR-53, AC-5) |

## 22. Phase breakdown (B-E)

- Phase B: `core/` + exhaustive jest (registry, coordinator, versioning, routing, phases, pushPayload, backoff). No UI.
- Phase C: `0004_messaging.sql` (+0005 seed), the six worker functions + `customer-api`, shared-core copy + parity test, worker-logic jest, pgTAP files. Static review only.
- Phase D: client UI + provider/coordinator wiring, `realtimeManager`, `pushAdapter`, inbox, preferences, Orders/Account tabs, dev synthetic panel, `messagingApi`. Wire L06.
- Phase E: full verification (`tsc`, lint, expo-doctor, jest ≥483, `expo export` iOS+Android), accessibility reasoning, device checklist, runbook (`Docs/notifications-runbook.md`), release-gate list.

## 23. Release dependencies

Real S5 order/fulfilment producers (and S7 support, S1 access, S8 payments, S2 inventory); Vendor/Rider/Admin app integration of the shared primitives and their API namespaces; APNs key + FCM credentials and an EAS dev build (and `eas init` for `projectId`); Live Activities native target; payments (C14/C15, A07); support UI (S01 route); independent monitoring channel + external monitor wired to `msg-health`; Vault secrets + cron enabling in the live project; running 0004/0005 and the pgTAP suite.

## 24. app.json change (reported, applied in Phase D)

Add the `expo-notifications` config plugin (Android icon/color, `defaultChannel:"order_updates"`) and `extra.eas.projectId` once `eas init` runs. No other native config. This is the only `app.json` change and it does not affect Expo Go behaviour.
