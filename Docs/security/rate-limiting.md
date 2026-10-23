# Rate limiting (Part A)

The server is authoritative. Anything in the app (JS bundle, `EXPO_PUBLIC_*` values) can be read, and anyone can call Supabase directly with the publishable key plus their own JWT. A modified client or a `curl` script ignores every client-side check. Client throttles exist only to cut accidental load and give clear copy.

## Layers

| Layer | Protects | Does NOT protect |
|---|---|---|
| Supabase Auth rate limits (dashboard, `supabase/SETUP.md` "Rate limits") | OTP send / verify, sign-up, token refresh floods per IP / user; email cost | Data API calls; users behind one NAT IP share a bucket |
| CAPTCHA (release gate) | Scripted sign-up / OTP spam | Nothing until the app sends `captchaToken`; enabling it first breaks sign-in |
| DB limiter, `ratelimit` schema (`supabase/migrations/0009_rate_limits.sql`) | Per-user caps on committed writes: profile writes and cart upserts (triggers; no client can skip them), order place / cancel once the owner line is added | Reads (GET and STABLE RPCs run READ ONLY); calls that fail later in the same transaction (the hit rolls back); floods / DDoS (platform level) |
| `public.ratelimit_consume` (service_role only) | Future Edge Functions can count before doing work, in a separate committed call | Nothing until those functions exist |
| Client throttles (`src/lib/security/*`) | Double taps, resend hammering, retry storms, Photon fair-use | Any attacker |

## Server limits (`ratelimit.limits`, mirrored in `SERVER_RATE_LIMITS`)

| action | max | window | enforced by |
|---|---|---|---|
| `order.place` | 5 | 60 s | `place_order` + owner line (below) |
| `order.cancel` | 10 | 60 s | `cancel_order` + owner line (below) |
| `profile.write` | 10 | 60 s | AFTER INSERT OR UPDATE trigger on `public.profiles` |
| `cart.write` | 60 | 60 s | AFTER INSERT OR UPDATE trigger on `public.cart_drafts` |

Fixed window per (subject, action). Subject = `user:<auth.uid()>`, else `ip:<md5(first X-Forwarded-For)>` (weak, unused today), else `anon`. A fixed window can admit up to 2 x max across a boundary. Unknown actions fail closed (`T3430`).

Hygiene: every function is `security definer` + `set search_path = ''`; schema, tables and functions are revoked from `public, anon, authenticated`; only `public.ratelimit_consume` is granted, to `service_role`. `src/lib/security/__tests__/rateLimitSql-test.ts` guards this statically, and `supabase/tests/ratelimit/01_ratelimit.test.sql` (pgTAP, not executed yet) checks it on a database.

## Client limits (`CLIENT_LIMITS`, `src/lib/security/clientLimits.ts`)

