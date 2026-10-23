// Opens an external URL (tel:, maps) and fails soft. openURL rejects when no
// app handles the URL or the user cancels (expo-linking docs), so try the
// primary, then the fallback, then call onFail (the caller shows an Alert
// with the number/address to copy). Never throws. No canOpenURL: it needs
// LSApplicationQueriesSchemes / Android <queries> and can't be tested in
// Expo Go, and every primary URL here is https or tel:.
import * as Linking from "expo-linking";

export async function openExternal(
  urls: { primary: string; fallback?: string },
  onFail: () => void,
): Promise<void> {
  try {
    await Linking.openURL(urls.primary);
    return;
  } catch {
    // Try the fallback below.
  }
  if (urls.fallback && urls.fallback !== urls.primary) {
    try {
      await Linking.openURL(urls.fallback);
      return;
    } catch {
      // Fall through to onFail.
    }
  }
  onFail();
}
