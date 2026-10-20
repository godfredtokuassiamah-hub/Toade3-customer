# Toade3 Customer App

Native customer app for the **Toade3 Campus Logistics Platform**: identity, ordering, live tracking and verified delivery for campus food orders in Ghana, backed by Supabase.

> **Confidential.** The architecture is a proposed build blueprint, not a description of a finished system. The full spec is [`Docs/Toade3_Customer_App_End_to_End_Architecture.pdf`](Docs/Toade3_Customer_App_End_to_End_Architecture.pdf) (ARCH-TOADE3-CUSTOMER-2026-V1, v1.0.0 draft, 18 October 2026). If this README and the PDF disagree, the PDF wins.

---

## Current status

| Area | State |
| --- | --- |
| Project setup | Expo SDK 57, React Native, TypeScript, Expo Router |
| Logo / splash screen | Built (`src/app/index.tsx`), animated, moves to onboarding after about 3 s |
| Onboarding | Slide 1 in progress (`src/app/onboarding.tsx`); slides 2 and 3 waiting on designs |
| Typography | Airbnb Cereal planned; font files and licence not yet in the repo |
| Backend (Supabase) | Not started |
| Auth, catalog, ordering, tracking, handover | Not started (see the [delivery plan](#delivery-plan)) |

The project is pinned to **SDK 57** because that's the version the App Store build of Expo Go currently supports. Upgrade once Expo Go ships SDK 58, or once the team moves to development builds.

---

## Getting started

**Prerequisites:** Node.js LTS (v20+), npm, and Expo Go on a phone (or an Android emulator).

```bash
npm install        # install dependencies
npx expo start     # start the dev server, then scan the QR code with Expo Go
```

In the dev server terminal, press `a` for an Android emulator or `w` for web. Windows can't run the iOS simulator, so test iOS on a physical iPhone with Expo Go.

### Everyday commands

```bash
npx expo install <package>   # ALWAYS use this to add packages (picks SDK-compatible versions)
npx tsc --noEmit             # typecheck
npx expo lint                # lint
npx expo-doctor              # check dependency / config health
npx expo install --fix       # fix incompatible package versions
```

Run typecheck and lint before you call any task done. Expo changes a lot between SDK releases, so check APIs against the [SDK 57 docs](https://docs.expo.dev/versions/v57.0.0/) rather than memory. `AGENTS.md` has the full working rules.

### Expo Go vs development builds

Expo Go is fine for UI work right now. The blueprint's target stack (native Google sign-in, SecureStore-backed sessions, SQLite caches, push via FCM/APNs) needs **[development builds](https://docs.expo.dev/develop/development-builds/introduction/)**. Build them in the cloud with EAS (`npx eas-cli@latest build --profile development`), so you don't need Xcode or Android Studio locally.

---

## Project structure

```
src/
  app/                  # Routes only (Expo Router). Every file is a screen.
    _layout.tsx         # Root Stack, native header hidden
    index.tsx           # Logo / splash screen
    onboarding.tsx      # Onboarding pager (3 slides)
  components/           # Reusable UI (outside src/app)
assets/
  images/LOGOS/         # Logo icon, wordmark, pattern background
  UI SCREEN/            # Design references and screen imagery
Docs/                   # Architecture blueprint (PDF)
app.json                # Expo config. Configure native behaviour here, not in ios/ or android/
```

`ios/` and `android/` are generated (Continuous Native Generation) and gitignored. Don't create or edit them by hand; use `app.json` and config plugins.

> **Planned layout.** The blueprint puts this app in a monorepo at `apps/customer`, with shared `packages/ui`, `auth`, `api`, `domain`, `realtime`, `storage` and `device`. This repo is currently a standalone app. Move it when the Vendor and Rider apps join. Never import Rider-only camera or background-location code into Customer screens.

---

## Design system

| Token | Value |
| --- | --- |
| Navy | `#152244` |
| Orange | `#E8682A` |
| Light orange | `#FDEFE6` |
| Typeface | Airbnb Cereal (pending, see below) |
| Logo | Original Toade3 cart-and-flame mark, kept as supplied |

**Font licensing:** Airbnb Cereal is Airbnb's proprietary typeface. Get permission to bundle it before a store release. If you can't, use a close open alternative (Plus Jakarta Sans, Manrope or DM Sans).

---

## Architecture overview

The Customer app owns the customer experience. **Supabase owns identity and all business data.** The Vendor and Rider apps change shared order state through their own authorised commands. Customers only ever see a limited, ownership-checked view.

```
Customer app ──► Supabase Auth (phone OTP, native Google)
     │
     ├──► Authorised business APIs (Edge Functions / RPC)
     │        └──► PostgreSQL + RLS (orders, items, quotes, versions, policies)
     │
     ◄── Private Realtime (active own-order updates)
     ◄── Notification outbox ─► Expo ─► FCM / APNs (push)
```

Realtime and push can only tell the app something changed. Neither can create business state. The app always refetches authoritative data.

### Proposed client stack

| Layer | Choice | Responsibility |
| --- | --- | --- |
| Presentation | React Native + Expo Router | Accessible native screens; explicit loading, empty, stale and error states; no direct table writes |
| Server state | TanStack Query | Server snapshots; no duplicated authoritative order state |
| Local state | Component state / Zustand | Cart draft and UI state |
| Persistence | Expo SQLite | Bounded, versioned read caches and drafts |
| Secrets | Expo SecureStore (Keychain / Keystore) | Session tokens and customer proof credentials, never in SQLite or logs |
| Integration | Typed API adapter | Typed DTOs, stable errors, idempotent commands, private subscriptions, push registration, AppState recovery |

### Navigation

Main tabs are **Home**, **Orders** and **Account**.

- **Bootstrap**: holds the splash until the session and profile are restored. No session opens SignIn. A wrong role opens a role-mismatch screen.
- **Home stack**: VendorList → Menu → Cart → Checkout (Drop point → Quote → Confirm)
- **Order stack**: History → Detail → Tracking → Handover (PIN or QR)
- **Account stack**: Profile, privacy, account deletion
- Deep links and push taps carry an *intent*, not authorisation. Validate the destination and re-read the resource first.
- Sign-out or switching accounts resets the root stack, subscriptions and per-user caches.

**Core journey:** sign in → choose vendor and items → select campus drop point → review quote → confirm order → follow preparation and delivery → present PIN or QR → view completed receipt.

---

## Key business rules

### Identity
- Ghana phone OTP (normalise to `+233`) and native Google sign-in through Supabase Auth. Each new identity gets a customer profile.
- The customer role is checked both by the app's guard and on the server.
- **iOS:** Apple guideline 4.8 likely requires Sign in with Apple alongside Google.

### Cart and drop points
- One vendor per order. Quantities must be positive and every item must belong to that vendor.
- Destinations are controlled campus `drop_point_id`s. Optional foreground location can only *suggest* one.
- Quote requests are debounced by 400 ms. Cached menu prices are display-only.

### Pricing (server-side, Haversine distance rounded **up** to 0.1 km)

| Zone | Priced distance | Delivery fee (GHS) | Target time |
| --- | --- | --- | --- |
| Inner Quad | 0.0 – 1.0 km | 5.00 | 10–15 min |
| Mid Campus | 1.1 – 2.5 km | 8.00 | 15–25 min |
| Outer Perimeter | 2.6 – 4.0 km | 12.00 | 25–35 min |
| Extended Zone | >4.0 – 5.0 km | 12.00 + 2.50 × (km − 4.0) | 35+ min |

- Over **5.0 km** is rejected with `OUT_OF_RADIUS`. Over **8,000 g** per order is rejected with `OVER_WEIGHT`.
- Quotes expire and are bound to the customer and a cart fingerprint. Customers never see the commission or rider payout split.
- Tier-gap rounding and the extended-zone charge are working defaults that still need commercial sign-off.

### Order placement
- One authenticated `place-order` call with a **persisted idempotency key**. The client sends `quote_id`, never a fee or customer id.
- Retrying with the same key returns the existing order and never creates a duplicate.
- `QUOTE_CHANGED` or expiry → fetch a new quote and require explicit customer confirmation.
- A successful response means the order is committed. It is **not** a payment receipt. Payments, settlement and refunds are out of scope.

### Lifecycle and cancellation
`pending → accepted → preparing → ready → out_for_delivery → delivered`, with `rejected` and `cancelled` as terminal branches.
- The customer can cancel only while the order is `pending` or `accepted`, via `cancel_order` with `expected_version`. On `STALE_VERSION`, refetch. Never show "cancelled" just because the button was tapped.

### Tracking and push
- Only the customer's own **active** order and its assigned rider are visible. Access ends when the order ends.
- Reconnect backoff is 1, 2, 4, 8, then at most 15 s. Rider location counts as stale after 90 s (proposed). Never animate a fake moving marker.
- Push payloads are generic: resource id, event id and version only. Never include PINs, QR tokens, phone numbers or precise coordinates.

### Handover proof
- The customer shows a **PIN** (issued once at placement) or a **signed QR** (issued after pickup, valid 30 min). Only the assigned rider submits it, and only the server marks the order delivered.
- Five wrong PINs lock verification for 10 minutes. A lost proof is reissued through a re-authenticated recovery flow. Never place a new order to recover a PIN.
- The Customer app **does not need camera permission**.

### Offline
- Offline covers safe reads and keeping drafts. Placing, cancelling and handover all need a connection.
- There is no offline write queue. If a request's outcome is unknown, resolve it with the original idempotency key before retrying.

---

## Customer API contracts

| Contract | Purpose |
| --- | --- |
| Auth SDK | `signInWithOtp` / `verifyOtp`, native Google token exchange |
| Catalog read *(proposed)* | Paged vendors and menus, availability, price, weight |
| Destination read *(proposed)* | Active campus drop points |
| `quote-delivery` *(Edge)* | Items + drop point → quote id, expiry, fee, weight, total |
| `place-order` *(Edge)* | `quote_id` + `Idempotency-Key` → order id, version, one-time proof |
| `get_order` *(RPC)* | Own order, items, delivery state |
| My orders read *(proposed)* | Paginated own history |
| `cancel_order` *(RPC)* | Own order id + `expected_version` |
| Tracking read / topic *(proposed)* | Active own order → assigned rider and last-seen time |
| `get_handover` *(Edge)* | Owner-only proof issue and recovery |
| `register-device` / `unregister-device` | Push token binding |
| `request-account-deletion` *(Edge)* | Re-authenticated deletion request |

**Error handling:** `401 SESSION_EXPIRED` → re-auth and reconcile · `403 FORBIDDEN` → stop · `409 ITEM_UNAVAILABLE / QUOTE_CHANGED / STALE_VERSION` → refresh and confirm · `422 OUT_OF_RADIUS / OVER_WEIGHT` → revise the cart · `429 RATE_LIMITED` → respect the retry delay. Never treat a timeout as a confirmed rejection.

Customer code must **never** call kitchen transitions, `claim_job`, rider location writes, `verify-handover` or `admin_set_role`. The backend enforces this even against a modified app.

---

## Security, privacy and permissions

- Treat the app as untrusted. RLS, explicit grants and validated command functions enforce access. The Supabase publishable key is public config, not authorisation.
- Check ownership on every order, tracking and proof id (prevents IDOR). Re-price and re-check the role on the server.
- HTTPS/WSS only. Redact tokens, OTPs, PINs and QR tokens from logs. Keep secrets and service keys out of the app bundle.

| Permission | Rule |
| --- | --- |
| Notifications | Ask after a clear explanation; the app works fully if denied |
| Foreground location | Ask only when the user taps "Use my location"; manual drop point otherwise |
| Camera / background GPS | **Not requested.** Rider-app only |
| Contacts / microphone / SMS inbox | **Not requested** |

---

## Environments and release

- Separate **development / staging / production** Supabase projects, app ids, callback allowlists and push scopes. Staging builds must never write to production.
- Pipeline: reviewed repo → CI (types, unit tests, RLS, contracts, native builds) → Supabase staging → signed internal build / TestFlight → production rollout.
- Use expand-and-contract migrations and versioned contracts. Older installed clients stay supported during rollouts.

### Performance targets (budgets, not measured results)

| Area | Target |
| --- | --- |
| Foreground status update | p95 < 500 ms over 200 trials; none > 1,000 ms |
| Quote response | p95 < 800 ms |
| Startup | Cached cold screen ≤ 3 s; warm resume ≤ 1 s |
| Rendering | 60 fps on reference devices |
| Payloads | Menu images ≤ 60 KB; invalidation events < 1 KB |
| Pilot scale | 10,000 users, 300 peak orders/h, 40 riders, 25 vendors |
| Availability | 99.5% monthly during campus operating hours |

---

## Delivery plan

| # | Increment | Deliverable | Exit gate |
| --- | --- | --- | --- |
| 1 | Foundation | Native shell, sign-in, session adapter, customer guard, shared DTOs, safe reads | T1 (identity), T2 (access) |
| 2 | Ordering | Catalog, cart, drop point, quote, atomic placement, pending-operation recovery | T3 (pricing), lost-response / same-key tests |
| 3 | Delivery experience | Own-order state, tracking, subscriptions, push, handover, cancellation | T4 (realtime), full role-integrated journey |
| 4 | Release hardening | Permission fallbacks, privacy and deletion, cache lifecycle, accessibility, signed builds | M1–M4 and release evidence |

### Open decisions

| ID | Decision | Working direction |
| --- | --- | --- |
| C-1 | Platforms | Expo binary for Android and iOS; proposed Android 10 / iOS 16 floor |
| C-2 | iOS identity | Organisation-owned accounts; Sign in with Apple where required |
| C-3 | Read APIs and events | Finalise catalog, history and tracking names and schemas |
| C-4 | Maps and destinations | Native map provider, campus drop points, optional location |
| C-5 | Quote lifecycle | Quote TTL, fingerprint, key retention, proof recovery |
| C-6 | Ops thresholds | 90 s freshness, vendor escalation, latency budgets |
| C-7 | Commercial scope | Tier defaults, single-campus pilot, cancellation exceptions |
| C-8 | Data policy | Deletion, retention, backups, RPO/RTO, supported client versions |

**Done means:** a customer can sign in, place one correctly priced order, follow authorised preparation and delivery updates, present a securely held credential, get server-verified completion, and recover safely from network or process interruptions.

---

## References

- Architecture blueprint: [`Docs/Toade3_Customer_App_End_to_End_Architecture.pdf`](Docs/Toade3_Customer_App_End_to_End_Architecture.pdf)
- Related: Toade3 TRD v1.1.0, `architecture.md` v1.0.0 (not in this repo)
- [Supabase Auth with React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native) · [Native mobile deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) · [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) · [Expo push notifications](https://docs.expo.dev/push-notifications/overview/) · [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
