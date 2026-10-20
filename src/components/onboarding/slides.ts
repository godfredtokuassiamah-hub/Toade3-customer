import type { ImageContentFit, ImageContentPosition } from "expo-image";
import type { DimensionValue } from "react-native";

export type OnboardingSlide = {
  key: string;
  image: number;
  title: string;
  body: string;
  // Card colour; also drives the active dot, Next fill and Back border/arrow.
  color: string;
  // Heading/body colour. Default "#FFFFFF".
  textColor?: string;
  // Status bar icons while this slide is active. Default "light".
  statusBarStyle?: "light" | "dark";
  imagePosition?: ImageContentPosition;
  // Default "cover".
  imageFit?: ImageContentFit;
  // Box the image is drawn in, relative to the card. Omit = fill the card.
  imageFrame?: {
    left: DimensionValue;
    top: DimensionValue;
    width: DimensionValue;
    height: DimensionValue;
  };
  // Gradient that blends the bottom of the photo into the card colour.
  // `null` disables it (e.g. transparent illustrations).
  fade?: { height: DimensionValue; locations: [number, number] } | null;
};

// Sampled from the mocks / photos so each card blends into its image.
export const ORANGE = "#FF793C";
export const GREEN = "#014B2A";
// Sampled from the Screen 3.png card.
export const YELLOW = "#FCB501";

export const DEFAULT_FADE: NonNullable<OnboardingSlide["fade"]> = {
  height: "45%",
  locations: [0, 0.55],
};

export const SLIDES: OnboardingSlide[] = [
  {
    key: "nearby",
    image: require("../../../assets/UI SCREEN/Onboarding/onboarding screen 1.png"),
    title: "Good food starts nearby.",
    body: "Browse campus vendors, explore their menus, and pick something that hits the spot.",
    color: ORANGE,
    imagePosition: { top: 0, left: "15%" },
  },
  {
    key: "ride",
    image: require("../../../assets/UI SCREEN/Onboarding/onboarding screen 2.png"),
    title: "You order. We ride.",
    body: "Choose your meal, select your campus drop-off point, and let a Toade3 rider bring it to you.",
    color: GREEN,
    imagePosition: "top",
    // The image's flat lower area is already ~#014B2A; a short fade hides
    // the ≤1-unit tint difference and any edge on taller screens.
    fade: { height: "12%", locations: [0, 1] },
  },
  {
    key: "track",
    image: require("../../../assets/UI SCREEN/Onboarding/onboarding screen 3.png"),
    title: "Stay in the know, until the last bite.",
    body: "See when your order is accepted, ready for pickup, and on its way.",
    color: YELLOW,
    textColor: "#000000",
    statusBarStyle: "dark",
    imageFit: "contain",
    imagePosition: { top: 0, left: 0 },
    // Measured from Screen 3.png: 572x429 at (-62, 83) on a 402x738 card,
    // so the map/time card is cut off at the right edge like the mock.
    imageFrame: { left: "-15.4%", top: "11.2%", width: "142.3%", height: "58.2%" },
    // Transparent PNG on the card colour: no seam, and a gradient would
    // fade the bike wheels.
    fade: null,
  },
];

export const TOTAL_SLIDES = SLIDES.length;
