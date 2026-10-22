import { Manrope_400Regular } from "@expo-google-fonts/manrope/400Regular";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { DiscoveryContextSync } from "../components/discovery/DiscoveryContextSync";
import { FavouritesProvider } from "../lib/favourites/FavouritesContext";
import { DeliveryAddressProvider } from "../lib/location/DeliveryAddressContext";

// Hold the native splash until Manrope loads so no text paints in the system
// font first. Must run at module scope, not inside a component.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hide();
  }, [loaded, error]);

  // On a load error, render anyway (system font) instead of hanging on the splash.
  if (!loaded && !error) return null;

  // Hide the native header on every screen; screens render full-bleed.
  // Other routes auto-register.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <DeliveryAddressProvider>
      <FavouritesProvider>
      {/* New drop-off -> new discovery context revision. */}
      <DiscoveryContextSync />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Reached with dismissAll() + replace(), so it's the only route: no
            swipe-back on iOS, and Android hardware back follows the root
            default (leaves the app). No BackHandler / sign-out confirm. */}
        <Stack.Screen name="complete-profile" options={{ gestureEnabled: false }} />
        {/* Setup steps 2 and 3: same dismissAll() + replace() entry. */}
        <Stack.Screen name="complete-address" options={{ gestureEnabled: false }} />
        <Stack.Screen name="enable-location" options={{ gestureEnabled: false }} />
        {/* Full-screen map: UIModalPresentationFullScreen on iOS (no swipe
            dismiss; the screen's close button and Android back close it),
            falls back to "modal" on Android. */}
        <Stack.Screen name="location-picker" options={{ presentation: "fullScreenModal" }} />
        {/* Search sheet: transparentModal keeps Home rendered underneath so
            the sheet's BlurView (iOS) / white overlay (Android) sits over it.
            No native animation: the screen runs its own entrance/exit. */}
        <Stack.Screen
          name="search"
          options={{ presentation: "transparentModal", animation: "none" }}
        />
        <Stack.Screen name="search-results" />
        <Stack.Screen name="favourites" />
        <Stack.Screen name="stores-list" />
        {/* P12 Filters: bottom sheet. transparentModal keeps the opener
            (and the tab bar) rendered underneath, like Search; the sheet,
            its white-glass backdrop, drag-to-dismiss and Android back are
            all handled in-screen, so no native animation or gesture.
            Dismissal unmounts the screen, which discards the draft. */}
        <Stack.Screen
          name="filters"
          options={{ presentation: "transparentModal", animation: "none", gestureEnabled: false }}
        />

      </Stack>
      </FavouritesProvider>
    </DeliveryAddressProvider>
    </GestureHandlerRootView>
  );
}
