# Toade3 notification engine: requirements

Status: Phase A draft for design review. Sources of truth: `Docs/Toade3_Notification_Architecture.md` (the spec, cited as §n), `Docs/Toade3_Notification_Implementation_Brief.md` (the brief), `.agents/tasks/notifications/workflow-brief.md` (decisions 1-6). Companion documents: `Docs/notifications-design.md`, `Docs/adr/ADR-0001..0003`.

## 1. Summary

Toade3 gets one shared, event-driven notification engine with audience-specific policies for Customer, Vendor, Rider and Admin (§1, §15). This repository holds only the Customer Expo app and its `supabase/` folder, so the deliverable is:

- a framework-free shared core (policy registry for all 52 activities, presentation coordinator, dedupe/version/expiry rules, routing allowlist, worker decision logic) reusable by the other apps and by the Supabase Edge Functions;
- the Customer UI (NotificationProvider, presentation host, OrderStatusCapsule used as the pop-up for every event, ActionRequiredBanner, InlineFeedback, inbox, preferences);
- the Supabase `messaging` schema, durable queue, workers and Customer API, written as files and static-reviewed but never executed against the live project;
- documented contracts for owner events (S5 Fulfilment, S7 Care, S1 Access, S8 Payments) and for the Vendor/Rider/Admin apps, which are release dependencies.

There is no orders, vendor, rider, support or payments backend yet and the cart is not built. Order-driven features therefore run against an order-state source adapter with a clearly labelled dev-only synthetic implementation (§17 item 12, last sentence).

Priority model (user brief, §2):

| Priority | Meaning | Default presentation |
| --- | --- | --- |
| P0 | Action required / urgent exception | Persistent task or exception card; eligible push and owner-driven escalation |
| P1 | Important milestone | Capsule update, one contextual banner or background push, inbox where the matrix says so |
| P2 | Routine feedback | Inline or quiet update; no push; no repeat of the actor's own confirmed success |
| P3 | Optional offers | Separate consent, frequency cap, quiet hours; never preempts P0/P1 |

### Assumptions (flagged for design review)

- A1. The Customer app is the only app wired here. Vendor/Rider/Admin get registry entries, server policies and integration contracts only.
- A2. Proposed defaults in the spec (banner 6 s / 3 s, ≤3 pending, one promo push per day, 220-300 ms motion) are adopted as configurable constants, not measured values (§15 last paragraph).
- A3. Quiet hours apply to the `offers` category by default; order, support and account updates are exempt unless the user opts in (§13 says P0 does not bypass quiet settings; the user chooses which categories quiet hours cover).
- A4. Remote push is not available in Expo Go on SDK 57 on either platform (ADR-0002). The user's test device (iPhone 13, Expo Go) exercises everything except OS push.
- A5. Inbox retention is 180 days; consumer-dedupe retention is 90 days; dead-letter replay window is 60 days (must be shorter than the dedupe retention).
- A6. The EAS `projectId` does not exist in `app.json` yet; push token registration is blocked until `eas init` runs (release dependency).

## 2. Functional requirements

Each requirement is testable. Trace: spec section and activity IDs.

### 2.1 Policy registry

- FR-1. The shared core exports one registry containing exactly the 52 activity IDs in §4-§8 (C01-C16, V01-V09, R01-R07, A01-A07, S01-S04, L01-L07, M01-M02), each with: kind, audience, priority, surface, origin (server or client-local), push mode, inbox flag, preference category, copy (title, body, CTA label), CTA intent, capability gate, coalescing scope, dedupe mode and wiring status (§2, §4-§8, decision 1). Test: registry has 52 unique IDs and unique kinds; every field is populated with an allowed value.
- FR-2. Copy contains no OTPs, PINs, QR secrets, addresses, phone numbers, coordinates, commissions or provider secrets; only the variables `{order_reference}` and `{item_count}` are allowed, and only in inbox/in-app copy (§8, §14). Test: a lint test scans registry copy for disallowed placeholders and patterns.
- FR-3. Every CTA intent is in a per-audience routing allowlist; an intent outside the app's audience is never routed (§10, §12). Test: each customer intent resolves to a route or a documented fallback; vendor intents are refused by the customer resolver.
- FR-4. Capability gates default to disabled for proximity, arrival, pickup arrival, delay assessment, payments, reviews, marketing consent + campaign, item watch, owner deadlines, low-stock thresholds, vendor approval, operational thresholds, approval workflow, verified security events and independent monitoring; `core` is enabled (§1, §4 notes, §16 bullet 11). Test: C07, C08, C12, C14, C15, C16, M01, M02 produce no presentation and no push while gated.
- FR-5. The registry has a version and a deterministic hash; the server refuses to process events if its active `policy_versions` row hash differs from the deployed code hash (§10 policy_versions). Test: hash is stable across runs; the migration seed hash equals the computed hash.

