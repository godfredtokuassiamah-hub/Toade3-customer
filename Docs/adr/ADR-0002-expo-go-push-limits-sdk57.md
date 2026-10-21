# ADR-0002: Push in Expo Go on SDK 57, and graceful degradation

Status: Proposed (Phase A, 20 Oct 2026; revised 21 Oct 2026 for design review). Spec §12, §14, §18 [R2, R4]. Device under test: iPhone 13, iOS 27.3, App Store Expo Go (SDK 57).

## Findings (Expo docs, read 20 Oct 2026)

| Source | Statement |
| --- | --- |
| `docs.expo.dev/versions/v57.0.0/sdk/notifications` | "Push notifications (remote notifications) functionality provided by `expo-notifications` is unavailable in Expo Go on Android from SDK 53. A development build is required to use push notifications. Local notifications (in-app notifications) remain available in Expo Go." |
| `docs.expo.dev/push-notifications/what-you-need-to-know` | "You must use a development build to use push notifications since the capability is not built into Expo Go." |
| `docs.expo.dev/push-notifications/faq` | "In SDK 53 and later, Expo Go does not support push notifications functionality, so to test push you should use a development build." |
| `docs.expo.dev/push-notifications/receiving-notifications` | "In SDK 57 and earlier, a foreground notification is not shown at all by default." `setNotificationHandler` opts in. A handler that doesn't answer within 3 s drops the notification. |
| v57 notifications API | `getExpoPushTokenAsync({ projectId })`, with projectId from `Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId`. `addPushTokenListener`. `addNotificationReceivedListener`. `addNotificationResponseReceivedListener`. `getLastNotificationResponse()` (sync) and `clearLastNotificationResponse()`. `setNotificationChannelAsync`. `getPermissionsAsync` / `requestPermissionsAsync`. `setBadgeCountAsync`. `dismissAllNotificationsAsync`. |
| v57 Android permissions | "On Android 13… This prompt will not appear until at least one notification channel is created. The `setNotificationChannelAsync` must be called before `getDevicePushTokenAsync` or `getExpoPushTokenAsync`." |
| v57 config plugin | Plugin options `icon`, `color`, `defaultChannel`, `sounds`, `enableBackgroundRemoteNotifications`. They apply only to builds (EAS or `npx expo run:*`), not Expo Go. The iOS APNs entitlement is set by the plugin. |
| `bundledNativeModules.json` (SDK 57) | `expo-notifications ~57.0.23`, `react-native-svg 15.15.4`. Both are native modules bundled in Expo Go. |
| `sdk/constants` v57 + `node_modules/expo-constants/build/Constants.types.d.ts` | `Constants.executionEnvironment` is one of `bare`, `standalone`, `storeClient`, and `StoreClient` is documented as "Expo Go or a development build built with `expo-dev-client`". It therefore cannot tell Expo Go from a dev build. |
| `node_modules/expo/build/Expo.d.ts` (SDK 57) | The `expo` package exports `isRunningInExpoGo()` (from `./environment/ExpoGo`), which is true only inside Expo Go. |

## Decision

1. Remote push is treated as unavailable in Expo Go on BOTH iOS and Android. The user's iPhone 13 Expo Go session exercises everything except OS push.
2. Push lives behind `platformAdapters/push.ts` with capability states:
   - `unavailable_expo_go`: `isRunningInExpoGo()` from `expo` (NOT `executionEnvironment === "storeClient"`, which would also disable push in expo-dev-client builds)
   - `unavailable_web`: `Platform.OS === "web"`
   - `missing_project_id`: no EAS projectId
   - `available`
   `expo-notifications` is loaded with a lazy `require()` only in the `available` state, so Expo Go never evaluates the module and never logs SDK 53+ push warnings.
3. In Expo Go, Realtime private Broadcast plus inbox and order reconciliation provide all foreground behaviour. The OS-push path is a dev-build feature.
4. Install `expo-notifications` with `npx expo install`, and add the plugin to `app.json` (the only allowed app.json change):
   ```json
   ["expo-notifications", { "color": "#FCB501", "defaultChannel": "order_updates" }]
   ```
   No custom icon or sounds yet: a 96×96 white Android notification icon is a release asset (R-7). `enableBackgroundRemoteNotifications` stays false because no headless task is used.
5. Foreground handler (dev or release build): `shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false`. The coordinator owns presentation. The handler resolves synchronously to stay within the 3 s budget.
6. Android channels (`order_updates` HIGH, `support` DEFAULT, `account_security` HIGH, `offers` LOW) are created before any token fetch. The server sets `channelId` from the preference category.
7. Registration is change-based: the app calls the devices endpoint only when there is no stored installation, the token hash changed, the permission status changed, the signed-in user changed, or the last success is older than 24 h. Resumes re-check locally only, so the server's 20/h limit never blocks a real token rotation.
8. Permission: never at launch. The education sheet offers "Turn on" → `requestPermissionsAsync()` once. If permanently denied, show "Open Settings" (`Linking.openSettings()`). In Expo Go the sheet says: "Notifications need the installed Toade3 app. You'll still see updates here while the app is open."

## Consequences

- Push verification needs an EAS development build (`npx eas-cli@latest build --profile development`), APNs key and FCM v1 credentials, and `eas init` for `projectId` (release dependencies R-5, R-6).
- Expo Go testing covers capsule, banner, inbox, preferences (push group shown as unavailable), the synthetic order source, and Realtime (with a real Supabase session and migrations applied).
- Cold-start tap routing is designed and unit-tested against the adapter interface. Proving it on a device needs a dev build.
- No Expo Go-specific code paths exist beyond the capability check. A dev build uses the same provider.
