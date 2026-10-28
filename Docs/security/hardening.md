# Reverse-engineering resistance: design and honest limits

Scope: the Toade3 Customer Expo app (SDK 58, RN 0.88, Hermes). Companion docs: [server-audit.md](./server-audit.md) (the main control) and [rate-limiting.md](./rate-limiting.md).

## 1. Threat model

Anyone can install the app, unpack the IPA/APK, decompile the Hermes bytecode, read every `EXPO_PUBLIC_*` value, and call Supabase directly with the publishable key plus their own user JWT. A modified client or a script ignores every client-side check. Nothing here makes the app impossible to reverse; it keeps secrets out of the binary, keeps enforcement on the server, and raises the cost of reading and tampering with the client.

| Layer | Protects | Does NOT protect |
|---|---|---|
| RLS + grants + SECURITY DEFINER hygiene ([server-audit.md](./server-audit.md)) | The data. The main control: the publishable key is safe only because of RLS/grants | Logic that exists only on the client |
| No secrets in the client (section 2) | Privileged keys never ship | `EXPO_PUBLIC_*` values, which are public by definition |
| Hermes bytecode, minification, console stripping, `__DEV__` dead-code removal, no published source maps (section 3) | Raises the cost of reading logic and strings; removes dev paths and log output | A determined reverser: bytecode decompiles and string literals remain |
| App config: no Android backup, no cleartext, ATS on, fewer permissions (section 4) | Device-backup extraction, HTTP downgrade, unneeded attack surface | The owner of a rooted/jailbroken device |
| Screen-capture blocking on OTP entry (5d, implemented) | Casual screenshots / recordings / app-switcher previews of the OTP screen | A second camera; a rooted device |
| App Attest / Play Integrity (5a, designed) | Lets the server reject modified apps and scripts on sensitive actions | Nothing until a dev build and server verification exist; Expo Go |
| TLS pinning (5b, not adopted) | MITM through a user-installed CA | Rooted devices (pinning is hookable); costs outage risk |
| Jailbreak/root detection (5c, designed) | A risk signal | Easily bypassed; never the only control |

## 2. Secrets: no secrets in the client, ever