### 2.2 Presentation coordinator (one per app instance, §3, §12)

- FR-6. At most one transient banner is visible at a time; at most three notices are pending (§3). Test: four rapid P1 updates for four different orders show one, queue three; a fifth P2 is dropped from the transient queue (it still reaches inbox if the policy says so).
- FR-7. Updates for the same order coalesce: a newer notice replaces a pending or visible notice for the same order in place, keeping the higher priority (§3, user brief). Test: accepted then preparing then ready for one order yields one visible notice showing "ready".
- FR-8. Obsolete updates are suppressed: a notice whose resource version is ≤ the last applied version for that resource type and ID, or whose kind is behind the current authorized phase (for example `ready` after `on_the_way`), is never presented (§11, §16 bullet 3). Test: "stale milestone after pickup".
- FR-9. Versions are compared only within the same resource type and ID; an order version is never compared with a delivery version (§11). Test: order v12 and delivery v7 are both accepted.
- FR-10. A version gap (incoming > known + 1) or any hint triggers an authorized snapshot fetch before presentation; presentation follows the snapshot, not the arrival order (§11, §12, §16 bullet 2).
- FR-11. Expired notices (semantic `expires_at` ≤ now) are not presented; banner visible time, push TTL, semantic expiry, owner action deadline and inbox retention are separate fields (§11).
- FR-12. If the person is viewing that order's detail screen, or the persistent capsule for that order is on screen, the update changes the capsule/screen without a second banner (§3, §12, §16 bullet 4).
- FR-13. Own-command suppression: a P2/P1 notice whose correlation ID matches a command this app instance just confirmed (≤ 60 s) produces no success banner; the capsule still updates (§2 P2, §12).
- FR-14. P0 may take the presentation slot from a visible P1/P2/P3; the displaced notice returns to the front of the pending queue if still valid (§3). P3 is shown only when no P0/P1 is visible, pending or unresolved (§3, §8).
- FR-15. Banner durations: P1 6 s, P2 3 s, P3 6 s, P0 stays until dismissed or resolved; with a screen reader running, durations are doubled with a 10 s minimum (§2).
- FR-16. Dismissing a banner never resolves a task: P0 exception/task state persists in the Orders tab and inbox until the authoritative source state changes (§2, §3, user brief). Test: dismiss C10 banner; the rejected-order card remains.
- FR-17. Account switch or sign-out resets the coordinator (pending, visible, seen IDs, versions, own-command map, inbox cache) and drops late events from the previous session (§14, §16 bullet 9). Test: an event tagged with the old session generation is discarded.
- FR-18. Push and Realtime for the same logical notification produce one presentation, keyed by `notification_id` (§9, §12, §16 bullet 4). Test: push then Realtime, Realtime then push, both within 1 s.

### 2.3 Order status display (§3, §17 item 4)

- FR-19. Six display phases Placed, Accepted, Preparing, Ready, On the way, Delivered map to outline progress 0, 0.2, 0.4, 0.6, 0.8, 1.0. The outline is a phase indicator, not physical progress (§3).
- FR-20. Delivered is shown only when the order snapshot has status `delivered` with `handover_verified = true`. A countdown reaching zero never changes the phase (§3, §16 bullet 2).
- FR-21. Rejected and cancelled use exception styling with no completed or progress ring (§3).
- FR-22. ETA copy ("Ready in N min", "Arriving in N min") appears only when the snapshot carries a server estimate whose `expires_at` is in the future (clock-skew corrected). Otherwise honest fallback copy per phase is shown (for Preparing: "Preparing your meal" with subtitle "Checking the latest timing"). "Ready in 5 min" is never fabricated (§3, brief).
- FR-23. Rider assignment is parallel information (subtitle), not a phase (§3, C05).
- FR-24. Cached state older than 60 s while reads are failing is labelled stale ("Last updated N min ago") and refetched on reconnect/resume (§16 bullet 10, L04).

