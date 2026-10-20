import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useRef, useState } from "react";
import {
  BackHandler,
  type FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NextButton } from "../components/onboarding/NextButton";
import { OnboardingSlide } from "../components/onboarding/OnboardingSlide";
import { PaginationDots } from "../components/onboarding/PaginationDots";
import {
  SLIDES,
  TOTAL_SLIDES,
  type OnboardingSlide as Slide,
} from "../components/onboarding/slides";
import { BackButton } from "../components/ui/BackButton";

const backgroundImage = require("../../assets/images/LOGOS/Onboarding background.png");

// interpolateColor needs at least two stops; duplicate when there is one slide.
const COLOR_INPUT = SLIDES.length > 1 ? SLIDES.map((_, i) => i) : [0, 1];
const COLOR_OUTPUT =
  SLIDES.length > 1
    ? SLIDES.map((s) => s.color)
    : [SLIDES[0].color, SLIDES[0].color];

export default function Onboarding() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  // Horizontal scroll offset -> page progress -> current slide colour.
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });
  const progress = useDerivedValue(() =>
    width > 0 ? scrollX.value / width : 0,
  );
  const activeColor = useDerivedValue(() =>
    interpolateColor(progress.value, COLOR_INPUT, COLOR_OUTPUT),
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
    },
    [width],
  );

  const goTo = useCallback((i: number) => {
    listRef.current?.scrollToIndex({ index: i, animated: true });
    setIndex(i);
  }, []);

  // Called by Next on the final slide.
  // TODO: replace the /sign-in placeholder with the real sign-in screen when
  // it is designed, and persist an "onboarding seen" flag (storage added
  // later) so returning users skip onboarding.
  const completeOnboarding = useCallback(() => {
    // replace() so back doesn't return to onboarding.
    router.replace("/sign-in");
  }, []);

  const isLast = index === SLIDES.length - 1;

  const handleNext = () => {
    if (isLast) {
      completeOnboarding();
    } else {
      goTo(index + 1);
    }
  };

  const handleBack = () => {
    if (index > 0) goTo(index - 1);
  };

  // Android hardware back: go to the previous slide instead of leaving the
  // screen; on slide 1 fall through to the default behaviour.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (index > 0) {
          goTo(index - 1);
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [index, goTo]),
  );

  // Back fades in from slide 1 to slide 2.
  const backStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));
  const backVisible = index > 0;

  return (
    <View style={styles.container}>
      <StatusBar style={SLIDES[index]?.statusBarStyle ?? "light"} animated />
      <Image
        source={backgroundImage}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <Animated.FlatList
        ref={listRef}
        data={SLIDES}
        extraData={index}
        keyExtractor={(s) => s.key}
        renderItem={({ item, index: i }) => (
          <OnboardingSlide
            slide={item}
            index={i}
            progress={progress}
            width={width}
            height={height}
            isActive={index === i}
          />
        )}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumScrollEnd}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        entering={FadeIn.delay(500).duration(400)}
        style={[styles.controls, { bottom: insets.bottom + 26 }]}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[styles.back, backStyle]}
          pointerEvents={backVisible ? "auto" : "none"}
          accessibilityElementsHidden={!backVisible}
          importantForAccessibility={backVisible ? "auto" : "no-hide-descendants"}
        >
          <BackButton onPress={handleBack} color={activeColor} />
        </Animated.View>
        <PaginationDots
          total={TOTAL_SLIDES}
          activeIndex={index}
          progress={progress}
          activeColor={activeColor}
        />
        <View style={styles.next}>
          <NextButton
            onPress={handleNext}
            color={activeColor}
            accessibilityLabel={isLast ? "Finish onboarding" : "Next"}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  controls: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  // Back mirrors Next's distance from the edge.
  back: {
    position: "absolute",
    left: 20,
    top: 0,
  },
  next: {
    position: "absolute",
    right: 20,
    top: 0,
  },
});
