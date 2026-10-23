# Supabase setup (project `mcnezedqjyqgbimxrdcz`)

Do these once in the Supabase dashboard before testing real sign-in. Dashboard labels are from the Supabase docs as of this change; they move occasionally.

1. Run the migration
   - SQL Editor > New query > paste `supabase/migrations/0001_profiles.sql` > Run.
   - Run order: `0001_profiles.sql`, then `0002_storage.sql`, then `0003_profile_address.sql`, then `0004_catalog.sql` … `0008_catalog_seed.sql` (each in its own query; see "Stores, catalog, cart and orders" below).
   - Table Editor > `profiles`: confirm "RLS enabled" and 3 policies (select/insert/update own). Database > Triggers: `on_auth_user_created` on `auth.users`.
   - Re-running is safe (idempotent).

2. Enable Email sign-in
   - Authentication > Sign In / Providers > Email: enabled.
   - "Allow new users to sign up" (Authentication > Sign In / Providers, user signups): on. The app calls `signInWithOtp({ shouldCreateUser: true })`.

3. Send a 6-digit code instead of a link
   `signInWithOtp` sends the **Magic Link** template to existing users and the **Confirm signup** template to brand-new users. Both must contain `{{ .Token }}`.
   - Authentication > Emails > Templates > Magic Link, and > Confirm signup. Example body:
     ```html
     <h2>Your Toade3 code</h2>
     <p>Enter this code in the app to sign in:</p>
     <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
     <p>It expires in 10 minutes. If you didn't ask for it, ignore this email.</p>
     ```
   - Remove `{{ .ConfirmationURL }}` so nobody taps a link the app can't handle.

4. OTP length and expiry
   - Authentication > Sign In / Providers > Email: Email OTP length = **6** (must match `OTP_LENGTH` in `src/lib/auth/otp.ts`); Email OTP expiration e.g. 600 seconds.

