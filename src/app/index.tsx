import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

const backgroundImage = require("../../assets/images/LOGOS/Onboarding background.png");
// Transparent, trimmed versions of "image 1.png" / "image 2.png".
const logoIcon = require("../../assets/images/LOGOS/logo-icon.png");
const wordmark = require("../../assets/images/LOGOS/logo-wordmark.png");

// Total time on the logo screen before moving to onboarding.
const SPLASH_DURATION_MS = 3000;

export default function Index() {
  const reduceMotion = useReducedMotion();
  const iconOpacity = useSharedValue(0);
  const iconScale = useSharedValue(0.85);
  const wordOpacity = useSharedValue(0);
  const wordTranslate = useSharedValue(12);

  useEffect(() => {
    if (reduceMotion) {
      iconOpacity.value = 1;
      iconScale.value = 1;
      wordOpacity.value = 1;
      wordTranslate.value = 0;
    } else {
      iconOpacity.value = withTiming(1, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      });
      iconScale.value = withTiming(1, {
        duration: 800,
        easing: Easing.out(Easing.back(1.4)),
      });
      wordOpacity.value = withDelay(350, withTiming(1, { duration: 600 }));
      wordTranslate.value = withDelay(
        350,
        withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }),
      );
    }

    // replace() so the back gesture doesn't return to the splash.
    const timer = setTimeout(
      () => router.replace("/onboarding"),
      SPLASH_DURATION_MS,
    );
    return () => clearTimeout(timer);
  }, [reduceMotion, iconOpacity, iconScale, wordOpacity, wordTranslate]);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ scale: iconScale.value }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: wordOpacity.value,
    transform: [{ translateY: wordTranslate.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Image
        source={backgroundImage}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <View
        style={styles.logo}
        accessible
        accessibilityRole="image"
        accessibilityLabel="Buy Something Toade3"
      >
        <Animated.View style={iconStyle}>
          <Image source={logoIcon} style={styles.icon} contentFit="contain" />
        </Animated.View>
        <Animated.View style={wordStyle}>
          <Image source={wordmark} style={styles.wordmark} contentFit="contain" />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    alignItems: "center",
    gap: 10,
  },
  // Source aspect ratios: icon 57x71, wordmark 113x40.
  icon: {
    width: 64,
    height: 80,
  },
  wordmark: {
    width: 120,
    height: 42,
  },
});