Rule:
- Every `EXPO_PUBLIC_*` variable is inlined into the JS bundle as plain text ([Expo env vars](https://docs.expo.dev/guides/environment-variables/)). Treat each one as public.
- Never put a `service_role` / `sb_secret_…` key, database password, S3 access key, or third-party private API key in `.env`, `app.json`, `eas.json` `env`, or source.
- Privileged work runs server-side: Edge Functions with the secret key in Supabase secrets, or SECURITY DEFINER SQL guarded by `auth.uid()`.
- Never set `EXPO_PUBLIC_DEV_LOGIN_*` in EAS environments. They are `__DEV__`-gated, but keep them local only.

Audit result (names only, values never printed):
- `.env.example`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_PLACES_BASE_URL`, `EXPO_PUBLIC_DEV_LOGIN_EMAIL`, `EXPO_PUBLIC_DEV_LOGIN_CODE`. It mentions `service_role` only in a warning comment.
- `.env`: the same names minus `EXPO_PUBLIC_PLACES_BASE_URL`.
- `src/` reads only those five, plus `T3_WRITE_SEED` in a test.
- No `service_role`, `sb_secret_`, private key markers, JWTs or other tokens in `src/`, `app.json` or `assets/`. Two SVG logos match a loose pattern inside base64 image data (false positives).
- `supabase/SETUP.md` documents the S3 endpoint, not its keys.

## 3. JS bundle hardening

| Item | Status | Evidence |
|---|---|---|
| Hermes bytecode | On. Hermes is Expo's default engine and no `jsEngine` override exists (`npx expo config --type introspect`). `npx expo export` emits `.hbc` bundles | [Using Hermes](https://docs.expo.dev/guides/using-hermes/) |
| Minification | On for production exports / EAS builds (terser via Metro, the default) | [Minify](https://docs.expo.dev/guides/minify/) |
| Console stripping | `metro.config.js` merges `compress.drop_console: ["log", "info", "debug", "trace"]` into Expo's default `minifierConfig`. Production only (dev bundles aren't minified). Keeps `console.warn` / `console.error`, which log no PII (`chunkedStorage` logs key names only) | Same page, "Remove console logs" |
| `__DEV__` dead code | `if (__DEV__)` branches are constant-folded and removed in production | [Tree shaking](https://docs.expo.dev/guides/tree-shaking/) |
| Source maps | Not emitted: `npx expo export` defaults `--source-maps` to false; `eas.json` sets `uploadSourceMaps: false` (also the default). There is no error-monitoring service, so maps are uploaded nowhere. `dist/` is gitignored | `npx expo export --help`, [eas.json](https://docs.expo.dev/eas/json/) |

Dev-only paths (all `__DEV__`-gated at build time, none controlled by a remote flag; `BACKEND_MODE` is a `const` in `src/lib/backend/config.ts`):
- `src/lib/auth/devLogin.ts`: env values read only under `__DEV__`; `startDevSession` returns immediately in release, so the dev profile literals are dead code.
- `src/app/location-picker.tsx`: DEV seed recents.
- `src/app/order/[id].tsx`: "Mock order (dev)" label.
- `src/components/navigation/useTabBarSurface.ts`: one-time surface log.
- `src/services/cartSync.ts`: skip log.
- `src/lib/backend/fallback.ts`: write / network mock fallback and its logs; `mockPlaceOrder` in `src/services/orders.ts` throws in production. Note: read fallback to bundled mock data when the backend tables are missing is intentional in production too (catalog is public data).

JS obfuscator: not adopted. Hermes already ships bytecode, so source-level obfuscation buys little against Hermes decompilers. Metro/Expo docs don't support an obfuscation transform, and a transform after Babel can break Reanimated/worklets serialization and React Compiler output. It also adds bundle size and startup cost. Revisit only if a specific asset needs it.

Android R8 (`expo-build-properties` `android.enableMinifyInReleaseBuilds`): not enabled. It shrinks and renames Java/Kotlin code, but can break reflection-based native modules and can't be verified without a native build. Try it in a preview build first (release gate).

## 4. App config (all verified with `npx expo config --type introspect`)

| Key | Value | Effect | Docs |
|---|---|---|---|
| `android.allowBackup` | `false` | No Google Drive backup / restore of app data (AsyncStorage cart, addresses, idempotency key). SecureStore was already excluded by its plugin | [app config](https://docs.expo.dev/versions/v58.0.0/config/app/) |
| `android.blockedPermissions` | `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` | Removes unused template permissions (`tools:node="remove"`). Kept: `INTERNET`, `VIBRATE` (expo-haptics), coarse/fine location (expo-location). Not applied in Expo Go | same |
| `expo-build-properties` `android.usesCleartextTraffic` | `false` | No plain HTTP. Android 9+ already defaults to false; Android 8 and below default to true, so setting it explicitly covers any older device the SDK's minSdk still allows | [build-properties](https://docs.expo.dev/versions/v58.0.0/sdk/build-properties/) |
| `ios.infoPlist.NSAppTransportSecurity` | `NSAllowsArbitraryLoads: false`, `NSAllowsLocalNetworking: true` | Replaces the template's `NSAllowsArbitraryLoads: true`; all endpoints are HTTPS (Supabase, Photon). Local networking keeps a dev build able to reach Metro | same (`ios.infoPlist`) |
| `eas.json` | development (dev client, internal), preview (internal, APK, release), production (store, release, `autoIncrement`); `uploadSourceMaps: false` | Release builds are not debuggable: preview/production use the Release configuration (`:app:assembleRelease` / `bundleRelease`, Xcode Release) | [eas.json](https://docs.expo.dev/eas/json/) |

Not changed: `ios.bundleIdentifier` / `android.package` (still placeholders; choosing them is a product decision and a release gate). Expo Go ignores all of the above: it uses its own native shell.

## 5. Native protections

Gating rule for every native feature (`src/lib/security/capabilities.ts`): use it only when it is implemented, the app is not in Expo Go (`isExpoGo()`), and its module is installed. A missing module never throws; the feature reports `false`. `nativeProtections()` returns `{ screenCapture, appIntegrity: false, tlsPinning: false, rootDetection: false }` today.

### 5a. App integrity: iOS App Attest / Android Play Integrity (designed, dev-build only)

Library: [`@expo/app-integrity`](https://docs.expo.dev/versions/v58.0.0/sdk/app-integrity/) (first-party, alpha). Inside Expo Go it would attest Expo Go, not this app, so it's dev/release-build only. Needs a real bundle id / package, the App Attest capability, and a Google Cloud project linked in Play Console.

Flow:
1. Client asks an Edge Function `integrity-challenge` for a one-time challenge (>= 16 random bytes, stored with user id + 5 min expiry).
2. iOS: `isSupported` -> `generateKeyAsync()` (store `keyId` in SecureStore) -> `attestKeyAsync(keyId, challenge)` -> send `{keyId, attestation}` to `integrity-attest`. The server verifies the attestation against Apple's App Attest root CA, checks the app id (team id + bundle id), counter and challenge, and stores the public key per user/device.
3. Sensitive calls (first: `order.place`) send `generateAssertionAsync(keyId, JSON.stringify({ request, challenge }))`; the server verifies the signature with the stored key and a fresh challenge, and checks the counter grows.
4. Android: `prepareIntegrityTokenProviderAsync(cloudProjectNumber)` once, then `requestIntegrityCheckAsync(requestHash)` where `requestHash` = SHA-256 of the request + challenge. The server decodes the token through Google's Play Integrity API and checks `appRecognitionVerdict = PLAY_RECOGNIZED`, the package name, certificate digest, `requestHash`, and the device verdict.
5. Enforcement lives in the Edge Function that fronts `place_order` (owned by the notification/orders work). Roll out in report-only mode (log verdicts), then enforce. Keep a server-side kill switch. Failed or unsupported devices get a step-up (e.g. CAPTCHA), not a hard block.

Does not stop: a real device running the genuine app driven by automation; a determined attacker with a compromised device. It raises the cost of scripts and repackaged apps.

### 5b. TLS certificate / public-key pinning (not adopted)

Would need a native module (dev build). Pinning `*.supabase.co` means pinning Supabase's / Cloudflare's certificate chain, which rotates outside your control: a rotation without a matching app update bricks every installed app, and there's no remote kill switch without a non-pinned channel. If adopted later: use a custom domain you control, pin SPKI hashes of the intermediate CA plus at least one backup key, ship pins with an expiry, and test rotation. It does not help on a rooted device (pinning can be hooked off).

### 5c. Jailbreak / root detection (designed, soft signal)

Dev-build-only native module. Feed the result into risk scoring alongside the attestation verdicts (e.g. require step-up for orders). Never block on it alone: it's easily bypassed and has false positives.

### 5d. Screen-capture protection (implemented on OTP entry)

[`expo-screen-capture`](https://docs.expo.dev/versions/v58.0.0/sdk/screen-capture/) is included in Expo Go. `useSensitiveScreen()` (`src/lib/security/useSensitiveScreen.ts`) calls `usePreventScreenCapture("toade3-sensitive")` while the screen is mounted; it's a no-op on web. Used in `src/app/verify-code.tsx`. Checkout (`src/app/checkout.tsx`) is owned by other work: see `.agents/tasks/security-hardening/integration-snippets.md`.

Effect: Android sets `FLAG_SECURE` (screenshots and recordings show black; recent-apps preview is blank). iOS 13+ blocks screenshots and recordings. Users notice that screenshots of these screens don't work. It doesn't stop a second camera.

### 5e. Secure storage review

- Supabase session (access + refresh token): SecureStore (Keychain / Keystore) through `chunkedStorage`; values are never logged.
- AsyncStorage (plain text): cart, active + recent delivery addresses (location data, low sensitivity), favourites, recent searches, the persisted public catalog/store query cache (`isPersistable` excludes private queries), and the checkout idempotency key. No tokens or secrets. Android backup is now off.
- iOS Keychain items survive an uninstall. Follow-up: on the first launch after a reinstall (no AsyncStorage marker), sign out to clear a stale session.

## 6. Logging

Grep of `src/` for `console.*`: no call logs a session, token, user object, email or phone. `chunkedStorage` warns with key names only. `fallback` / `cartSync` / `useTabBarSurface` logs are `__DEV__`-gated, and `console.log/info/debug/trace` are stripped from production bundles. The only ungated `console.log` is in `mockPlaceOrder`, which throws first in production.