| What | Limit | Where |
|---|---|---|
| Send OTP | 1 per email per 60 s (= `RESEND_COOLDOWN_MS` = Supabase per-user window); a failed non-429 send frees it | `services/auth.ts` `requestEmailCode` |
| Verify OTP | 5 per email, then 1 per 12 s | `services/auth.ts` `verifyEmailCode` |
| Profile / address / location writes | 3, then 1 per 10 s (under the server's 10 / min) | `services/profile.ts` |
| Photon search + reverse geocode | 20, then 1 per 500 ms (above debounced typing) | `services/places.ts` |
| In-flight de-dupe | identical concurrent calls share one request | auth send / verify, profile writes, `placeOrder` (by checkout fingerprint), `cancelOrder` |

Discovery search runs locally over the cached catalog (no request per keystroke), so it has no limiter.

## Error contract

`ratelimit.check()` raises `sqlstate 'PGRST'`, which PostgREST 12+ turns into HTTP 429 with `Retry-After: <s>` and body `{"code":"T3429","message":"RATE_LIMITED","details":"{\"action\":\"order.place\",\"retry_after\":42}","hint":"Too many requests"}`. On PostgREST < 12 it arrives as HTTP 400 with code `PGRST` and that JSON as the message.

Client mapping (`src/lib/security/rateLimitError.ts` `isRateLimitPayload`): status 429, code `T3429` / `PT429`, message `RATE_LIMITED` (or a JSON message containing it), or the Auth codes `over_email_send_rate_limit` / `over_request_rate_limit`. Results:

- Auth and profile calls throw `RateLimitedError`; sign-in, verify-code, complete-profile and complete-address show `RATE_LIMIT_MESSAGE` ("Too many attempts. Please wait a minute and try again.").
- `mapBackendError` returns `BackendError("RATE_LIMITED")`; `friendlyOrderMessage("RATE_LIMITED")` returns the same copy. It is not a business code, so checkout keeps its idempotency key, the fallback runner never mocks it, and queries never retry it.

## Retry safety

Rule: never retry a non-idempotent write automatically unless it carries an idempotency key. supabase-js itself only retries GET/HEAD on 503/520/network errors, never POST/PATCH.

| Call | Automatic retry | Why it is safe / why not |
|---|---|---|
| Queries (catalog, stores, orders list/detail, quote) | React Query, NETWORK errors only, 3 attempts, jittered backoff | Reads |
| Photon `searchPlaces` / `reverseGeocode` | 429 / 503 only, 3 attempts, honours Retry-After (max 10 s) | GET |
| Profile `completeProfile` / `saveAddress` / `saveCurrentLocation` | NETWORK / 503 only, 3 attempts | Set-to-value PATCH of the user's own row; repeating it writes the same values |
| `pushCart` | One re-push after RATE_LIMITED (wait = Retry-After clamped to 5-60 s) | Whole-state last-write-wins upsert |
| `placeOrder` | None (mutation `retry: false`) | Non-idempotent; a user retry reuses the stored idempotency key, so the server returns the original order |
| `cancelOrder` | None | Guarded by `p_expected_version`, still never automatic |
| `requestEmailCode` | None | Every call sends an email |
| `verifyEmailCode` | None | Single-use code |

## Edge Function reuse (future, owned by the notification workflow)

- `src/lib/security/rateLimit.ts`, `tokenBucket.ts` and `backoff.ts` have no React Native imports and only relative imports; copy them into `supabase/functions/_shared/`.
- In-isolate buckets are not authoritative (isolates are short-lived and parallel). For authority, call `select public.ratelimit_consume('<subject>', '<action>')` with the secret key before doing the work; respond 429 with `Retry-After` when `allowed` is false. Add a row to `ratelimit.limits` for each new action. Never call it from the app.

## Integration for owners (not applied here)

- `supabase/migrations/0007_order_functions.sql` (ship as a NEW migration that runs after 0009, otherwise `place_order` fails with 42883):
  - `place_order`, after the replay block `if found then return public.t3_order_result(v_existing, true); end if;` (three lines in 0007) add `perform ratelimit.check('order.place');` (replays stay free).
  - `cancel_order`, after the `INVALID_INPUT` check add `perform ratelimit.check('order.cancel');`.
  - `quote_delivery` is STABLE (read-only under PostgREST): no DB limit unless made VOLATILE; not recommended now.
- `src/app/checkout.tsx`: nothing needed. It already shows `friendlyOrderMessage(code)` (now the rate-limit copy for `RATE_LIMITED`) and guards with `isPending`.
- Orders tab / cancel UI (`src/app/(tabs)/orders.tsx`, `src/components/orders/**`): when calling `cancelOrder`, show `friendlyOrderMessage(err.code)`; never auto-retry.
- Notifications (`src/shared/notifications/**`, future `supabase/functions/**`): see "Edge Function reuse"; messaging RPCs add `perform ratelimit.check('<action>')` plus a limits row.

Exact snippets: `.agents/tasks/security-hardening/integration-snippets.md`.

## Migration numbering

Existing migrations: 0001-0007, `0008_catalog_seed.sql` (generated), and this `0009_rate_limits.sql`. The notification design (`.agents/tasks/notifications/design.md`, `Docs/notifications-design.md`) still plans `0004_messaging.sql`, `0005_messaging_policy_seed.sql`, `0006_messaging_schedules.sql`; those collide and must be renumbered (e.g. 0010-0012), including the generator path in ADR-0004's `generatedArtifacts-test.ts`.
