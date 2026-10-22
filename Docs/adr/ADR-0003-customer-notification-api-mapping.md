# ADR-0003: Customer notification API mapping (routes → Edge Function / RPC)

Status: Proposed (Phase A, 20 Oct 2026; revised 21 Oct 2026 for design reviews 1 and 2). Spec §10 "Preserve the existing Customer API routes". Workflow decision 2: "the design decides and documents the mapping".

## Context

No Customer API exists yet: the §10 routes are the contract, not deployed endpoints. Supabase offers two serving options:

- PostgREST RPC (`/rest/v1/rpc/<fn>` on an exposed schema). Runs in Postgres with the caller's JWT, so `auth.uid()` and grants apply. No cold start.
- Edge Functions (`/functions/v1/<name>/...`). Deno. Needed when a request uses a secret that must not live in SQL, or needs HTTP-only logic.

## Decision

| Spec route | Implementation | Why |
| --- | --- | --- |
| `POST /v1/customer/devices` | Edge Function `customer-devices`, `POST /functions/v1/customer-devices`. `verify_jwt = true` (platform check), then `supabase.auth.getClaims(jwt)` for `sub`. Calls `messaging_worker.upsert_installation(...)` with the secret key. | The Expo token is AES-GCM encrypted with `PUSH_TOKEN_ENC_KEY` and HMAC-hashed with `PUSH_TOKEN_HMAC_KEY`, both Edge secrets kept out of the DB. It also validates projectId and environment against `EXPO_PROJECT_ID` and rate-limits. |
| `DELETE /v1/customer/devices/{installation_id}` | Same function, `DELETE /functions/v1/customer-devices/{installation_id}` → `messaging_worker.detach_installation(p_user_id, p_installation_id)` | Keeps the device surface in one place. Idempotent `204`. |
| `GET /v1/customer/notifications` | RPC `messaging_api.list_notifications(p_app_kind, p_cursor, p_limit)` | Read under the caller's JWT; SQL filters `recipient_user_id = auth.uid()`. |
| (detail, needed for tap validation) | RPC `messaging_api.get_notification(p_notification_id, p_app_kind)` | Same. Filters `recipient_user_id = auth.uid() and app_kind = p_app_kind`, so a user who is both a customer and vendor staff never receives their vendor record in the Customer app. Returns null for missing, foreign or other-audience IDs (no existence leak). The item carries `app_kind`, `expires_at` and `resource_version` for client-side audience, expiry and version checks. |
| `POST /v1/customer/notifications/{id}/read` | RPC `messaging_api.mark_notification_read(p_notification_id, p_app_kind)` (+ `mark_all_read(p_app_kind)`, `unread_count(p_app_kind)`) | Idempotent update of the caller's recipient row for that audience only. Never touches owner domains. |
| `GET /v1/customer/notification-preferences` | RPC `messaging_api.get_preferences(p_app_kind)` | Lazily creates the default row. |
| `PATCH /v1/customer/notification-preferences` | RPC `messaging_api.update_preferences(p_app_kind, p_expected_version, p_patch)` | Optimistic concurrency in one statement; category allowlist validated in SQL. |
| `POST /v1/customer/realtime-authorizations` | RPC `messaging_api.authorize_realtime(p_app_kind)` → `{topic, expires_at, schema_version}` | Checks current account access and returns the server-chosen topic. The real gate is RLS on `realtime.messages` at join time (Supabase Realtime Authorization). `expires_at` (now + 15 min) tells the client when to re-authorise. |
| (client) capabilities | RPC `messaging_api.get_capabilities()` | Server-enabled capability flags for client-side gating. |

Schemas: `messaging_api` (client RPCs; EXECUTE granted to `authenticated` only) and `messaging_worker` (worker RPCs; EXECUTE granted to `service_role` only). Both are added to Dashboard > API > Exposed schemas (SETUP step). Tables stay in the private, unexposed `messaging` schema (no USAGE for clients). The Realtime policy helper lives alone in the unexposed `messaging_rls` schema (USAGE + EXECUTE for `authenticated`, because the `realtime.messages` policy runs as the joining role). Every function is `SECURITY DEFINER` with `set search_path = ''`.

Privileges are explicit per function. Postgres grants EXECUTE to PUBLIC by a global default that a per-schema `ALTER DEFAULT PRIVILEGES … REVOKE` cannot remove, so 0004 follows each `create or replace function` with `revoke execute … from public, anon[, authenticated]` and the intended `grant`, and ends with a schema-wide revoke safety net. pgTAP asserts every function's privileges from `pg_proc`.

Client calls:

- RPC: `supabase.schema("messaging_api").rpc("list_notifications", {...})`
- Function: `supabase.functions.invoke("customer-devices", { method: "POST", body })` and `{ method: "DELETE" }` with the installation ID in the path.

Error contract (client service maps to typed errors):

| Condition | RPC | Edge Function | Client error |
| --- | --- | --- | --- |
| No session or invalid JWT | PostgREST 401 / `42501` | 401 `{error: "unauthenticated"}` | `NotSignedInError` (recoverable after sign-in) |
| Account restricted | raise `42501` message `account_restricted` | 403 `{error: "account_restricted"}` | `AccessRestrictedError` (show account entry) |
| Invalid input | raise `22023` message `invalid_<field>` | 400 `{error: "invalid_request", field}` | `InvalidRequestError` (bug; logged warn) |
| Version conflict | returns `{status: "conflict", snapshot}` | n/a | `PreferencesConflict` (reload, inline notice) |
| Rate limited | n/a | 429 `{error: "rate_limited", retry_after_s}` | `RateLimitedError` (retry later silently) |
| Network or 5xx | fetch error / 5xx | fetch error / 5xx | `NetworkError` (retry with backoff; stale label) |

## Vendor / Rider / Admin

They use the same `messaging_api` functions with their own `p_app_kind` (`vendor`, `rider`, `admin`). The server checks `messaging.audience_memberships` / `messaging.account_access` for that app kind, never trusting a client-sent role. Their devices route is `customer-devices` generalised as `app-devices` with `app_kind` validated against membership: a release task in their repos. Route names must be reconciled with each repository (§10).

## Consequences

- One Edge Function on the client path keeps cold starts off inbox reads.
- `messaging_worker` is exposed through PostgREST but executable only by `service_role`. pgTAP tests assert `has_function_privilege('authenticated', ..., 'execute') = false`.
- If an HTTP-route-compatible façade is needed later for installed builds, a thin `customer-api` function can proxy to the same RPCs without changing SQL.
