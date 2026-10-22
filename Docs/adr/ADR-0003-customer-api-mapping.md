# ADR-0003: Mapping the spec's Customer API to Supabase

Status: Proposed (Phase A). Date: 2026. Context: spec §10 (Customer API routes), `Docs/notifications-design.md` §9-§10, Supabase Edge Functions auth docs and Realtime authorization docs (fetched this phase).

## Context

Spec §10 lists Customer API routes that must be preserved. We have two Supabase mechanisms: Edge Functions (Deno) and PostgREST RPCs. Every route must derive the user from the authenticated session (JWT), never from a request body ("never trust an arbitrary recipient ID", §10, §14). The `messaging` schema is private and not in the Data API, so clients cannot hit tables directly.

## Decision

Expose one Edge Function, `customer-api`, with `auth: 'user'` (via `withSupabase`/`createSupabaseContext` from `@supabase/server`), routed by path. `ctx.supabase` is RLS-scoped to the caller, so even a bug cannot cross users; `ctx.userClaims.sub` is the only source of the user id. Verified against the Edge Functions auth guide (auth modes, `ctx.supabase` vs `ctx.supabaseAdmin`). The client calls it through `supabase.functions.invoke`.

Mapping:

| Spec route | Mechanism | Auth | Backing | Notes |
| --- | --- | --- | --- | --- |
| `POST /v1/customer/devices` | `customer-api` `POST /devices` | user JWT | upsert `messaging.device_installations` for `auth.uid()` | server derives user, validates app_kind/env/project; token encrypted; re-register under a new user flips the old row `active=false` |
| `DELETE /v1/customer/devices/{installation_id}` | `customer-api` `DELETE /devices/:id` | user JWT | set `active=false`, revoke jobs for that installation where `user_id = auth.uid()` | detaches only the caller's association |
| `GET /v1/customer/notifications` | `customer-api` `GET /notifications` | user JWT | cursor page of `notification_recipients ⋈ notifications` for `auth.uid()`, + unread count; `?id=` for a single record (used by tap validation) | safe copy, source reference, allowlisted intent only |
| `POST /v1/customer/notifications/{id}/read` | `customer-api` `POST /notifications/:id/read` | user JWT | idempotent `update … set read_at=now() where recipient_user_id=auth.uid()` | does not acknowledge any order/job |
| `GET` / `PATCH /v1/customer/notification-preferences` | `customer-api` `GET`/`PATCH /notification-preferences` | user JWT | `messaging.notification_preferences` for `auth.uid()`; PATCH is a versioned patch with category allowlist + 409 on conflict | consent revision tracked |
| `POST /v1/customer/realtime-authorizations` | **not a bespoke endpoint**: `supabase.realtime.setAuth()` + a private channel `messaging:customer:{uid}` authorized by RLS on `realtime.messages` | user JWT | RLS policy: `select` where `realtime.topic() = 'messaging:customer:' || auth.uid()` | see rationale below |

Worker/cron functions (`msg-consume`, `msg-dispatch`, `msg-receipts`, `msg-escalate`, `msg-cleanup`, `msg-health`) are **not** customer routes. They use `auth: 'secret'` with `verify_jwt=false` (service-to-service), invoked by `pg_cron`+`pg_net` with a secret key from Vault, and use a restricted DB role (not blanket service_role) so they can only touch `messaging`. This matches the auth-guide guidance that cron/`pg_net`/worker callers present a secret key, not a user JWT.

### Why `realtime-authorizations` maps to RLS, not a token endpoint

The spec's intent for that route is "issue short-lived channel access after current resource and app-audience authorization." Supabase's native mechanism for exactly this is Realtime Authorization: RLS policies on `realtime.messages`, evaluated at channel join (Realtime inserts-then-rolls-back a probe message under the user's JWT to test the policy). A custom token endpoint would duplicate, and could drift from, that check, and the Realtime docs warn that a cached join authorization is not a substitute for current owner authorization on the subsequent read — which we honour by re-fetching the authorized snapshot after every hint (§12). So the route's behaviour is provided by `setAuth()` + `private: true` + the RLS policy, and the reads behind each hint re-authorize via `ctx.supabase`. This is a justified refinement of decision 2 (which listed the route among client-exposed surfaces): it is still exposed and still authorized, just through the platform-native path rather than a redundant endpoint.

## Consequences

- One user-facing function, RLS-scoped, with the user id from the JWT only — satisfies §10/§14 and AC-9.
- Vendor/Rider/Admin get their own scoped API functions in their repos reusing the same `messaging` engine (contract-only here).
- Realtime authorization correctness depends on the RLS policy on `realtime.messages` and a short JWT expiry window; both are called out in the design and the release gates. The `ALTER TABLE realtime.messages ENABLE RLS` statement must **not** be in the migration (RLS is already on; the statement fails with "must be owner"), per the Realtime authorization doc — 0004 only adds policies.
- `@supabase/server` reads `SUPABASE_URL`/keys/JWKS from the platform env; no secrets in client or repo (NFR-2).