5. Rate limits and SMTP
   - Default limit: one code per address every 60s (matches the app's resend cooldown). Authentication > Rate Limits holds the rest.
   - The built-in SMTP sends only a few emails per hour and only to team addresses on some plans. Configure custom SMTP (Authentication > Emails > SMTP Settings) before real users.
   - Values to set, CAPTCHA and the database limiter: see "Rate limits" and "Rate limiting migration (0009)" at the end of this file.

6. App env
   - `.env` holds `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (gitignored; `.env.example` is the template). After editing it, stop and rerun `npx expo start`.
   - The app now uses `expo-secure-store` (native). It's in Expo Go; a development build needs a rebuild because the `expo-secure-store` config plugin was added to `app.json`.

7. Smoke test
   - New email > code arrives (6 digits) > verify > lands on "Tell us about you" > submit name + phone > Home shows your first name.
   - Table Editor > `profiles`: the row has `full_name`, `phone` (E.164), `country_code`, `role = customer`.
   - Kill and relaunch: splash goes straight to Home.
   - There's no sign-out yet: to retest the new-user path, use another email, or delete the user in Authentication > Users (cascades the profile) and clear app data / reinstall.

## Stores, catalog, cart and orders (migrations 0004-0008)

None of this has been executed yet (written without admin access). Until it
is, the app runs on local mock data automatically (`BACKEND_MODE = 'auto'` in
`src/lib/backend/config.ts`).

Run order (SQL Editor, each file in its own query, after 0001-0003):

1. `0004_catalog.sql` — `vendors` (catalog vendors + Stores-tab directory
   rows), `categories`, `products`, `product_categories`, `option_groups`,
   `options`; enables `pg_trgm` in the `extensions` schema; public read of
   published rows only; no client writes.
2. `0005_cart_drafts.sql` — one server cart per customer, RLS own row.
3. `0006_orders.sql` — `order_status` enum, `orders`, `order_items`;
   customers read their own rows only; no client writes.
4. `0007_order_functions.sql` — `quote_delivery`, `place_order`,
   `cancel_order` (security definer, `search_path = ''`, EXECUTE for
   `authenticated` only) + internal `t3_*` helpers (no client EXECUTE).
5. `0008_catalog_seed.sql` — GENERATED from `src/data/mock/*.ts` by
   `node scripts/generate-catalog-seed.js` (re-run it, then re-run this file,
   whenever the mock catalog changes; `seed-drift-test.ts` catches drift).

All five are re-runnable. Then, once verified, set `BACKEND_MODE = 'remote'`
if you want errors to surface instead of falling back.

Edge Functions: none to deploy. The RPCs cover quote, placement and
cancellation in one transaction each, so there is nothing extra to deploy or
keep in sync. A thin `place-order` Edge Function (rate limiting, payment
hooks) can wrap `public.place_order` later.

### Verify RLS and the functions (run after 0008)

Use the SQL Editor's role switcher ("Run as": anon / an authenticated user)
or `set local role ...; set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';`
inside `begin; ... rollback;`. Expected results:

```sql
-- anon: catalog yes, unpublished no, private tables no
select count(*) from public.products;                        -- > 0
select count(*) from public.products where not published;    -- 0 (zz-draft-item hidden)
select count(*) from public.orders;                          -- permission denied
select count(*) from public.cart_drafts;                     -- permission denied
select public.place_order(gen_random_uuid(), 'v-campus-grill', '[]', 5.6, -0.18, 'x', null, 0);
                                                             -- permission denied for function
-- authenticated user A: no client writes
insert into public.orders (customer_id, vendor_id, items_total_minor, delivery_fee_minor,
  service_fee_minor, total_minor, distance_km, dropoff_label, dropoff_lat, dropoff_lng,
  idempotency_key) values (auth.uid(), (select id from public.vendors limit 1), 0, 0, 0, 0, 0, 'x', 0, 0,
  gen_random_uuid());                                        -- permission denied
update public.products set price_minor = 1;                  -- permission denied
update public.orders set status = 'delivered';               -- permission denied
-- place twice with the SAME key -> same order_id, second has "replayed": true
select public.place_order('00000000-0000-4000-8000-000000000001', 'v-campus-grill',
  '[{"product_id":"lm-grilled-chicken-wedges","option_ids":["protein-chicken"],"qty":1}]',
  5.608, -0.185, 'Test', null, 0);
-- server pricing: total_minor = items + delivery + 300 service, from the DB prices
-- missing required option -> REQUIRED_OPTION_MISSING (T3004); far drop-off (e.g. 5.7, -0.1)
-- -> OUT_OF_RADIUS (T3006); another vendor's product -> MIXED_VENDORS (T3005)
select public.cancel_order('<order id>', 1);                 -- ok, version 2
select public.cancel_order('<order id>', 1);                 -- STALE_VERSION (T3008)
-- authenticated user B
select count(*) from public.orders where customer_id = '<user A uuid>';      -- 0
select count(*) from public.order_items;                                     -- only B's
select count(*) from public.cart_drafts where customer_id = '<user A uuid>'; -- 0
select public.cancel_order('<A order id>', 1);               -- ORDER_NOT_FOUND (T3012)
```

The app only ships the publishable key (`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`);
never put the service_role key or S3 keys in the app or `.env`.

## Profile address + location (migration 0003)

Run `supabase/migrations/0003_profile_address.sql` in the SQL Editor after
0001 and 0002. It adds nullable columns to `profiles`:

- Delivery address: `address_label`, `address_full`, `address_details`,
  `address_lat`, `address_lng`, `address_place_id`.
- Last device location: `location_lat`, `location_lng`, `location_label`,
  `location_updated_at`.

Clients can write only these columns (additive column grants); RLS policies
and the role guard are unchanged. Re-running is safe. A profile now counts as
complete only with name + phone + `address_label`, so existing users without
an address see the address step on their next launch.

## Image storage (migration 0002)

Run `supabase/migrations/0002_storage.sql` in the SQL Editor after 0001. It
creates two buckets and their RLS policies:

- `food-images` — public read, menu photos. The app reads these by public
  URL. No client writes; vendor/admin uploads happen server-side later.
- `avatars` — private. A signed-in user can read/write only their own folder,
  `avatars/<their user id>/...`, enforced by RLS.

The app shows **local bundled images today** (`src/data/mock/foodImages.ts`).
`src/services/foodImageSource.ts` has a `USE_REMOTE_IMAGES` flag (false now);
flip it to serve food photos from the `food-images` bucket once the catalog
API provides each item's storage path.

### Server-side S3 access (NEVER put this in the app)

The project also exposes an S3-compatible endpoint:

- Endpoint: `https://mcnezedqjyqgbimxrdcz.storage.supabase.co/storage/v1/s3`
- Region: `eu-central-1`

Its S3 access key id + secret grant broad storage access. Use them ONLY from
server-side tools / CI (bulk uploads, migrations). They must never appear in
the mobile app, `.env`, or any `EXPO_PUBLIC_` variable — those ship inside the
app bundle and are readable by anyone who installs it. The app uses the
Supabase Storage API with the user's session instead, governed by the RLS
policies above.

## Rate limits

The server is the only real protection: a modified app or a `curl` script skips every client-side check. The app's own throttles (resend cooldown, verify bucket, profile/places buckets, in-flight de-dupe) only cut accidental load.

### Supabase Auth (Authentication > Rate Limits)

Operation names follow the table in the Supabase rate-limits guide (https://supabase.com/docs/guides/auth/rate-limits); dashboard labels may differ slightly. Defaults checked against that page.

| Operation | Supabase default | Set to | Why |
|---|---|---|---|
| Emails sent by Supabase Auth (project) | 2 / hour with the built-in provider; adjustable only with custom SMTP | Expected volume, e.g. 30-100 / hour, after custom SMTP | Caps OTP email cost and abuse |
| Sign-ups and sign-ins (`/otp`, `/signup`, ... per IP) | 30 / 5 min, bursts of 30 | Keep the default | Campus / mobile NAT shares one IP; prefer CAPTCHA over lowering |
| Send OTPs or magic links (per user) | 60 s between requests | Keep 60 s | Must equal `RESEND_COOLDOWN_MS` in `src/lib/auth/otp.ts` |
| Verification requests (`/verify`, per IP) | 30 / 5 min, bursts of 30 | Keep the default | Limits OTP guessing |
| Token endpoint requests (`/token`, refresh, per IP) | 150 / 5 min, bursts of 30 | Keep the default | Session refresh floods |

Exceeding a limit returns HTTP 429; the app shows "Too many attempts. Please wait a minute and try again."

### Next steps (release gates)

- Custom SMTP (Authentication > Emails > SMTP Settings) before real users.
- CAPTCHA (hCaptcha or Cloudflare Turnstile; Authentication > Bot and Abuse Protection > Enable CAPTCHA protection). WARNING: once it's enabled, every sign-in must send a `captchaToken`. Enabling it before the app sends one breaks sign-in for everyone. Ship the app change first.

## Rate limiting migration (0009)

Run `supabase/migrations/0009_rate_limits.sql` in the SQL Editor after 0001-0008. Re-running is safe. It is written and statically reviewed only; test it on a branch / local stack first (`supabase test db` runs `supabase/tests/ratelimit/01_ratelimit.test.sql`).

It creates:

- A private schema `ratelimit` (no client USAGE; never add it to the Data API exposed schemas): `ratelimit.limits` (one row per action) and `ratelimit.counters` (fixed windows), both with RLS on and no policies.
- `ratelimit.check(action)`: counts one hit for the signed-in user and raises HTTP 429 when over the limit. Callable only from SECURITY DEFINER SQL (no client grant).
- AFTER INSERT OR UPDATE triggers on `public.profiles` (`profile.write`, 10 / min) and `public.cart_drafts` (`cart.write`, 60 / min). Calls without a user JWT (sign-up trigger, service jobs, SQL editor) are not limited.
- `public.ratelimit_consume(subject, action)`: for future Edge Functions, `service_role` only. Returns `{allowed, hits, max_hits, retry_after}` without raising.
- `ratelimit.prune()`: deletes expired windows. Optional schedule (enable Integrations > Cron first): `select cron.schedule('ratelimit-prune', '17 * * * *', $$select ratelimit.prune()$$);`

Limits (edit the `RATE_LIMITS_BEGIN/END` block and `SERVER_RATE_LIMITS` in `src/lib/security/rateLimit.ts` together; a test checks they match):

| action | max | window | enforced by |
|---|---|---|---|
| `order.place` | 5 | 60 s | `place_order` (needs the owner line below) |
| `order.cancel` | 10 | 60 s | `cancel_order` (needs the owner line below) |
| `profile.write` | 10 | 60 s | trigger on `profiles` |
| `cart.write` | 60 | 60 s | trigger on `cart_drafts` |

Errors: HTTP 429, header `Retry-After: <seconds>`, body `{"code":"T3429","message":"RATE_LIMITED","details":"{\"action\":...,\"retry_after\":n}"}`. This needs PostgREST 12+ (check the version in the dashboard, Settings > API / project infrastructure); on older versions the call still fails, as HTTP 400 with code `PGRST`, and the app still recognises it. `T3430` = unknown action (fails closed).

Limits of this layer: reads (GET, and STABLE RPCs like `quote_delivery`) run read-only and can't be counted; a call that fails later in the same transaction rolls its hit back; floods / DDoS are a platform concern.

Orders owner change (not applied by 0009; ship as a NEW migration that runs after 0009):

- `public.place_order`: after the replay block `if found then return public.t3_order_result(v_existing, true); end if;` (three lines in 0007) add `perform ratelimit.check('order.place');`
- `public.cancel_order`: after the `INVALID_INPUT` check add `perform ratelimit.check('order.cancel');`
