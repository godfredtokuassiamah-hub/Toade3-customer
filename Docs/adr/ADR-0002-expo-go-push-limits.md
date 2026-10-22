# ADR-0002: Push notifications in Expo Go (SDK 57) and the degrade strategy

Status: Proposed (Phase A). Date: 2026. Context: AGENTS.md ("do not trust training data; verify against docs"), the workflow brief (the user tests on an iPhone 13, iOS 27.3, in Expo Go), `Docs/notifications-design.md` §7.

## Context

The user runs the app in Expo Go on a physical iPhone 13. The engine needs OS push for background/closed-app milestones, but the whole in-app experience (capsule, banner, inbox, Realtime, preferences) must work in Expo Go so the user can see and test it now, with push ready to switch on in a development build later.

## What `expo-notifications` can and cannot do in Expo Go, SDK 57

Verified against `https://docs.expo.dev/versions/v57.0.0/sdk/notifications.md`, the push-notifications setup/overview/what-you-need-to-know/FAQ pages, and the Expo llms.txt misconceptions list (all fetched this phase):

- **Remote (push) notifications are unavailable in Expo Go.** The SDK 57 Notifications page states push is "unavailable in Expo Go on Android from SDK 53; a development build is required." The push-setup and FAQ pages generalise this: "You must use a development build to use push notifications since the capability is not built into Expo Go" and "In SDK 53 and later, Expo Go does not support push notifications functionality." This applies to **both iOS and Android** in SDK 53+ (SDK ≤52 used Expo's shared credentials in Expo Go; that path is gone). So `getExpoPushTokenAsync` / `getDevicePushTokenAsync` and real remote delivery do **not** work in Expo Go on the iPhone 13.
- **Local (in-app) notifications remain available in Expo Go** (same page), but the engine does not rely on local notifications for its custom presentation — the coordinator renders the in-app capsule/banner itself.
- `projectId` must be read from `Constants.expoConfig.extra.eas.projectId` (set after `eas init`); it does not exist yet (release dependency).
- Execution environment can be detected with `Constants.executionEnvironment === "storeClient"` (Expo Go) vs `standalone`/`bare` (dev/release build), and `Device.isDevice` (push needs a physical device or a supported simulator). Both `expo-constants` and `expo-device` are already installed.
- Android 13+ needs a notification channel created **before** the permission prompt / token fetch (`setNotificationChannelAsync` before `getExpoPushTokenAsync`).

## Decision

Design the client so **everything except OS push works in Expo Go**, and push registration degrades gracefully and is ready for a dev build:

- `pushAdapter.getPushAvailability()` returns `unavailable` when `executionEnvironment === "storeClient"` or `!Device.isDevice`; otherwise `available`.
- `expo-notifications` is **lazily imported** (dynamic `import()`), never at module scope, so importing it cannot error or add weight in Expo Go.
- When `unavailable`: no token fetch, no permission prompt; the Realtime hint channel, inbox, capsule, banner and preferences all run normally; the preferences screen shows "Push needs the Toade3 app from the store" and offers no OS prompt (FR-43).
- When `available` (dev/release build): create Android channels first, request permission at a meaningful point (not launch, FR-37), fetch the Expo push token with the `projectId`, register via `POST /devices`, handle rotation via `addPushTokenListener`, detach on sign-out. `setNotificationHandler` suppresses the OS foreground banner for the customer app (the coordinator owns foreground presentation).
- Response listeners + `getLastNotificationResponse()` are still registered (they are harmless no-ops in Expo Go) so the same cold-start tap path works once push is enabled.

## Consequences

- The user can fully exercise the engine today in Expo Go via the synthetic order source; the absence of OS push is expected, not a bug.
- Real push is a **release dependency**: an EAS development build, `eas init` (projectId), an APNs push key (iOS) and FCM credentials (Android). The `app.json` `expo-notifications` plugin + `extra.eas.projectId` are added in Phase D and reported.
- No new client dependency is unavailable in Expo Go: `react-native-svg` is Expo-Go-included; `expo-notifications` is present but its remote path is simply not used in Expo Go. All installed with `npx expo install` (NFR-3).
