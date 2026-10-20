// Configured Supabase client (Expo "Using Supabase" guide, SDK 57).
//
// Storage: native sessions go to expo-secure-store (Keychain / Keystore)
// through a chunking adapter, because a session JSON is often 2-4KB and
// SecureStore can reject values over ~2048 bytes. The Expo guide's default
// (expo-sqlite localStorage) and AsyncStorage are plain-text, and the
// architecture blueprint wants tokens in secure storage. Web isn't a target;
// it uses supabase-js's default (window.localStorage).
//
// No react-native-url-polyfill: Expo installs a URL global already.
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";

import { createChunkedStorage } from "./auth/chunkedStorage";

// Direct dot access only: Expo inlines EXPO_PUBLIC_* at build time and does
// not support destructuring or dynamic keys.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env and restart Expo.",
  );
}

const storage =
  Platform.OS === "web"
    ? undefined // supabase-js default
    : createChunkedStorage({
        getItem: (key) => SecureStore.getItemAsync(key),
        setItem: (key, value) => SecureStore.setItemAsync(key, value),
        removeItem: (key) => SecureStore.deleteItemAsync(key),
      });

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    // No URL to read a session from on Android/iOS.
    detectSessionInUrl: false,
  },
});

// Run the token refresh loop only while the app is in the foreground.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
