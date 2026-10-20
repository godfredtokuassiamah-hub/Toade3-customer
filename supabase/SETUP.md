# Supabase setup (project `mcnezedqjyqgbimxrdcz`)

Do these once in the Supabase dashboard before testing real sign-in. Dashboard labels are from the Supabase docs as of this change; they move occasionally.

1. Run the migration
   - SQL Editor > New query > paste `supabase/migrations/0001_profiles.sql` > Run.
   - Run order: `0001_profiles.sql`, then `0002_storage.sql`, then `0003_profile_address.sql` (each in its own query).
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

6. App env
   - `.env` holds `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (gitignored; `.env.example` is the template). After editing it, stop and rerun `npx expo start`.
   - The app now uses `expo-secure-store` (native). It's in Expo Go; a development build needs a rebuild because the `expo-secure-store` config plugin was added to `app.json`.

7. Smoke test
   - New email > code arrives (6 digits) > verify > lands on "Tell us about you" > submit name + phone > Home shows your first name.
   - Table Editor > `profiles`: the row has `full_name`, `phone` (E.164), `country_code`, `role = customer`.
   - Kill and relaunch: splash goes straight to Home.
   - There's no sign-out yet: to retest the new-user path, use another email, or delete the user in Authentication > Users (cascades the profile) and clear app data / reinstall.

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