### 2.4 Customer UI components (§3, §17 item 2, decisions 4-6)

- FR-25. OrderStatusCapsule matches the reference: Manrope; #090909 body with a black outer rim; 40 pt white circle with a black shopping-bag glyph; white semibold 16 pt title; #BDBDBD 13 pt subtitle; #30302E "View order" pill with white 13 pt text; inset rounded-capsule SVG progress path with #30302E track and #FCB501 progress starting at top-centre and running clockwise; live text, never an image.
- FR-26. The same capsule shell is the pop-up for every server event in the foreground (the user's instruction "this the UI component for the pop up notification every event"). Non-order events use the same shell with a status glyph and no progress outline.
- FR-27. The path geometry is recomputed from the measured width and height; stroke changes animate on the UI thread; large text grows the height; the interactive area is ≥ 48 × 48 pt; placement is below the top safe area (§3).
- FR-28. Motion: 220-300 ms entrance/transition with no bounce or overshoot; Reduce Motion removes movement (opacity only) and makes stroke changes instant (§3, user's no-bounce requests).
- FR-29. Screen readers get one combined label per capsule (order reference, phase "step N of 6", timing text, action), banners are announced politely without moving focus, and a dismiss action is available where dismissal is allowed (§3).
- FR-30. Multiple active orders: one persistent capsule plus an accessible selector on Home; the Orders tab lists every active order (§3, §17 item 4).
- FR-31. ActionRequiredBanner: P0 exception variant of the capsule (rejected, rider arrived when enabled, payment attention when enabled) with persistent card in the Orders tab after dismissal.
- FR-32. InlineFeedback: P2 local feedback near the affected control, polite live region, no push or inbox (§8). Wired for L06 (filters Apply). Other local activities are contract-only because their flows do not exist.
- FR-33. Inbox: route `/notifications`, own-app records only, grouped by date with order reference, explicit read state not conveyed by colour alone, cursor paging, pull to refresh, mark one/all read, error and empty states, stale label offline. Read never acknowledges business work (§2, §10).
- FR-34. Orders tab: an inbox entry with unread count and an active-orders list fed by the order-state source, so missed alerts are recoverable (decision 6, §9).
- FR-35. Account tab: a Notification preferences entry opening `/notification-preferences` (decision 6).
- FR-36. Preferences: groups order updates, support, account and security, optional offers (§14); push on/off per group (account and security push is locked on), marketing consent off by default with explicit copy and a consent revision, quiet hours (presets) for offers, sound and haptics toggles; versioned save with conflict handling; inline "Saved" feedback (S03).
- FR-37. Permission is requested at a meaningful point (after the first order placement, or from preferences), behind an in-app explanation sheet, never at launch; not re-prompted after an OS denial; "Open Settings" offered when the user asks (§12, §14, decision 6).
- FR-38. Modal layering: banners never cover modal actions; non-urgent notices defer while a modal is open; P0 renders in a coordinated host inside the root-stack modals (search, filters, location picker). No component animates the size or opacity of a GlassView/BlurView or any ancestor of one (§3, crash rule in `.agents/tasks/crash-glass-storage-plan.md`).
- FR-39. The banner host passes touches through outside the banner; it never covers the floating tab bar (§3).

### 2.5 Provider lifecycle, Realtime and push (§12, §14)

- FR-40. Notification receive/response listeners and the Realtime subscription manager are registered once per app process, cleaned up on sign-out/account switch (§12).
- FR-41. Realtime uses one private channel per signed-in user and app (`messaging:customer:{user_id}`) authorized by RLS on `realtime.messages`; hints carry only opaque IDs, versions and timestamps; clients fetch canonical state after a hint (§9, §14).
- FR-42. On resume, reconnect, Realtime re-subscribe and notification tap, the app re-authorizes and reconciles: active orders snapshot, inbox first page and unread count (§12).
- FR-43. In Expo Go the push adapter reports "unavailable" without loading `expo-notifications`, and every other feature works. In a development or release build it registers the installation, handles token rotation and Android channels (§12, ADR-0002).
- FR-44. Foreground push for the customer app is not shown by the OS; the coordinator decides presentation (§12).
- FR-45. Tap handling (warm and cold start): parse the generic payload; if signed out, hold one bounded intent (10 min) through sign-in; fetch the caller's recipient record; validate audience, intent allowlist, capability and current resource access; then navigate, otherwise open a safe fallback (`/orders` or `/notifications`) with a short notice. The processed response is cleared and never replayed. A tap marks the inbox record read and nothing else (§12, §16 bullet 9).
- FR-46. Sign-out cleanup: detach this installation while still authenticated (best effort), stop subscriptions, clear per-user caches, dismiss presented notifications, reset badge, end live activities (stub). A different user registering the same installation detaches the previous association server-side (§14).

### 2.6 Backend (§9-§11, §13, decision 2)

- FR-47. Owner domains commit the business change and an outbox row in one transaction; an outbox trigger enqueues the envelope to the durable queue in the same transaction (§9 step 1-2, ADR-0001).
- FR-48. The consumer is idempotent: `consumer_inbox (producer, event_id)` unique; one S6 transaction writes consumer_inbox, notifications, recipients, delivery jobs, the resource projection and the Realtime hint, and acknowledges the queue message (§9 step 3, §13).
- FR-49. Deduplicate at three boundaries: source event, logical recipient notification (`dedup_key` unique), per-installation channel job (`recipient_id, installation_id, channel` unique) (§13).
- FR-50. Leased, concurrency-bounded delivery workers recheck access, installation, resource projection, supersession, semantic expiry, preferences, quiet hours, marketing cap and capability flags immediately before provider submission; delivery intent is committed before the provider call; lease length covers the provider timeout (§9 step 4, §13).
- FR-51. Expo Push: generic copy only; batches ≤ 100; tickets stored; receipts fetched ≥ 15 min after send in batches ≤ 1000; `DeviceNotRegistered` disables the installation; 429/5xx/network retried with bounded exponential backoff and full jitter; malformed/oversize/credential faults are not retried and are routed to operations; timeouts are recorded as unknown outcomes (§13, Expo Push docs).
- FR-52. Poison events and exhausted jobs go to a dead-letter store with an alarm; replay re-enters the same idempotency gates and cannot create duplicate inbox records (§13, §16 bullet 8).
- FR-53. Escalation reminders exist only for owner tasks with an owner deadline; each stage is idempotent and rechecks ownership, assignment, state and deadline; resolution cancels pending reminders; read/dismiss never resolves (§5, §13, §16 bullet 5).
- FR-54. Independent monitoring: a health endpoint and heartbeats expose queue age, dead letters, unknown outcomes, provider errors, missing receipts and configuration faults, polled by a monitor outside the pipeline (§7 A03, §13).
- FR-55. Delivery telemetry never feeds back into user-facing policies (§9 last paragraph).
- FR-56. Customer API routes from §10 are preserved as Edge Function routes or RPCs (ADR-0003), all deriving the user from the JWT, never from the request body.

### 2.7 Synthetic source and dev tooling (workflow brief)

- FR-57. An `OrderStateSource` interface with a dev-only synthetic implementation and a dev panel (only when `__DEV__`) to create orders, advance status, reject, cancel, set/clear ETA, emit duplicate, out-of-order, push+Realtime pairs, own-command events and account switches. Production builds use the `unavailable` source until S5 exists and show honest empty states.

## 3. Non-functional requirements

- NFR-1 Privacy: push payload is exactly `{title: "Toade3 update", body: "Open the app to view your latest update.", data: {schema_version: 1, notification_id, app_kind}}` plus transport fields (priority, ttl, channelId, opaque collapse/thread IDs) (§11, §14, decision 3).
- NFR-2 Security: push tokens encrypted at rest and never readable by clients; workers use a restricted DB role; clients use the publishable key only; authorization never derived from `user_metadata` (§10, §14).
- NFR-3 Expo Go compatibility: any new client dependency must be in Expo Go (`react-native-svg` yes; `expo-notifications` module present, remote push unavailable) and installed with `npx expo install` (AGENTS.md).
- NFR-4 Performance: animations on the UI thread; no Reanimated layout animations on virtualized rows; inbox scroll uses a memoized FlatList; the foreground acceptance-to-render p95 < 500 ms over 200 trials remains a measured release gate, not a push SLA (§13).
- NFR-5 Accessibility: safe areas, large text, VoiceOver/TalkBack labels, Reduce Motion, ≥ 48 pt targets, contrast ≥ 4.5:1 for text (#BDBDBD on #090909 ≈ 10.6:1; white on #30302E ≈ 13.2:1). Full WCAG validation needs manual assistive-technology testing.
- NFR-6 Testability: all decision logic is pure TypeScript with an injected clock, covered by jest in `src/`; SQL is static-reviewed and pgTAP tests are written for later execution.
- NFR-7 No regression: baseline 483 jest tests, `tsc` 0 errors, lint 0 errors (`.agents/tasks/notifications/baseline.md`).

## 4. Activity registry (all 52)

Column key. Origin: `srv` server-produced notification, `loc` client-local feedback. Push: `bg` background push, `cond` conditional, `oncall` on-call only, `indep` independent channel, `opt` opt-in only, `-` none. Inbox: Y/N. Gate: capability required (`core` = always on). Wiring in this repo: `W` wired (presentation + synthetic source in dev; real producer pending), `WP` wired presentation, producer pending, `G` presentation built but disabled by gate, `E` existing in-app feedback left unchanged, `P` partially wired, `C` contract-only (registry + server policy; UI lives in another app or the flow does not exist here). Intent `-` = no CTA navigation.

### 4.1 Customer (§4)

| ID | Kind | Pri | Surface | Origin | Push | Inbox | Title | Body | CTA | Intent | Category | Gate | Wiring |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C01 | customer.order.placed | P1 | capsule | srv | bg | Y | Order placed | We have sent your order to the vendor. | View order | order.details | order_updates | core | W |
| C02 | customer.order.accepted | P1 | capsule | srv | bg | Y | Your order is accepted | The vendor has accepted your order. | View order | order.details | order_updates | core | W |
| C03 | customer.order.preparing | P2 | capsule_quiet | srv | - | N | Your meal is being prepared | The kitchen has started on your order. | View order | order.details | order_updates | core | W |
| C04 | customer.order.ready | P1 | capsule | srv | bg | Y | Your meal is ready | It is ready for your rider to collect. | View order | order.details | order_updates | core | W |
| C05 | customer.order.rider_assigned | P2 | capsule_quiet | srv | - | N | A rider is assigned | A rider will collect your order. | View order | order.details | order_updates | core | W |
| C06 | customer.order.on_the_way | P1 | capsule | srv | bg | Y | Your order is on its way | Your rider has collected your order. | Track order | order.track | order_updates | core | W |
| C07 | customer.order.rider_nearby | P1 | banner + capsule | srv | bg | N | Your rider is nearby | Your order will arrive soon. | Track order | order.track | order_updates | proximity | G |
| C08 | customer.order.rider_arrived | P0 | action_capsule | srv | bg | Y | Your rider has arrived | Please meet your rider to receive your order. | View order | order.details | order_updates | arrival | G |
| C09 | customer.order.delivered | P1 | completion banner | srv | bg | Y | Your order is delivered | Enjoy your meal. | View order | order.details | order_updates | core | W |
| C10 | customer.order.rejected | P0 | exception_banner | srv | bg | Y | Your order could not be accepted | The vendor could not take this order. | View order | order.details | order_updates | core | W |
| C11 | customer.order.cancelled | P1 | exception_banner | srv | bg | Y | Your order is cancelled | This order has been cancelled. | View order | order.details | order_updates | core | W |
| C12 | customer.order.delayed | P1 | exception_capsule | srv | bg | Y | Your order is taking longer | We are checking the latest timing for you. | View order | order.details | order_updates | delay_assessment | G |
| C13 | customer.cart.review_required | P0 | inline_card | loc | - | N | Your cart needs a quick review | Some prices, stock or delivery details changed. | Review cart | cart.review | local | core | C |
| C14 | customer.payment.attention | P0 | inline recovery + banner | srv | bg | Y | Your payment needs attention | Open your order to review the payment. | View payment | payment.view | order_updates | payments | C (gated) |
| C15 | customer.refund.updated | P1 | inbox + banner | srv | bg | Y | Your refund has an update | Open the app to see the latest refund status. | View refund | refund.view | order_updates | payments | G |
| C16 | customer.order.review_requested | P2 | inbox_only | srv | - | Y | How was your order? | Tell us about your delivery. | Rate order | order.rate | order_updates | reviews | G |

Customer copy notes (§4): C04 says ready for the rider, not for customer pickup; C10/C11 never imply a refund; C14/C15 remain disabled until S8.

### 4.2 Vendor (§5) - all contract-only here

| ID | Kind | Pri | Surface | Origin | Push | Inbox | Title | Body | CTA | Intent | Category | Gate | Wiring |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V01 | vendor.order.new | P0 | task_card + banner | srv | bg | Y | New order needs your response | Review the order to accept or decline it. | Review order | kitchen.order_review | work_alerts | core | C |
| V02 | vendor.order.response_overdue | P0 | task_card (persistent) | srv | cond | Y | This order still needs a response | The response deadline is approaching. | Review order | kitchen.order_review | work_alerts | owner_deadline | C |
| V03 | vendor.order.cancelled | P0 | board_update + banner | srv | bg | Y | Order {order_reference} is cancelled | Stop preparing this order. | View order | kitchen.order_details | work_alerts | core | C |
| V04 | vendor.order.rider_assigned | P2 | board_update (quiet) | srv | - | N | A rider is assigned | A rider will collect this order. | View order | kitchen.order_details | work_alerts | core | C |
| V05 | vendor.order.rider_at_pickup | P0 | task_card | srv | bg | Y | Your rider is at pickup | Hand over the order when it is ready. | View pickup | kitchen.pickup | work_alerts | pickup_arrival | C |
| V06 | vendor.order.collected | P2 | board_update (quiet) | srv | - | N | Order collected | The rider has collected this order. | View order | kitchen.order_details | work_alerts | core | C |
| V07 | vendor.stock.low | P2 | badge + inbox | srv | - | Y | An item is running low | Review stock for your menu. | Review stock | menu.stock | work_alerts | low_stock_thresholds | C |
| V08 | vendor.store.intake_paused | P0 | persistent warning | srv | bg | Y | Your store is not accepting orders | Review your store status. | Review store | store.status | work_alerts | core | C |
| V09 | vendor.account.approval_decision | P1 | banner + inbox | srv | bg | Y | Your vendor account has an update | Open the app to see the decision. | View account | account.view | account_security | vendor_approval | C |

V01 is acknowledged only by the S5 accept/reject transition. Foreground repeat chime (20 s) only while a pending ticket exists and limits allow; no repeated background push or sound (§5).

### 4.3 Rider (§6) - all contract-only here

| ID | Kind | Pri | Surface | Origin | Push | Inbox | Title | Body | CTA | Intent | Category | Gate | Wiring |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R01 | rider.jobs.available | P1 | job-feed prompt | srv | cond | N | New delivery jobs are available | Open the job feed to see them. | View jobs | jobs.list | work_alerts | core | C |
| R02 | rider.job.claimed | P2 | local task-card update | loc | - | N | Delivery added to your jobs | - | View job | jobs.detail | local | core | C |
| R03 | rider.pickup.ready | P0 | persistent pickup task | srv | bg | Y | Your pickup is ready | The order is ready to collect. | View pickup | jobs.pickup | work_alerts | core | C |
| R04 | rider.assignment.changed | P0 | task removal + banner | srv | bg | Y | Your delivery assignment changed | Open your jobs for the latest list. | View jobs | jobs.list | work_alerts | core | C |
| R05 | rider.handover.verification_required | P0 | job detail task | loc | - | N | Confirm the handover | Use the handover step in the job. | Verify handover | jobs.handover | local | core | C |
| R06 | rider.delivery.completed | P2 | local success + refresh | loc | - | N | Delivery completed | - | View jobs | jobs.list | local | core | C |
| R07 | rider.claim.failed | P1 | inline job feedback | loc | - | N | This job cannot be added | Refresh to see available jobs. | Refresh jobs | jobs.list | local | core | C |

Job offers never assign; R04 opens View jobs and purges old contacts/proofs; handover copy never contains the code (§6).

### 4.4 Admin (§7) - all contract-only here (A03 health endpoint is built server-side)

| ID | Kind | Pri | Surface | Origin | Push | Inbox | Title | Body | CTA | Intent | Category | Gate | Wiring |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A01 | admin.order.needs_response | P0 | incident dashboard | srv | oncall | Y | An order needs attention | Review the incident. | Review incident | ops.incident | operations | operational_thresholds | C |
| A02 | admin.delivery.needs_intervention | P0 | incident dashboard | srv | oncall | Y | A delivery needs attention | Review the incident. | Review incident | ops.incident | operations | operational_thresholds | C |
| A03 | admin.pipeline.degraded | P0 | monitoring dashboard | srv | indep | Y | Notification delivery is degraded | Open operations for details. | Open operations | ops.health | operations | independent_monitoring | C (health endpoint built) |
| A04 | admin.coverage.issue | P0 | operations dashboard | srv | oncall | Y | Delivery coverage needs attention | Review coverage. | Review coverage | ops.coverage | operations | core | C |
| A05 | admin.approvals.waiting | P2 | badge / digest | srv | - | Y | Applications are waiting for review | Review pending applications. | Review applications | ops.approvals | operations | approval_workflow | C |
| A06 | admin.security.incident | P0 | restricted security dashboard | srv | oncall | Y | A security event needs review | Review the security event. | Review security | ops.security | operations | security_events | C |
| A07 | admin.payment.incident | P0 | finance incident dashboard | srv | oncall | Y | A payment needs review | Review the payment incident. | Review payment | ops.payment | operations | payments | C |

Alerts go to the responsible on-call audience, not all admins; A03 must not rely on the S6 queue/push path (§7).

### 4.5 Shared, local and marketing (§8)

| ID | Kind | Pri | Surface | Origin | Push | Inbox | Title | Body | CTA | Intent | Category | Gate | Wiring |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S01 | shared.support.replied | P1 | banner + inbox | srv | bg | Y | Support has replied | Open the app to read the reply. | View support | support.view | support | core | WP (fallback route: inbox) |
| S02 | shared.account.access_changed | P0 | access gate / account message | srv | cond | Y | Your account needs attention | Open your account for details. | View account | account.view | account_security | core | WP |
| S03 | shared.push_permission.decision | P2 | inline preference feedback | loc | - | N | Choose how Toade3 updates you | - | Notification settings | settings.notifications | local | core | W |
| S04 | shared.auth.email_code_requested | P2 | auth screen feedback | loc | - | N | Check your email | - | Enter code | - | local | core | E |
| L01 | local.cart.item_added | P2 | snackbar / cart badge | loc | - | N | Added to your cart | - | View cart | cart.view | local | core | C |
| L02 | local.cart.vendor_switch_confirm | P2 | confirmation sheet | loc | - | N | Start a new cart? | Your current cart is from another vendor. | Review new cart | cart.review | local | core | C |
| L03 | local.form.validation_error | P2 | inline field error | loc | - | N | Check the highlighted details | - | Focus field | - | local | core | E |
| L04 | local.connection.lost | P1 | persistent connectivity strip | loc | - | N | You are offline | Updates may be delayed. | Try again | - | local | core | P |
| L05 | local.order.placement_unknown | P0 | persistent recovery card | loc | - | N | We are checking your order | - | Check order status | orders.list | local | core | C |
| L06 | local.discovery.results_updated | P2 | inline count feedback | loc | - | N | Results updated | {count} items | None | - | local | core | W |
| L07 | local.support.send_unconfirmed | P1 | inline pending/failed message | loc | - | N | Your message has not been confirmed | - | Check message | - | local | core | C |
| M01 | marketing.offer.available | P3 | inbox; optional banner | srv | opt | Y | An offer is available near you | Open the app to see it. | View offer | offer.view | offers | marketing_consent | G |
| M02 | marketing.item_watch.available | P3 | inbox; optional banner | srv | opt | Y | An item you saved is available | Open the app to see it. | View item | item.view | offers | item_watch | G |

L06 body `{count}` is a client-local variable (not server copy). L04 partial wiring: notification surfaces show offline/stale labels from failed reads and Realtime status; an app-wide connectivity strip is out of scope (no connectivity library is installed).

Totals: Customer 16, Vendor 9, Rider 7, Admin 7, Shared 4, Local 7, Marketing 2 = 52.

## 5. Acceptance criteria

AC-1 to AC-14 restate §16; AC-15 onward are repository-specific. "Verified by" names the layer that can prove each one in this repository; physical-device items are release gates.

1. AC-1 One committed order creates one logical customer milestone and one kitchen task under duplicate/replayed events. Verified by: worker jest (in-memory store with the SQL uniqueness rules) + pgTAP file (not executed).
2. AC-2 Accepted/preparing/ready/pickup/delivered/rejection/cancellation follow authorized current state, not push arrival order or elapsed time. Verified by: core jest (coordinator + snapshot), synthetic dev panel.
3. AC-3 A delayed ready event after pickup/completion is suppressed; per-resource counters are never compared across types. Verified by: core jest (client) + worker jest (server recheck).
4. AC-4 The same foreground update via push and Realtime yields one presentation; the current detail screen gets no duplicate banner. Verified by: core jest.
5. AC-5 Vendor dismissal/read does not stop an unresolved task timer; accept/reject/cancel stops it; a reminder after completion is suppressed. Verified by: worker jest (escalation decision); Vendor app is a release dependency.
6. AC-6 Two riders claiming a job cannot be assigned by a notification tap; the owner command settles it. Verified by: routing jest (intents never call commands) + contract review; Rider app is a release dependency.
7. AC-7 Withdrawn assignments remove old access, contacts and live activity state; View jobs is safe after permission loss. Verified by: worker jest (recheck suppresses withdrawn rider jobs) + routing jest (rider intent fallback); Rider app is a release dependency.
8. AC-8 Queue crash after S6 commit, provider timeout, duplicate receipt and dead-letter replay create no duplicate inbox records or business commands. Verified by: worker jest.
9. AC-9 Sign-out, account switch, token rotation, removed membership, disabled permission and cold-start tap expose no old-user records. Verified by: core jest (reset, tap validation), provider tests where feasible, pgTAP RLS file, device checklist.
10. AC-10 Denied push or provider outage leaves in-app status, inbox and task board usable; cached status is labelled stale and refetched. Verified by: core jest + Expo Go manual run.
11. AC-11 Payment/refund, review, proximity/arrival and marketing stay disabled without their capability/consent/source contracts. Verified by: core jest + worker jest.
12. AC-12 Screen readers, small widths, larger text, reduced motion, keyboard/modal layers and the last tappable feed card work with the banner host. Verified by: manual checklist on iPhone 13 Expo Go; layout maths in jest.
13. AC-13 Physical iOS/Android tests cover foreground, background, locked and cold-start behaviour; mock delivery is not proof of OS delivery. Verified by: release gate (dev build + credentials).
14. AC-14 Ordering-to-alert, transport handoff and business acknowledgement are measured separately with device/build/network/backend revisions retained. Verified by: release gate; health snapshot provides the server-side numbers.
15. AC-15 Registry contains exactly 52 entries matching section 4 of this document. Verified by: core jest.
16. AC-16 Push payload builder output contains only the allowed keys and fixed copy for every kind. Verified by: worker jest.
17. AC-17 Capsule outline: progress 0/0.2/0.4/0.6/0.8/1.0 for the six phases; starts top-centre clockwise; exception states render no progress stroke; ETA copy only with a fresh estimate. Verified by: core jest (geometry + copy) + manual visual check.
18. AC-18 Entrance and transitions use timing curves of 220-300 ms with no spring or overshoot; Reduce Motion uses opacity only. Verified by: code review checklist + manual run.
19. AC-19 In Expo Go (iPhone 13, iOS 27.3) the app launches without notification errors; preferences show push as unavailable; synthetic orders drive capsule, banner, inbox and Orders tab. Verified by: manual run.
20. AC-20 `npx tsc --noEmit` and `npx expo lint` report 0 errors; all jest suites pass with ≥ 483 tests; `npx expo export` succeeds for iOS and Android. Verified by: Phase E.
21. AC-21 No SQL is executed against and no function is deployed to the live project. Verified by: Phase E report.

## 6. Out of scope

- Vendor, Rider and Admin app UIs, routes and their API namespaces (contracts only).
- Real S5 order/fulfilment, S7 support, S1 access, S8 payments and S2 inventory producers.
- Cart, checkout, order history, support chat and payment screens (no flows exist).
- Native iOS Live Activities / Android ongoing notifications (adapter stub only).
- SMS/WhatsApp/call fallback (§13).
- An app-wide connectivity strip and new connectivity dependency.
- Executing migrations, pgTAP tests or deploying Edge Functions; configuring APNs/FCM credentials, EAS project, Vault secrets or the external monitor.
- Analytics/telemetry SDKs on the client.
