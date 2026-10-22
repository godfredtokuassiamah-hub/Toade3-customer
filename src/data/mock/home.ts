// TODO(catalog): replace with the catalog read API (Docs/Toade3_Customer_App_End_to_End_Architecture.pdf §5/§14); prices are display-only.
// Food photos live in ./foodImages.ts (one file to wire in new photos);
// items without one render a placeholder card.
import type { ImageSourcePropType } from "react-native";

import { getVendorIdForItem } from "./catalog";
import { foodImages } from "./foodImages";

export type FoodItem = {
  id: string;
  name: string;
  vendor: string;
  // Owning vendor id; tapping the card opens this vendor's storefront. Every
  // static Home id is a real catalog item id, so it is resolved from the
  // catalog in `withImages` below.
  vendorId: string;
  priceGhs: number;
  etaMins: number;
  // Local require() asset; undefined until the photo is added.
  image?: ImageSourcePropType;
};

export type Banner = {
  id: string;
  image: ImageSourcePropType;
  // Width / height of the optimised file, so the banner never crops.
  aspectRatio: number;
  accessibilityLabel: string;
};

export type HomeSection = {
  id: string;
  title: string;
  items: FoodItem[];
};

export type PopularPlace = {
  id: string;
  name: string;
  logo: ImageSourcePropType;
};

export type HomeData = {
  user: { firstName: string; fullName: string; avatar?: ImageSourcePropType };
  locationLabel: string;
  banners: { top: Banner; middle: Banner };
  sections: {
    localMeals: HomeSection;
    drinks: HomeSection;
    bakery: HomeSection;
  };
  popularPlaces: PopularPlace[];
};

function withImages(items: Omit<FoodItem, "image" | "vendorId">[]): FoodItem[] {
  return items.map((item) => ({
    ...item,
    // Every static Home id is a real catalog item id; fall back to "" so a
    // missing lookup is caught by the storefront's not-found state rather
    // than crashing (no current id misses).
    vendorId: getVendorIdForItem(item.id) ?? "",
    image: foodImages[item.id],
  }));
}

export const homeData: HomeData = {
  user: {
    firstName: "James",
    fullName: "James Mensah",
    avatar: {
      uri: "https://i.pinimg.com/1200x/a2/f0/37/a2f037f7c1a396a74a4d806965462037.jpg",
    },
  },
  locationLabel: "University Avenue",
  banners: {
    top: {
      id: "banner-vegetables",
      image: require("../../../assets/images/banners/banner-1.jpg"),
      aspectRatio: 377 / 130,
      accessibilityLabel: "Vegetable offers, 50% off, shop now",
    },
    middle: {
      id: "banner-big-sale",
      image: require("../../../assets/images/banners/banner-2.jpg"),
      aspectRatio: 1000 / 357,
      accessibilityLabel: "Toade3 11.11 big sale, shop deals",
    },
  },
  sections: {
    localMeals: {
      id: "local-meals",
      title: "Local meals",
      items: withImages([
        {
          id: "lm-grilled-chicken-wedges",
          name: "Grilled Chicken & Wedges",
          vendor: "Campus Grill",
          priceGhs: 45,
          etaMins: 18,
        },
        {
          id: "lm-beef-veggie-rice",
          name: "Beef & Veggie Rice",
          vendor: "Green Bowl Kitchen",
          priceGhs: 40,
          etaMins: 18,
        },
        {
          id: "lm-jollof-chicken",
          name: "Jollof Rice & Grilled Chicken",
          vendor: "Mama's Pot",
          priceGhs: 38,
          etaMins: 20,
        },
        {
          id: "lm-waakye",
          name: "Yam Chips & Fried Chicken",
          vendor: "Auntie Ama's Waakye",
          priceGhs: 30,
          etaMins: 15,
        },
        {
          id: "lm-banku-tilapia",
          name: "Banku & Okro Stew",
          vendor: "Lakeside Chop Bar",
          priceGhs: 55,
          etaMins: 25,
        },
        {
          id: "lm-fried-rice-chicken",
          name: "Fried Rice & Chicken",
          vendor: "Campus Grill",
          priceGhs: 42,
          etaMins: 20,
        },
      ]),
    },
    drinks: {
      id: "drinks",
      title: "Drinks",
      // Mock order: matcha boba, then the Bliss can.
      items: withImages([
        {
          id: "dr-matcha-bubble-tea",
          name: "Raspberry Iced Tea",
          vendor: "Green Bowl Kitchen",
          priceGhs: 28,
          etaMins: 12,
        },
        {
          id: "dr-bliss-sparkling-juice",
          name: "Tropical Mango Soda",
          vendor: "Campus Mart",
          priceGhs: 8,
          etaMins: 8,
        },
        {
          id: "dr-sobolo",
          name: "Sobolo (Hibiscus)",
          vendor: "Sweet Sip Bar",
          priceGhs: 10,
          etaMins: 10,
        },
        {
          id: "dr-orange-juice",
          name: "Classic Cola (Can)",
          vendor: "Juice Hub",
          priceGhs: 15,
          etaMins: 10,
        },
        {
          id: "dr-iced-coffee",
          name: "Iced Lemon Tea",
          vendor: "Brew Corner",
          priceGhs: 25,
          etaMins: 12,
        },
        {
          id: "dr-mango-smoothie",
          name: "Strawberry Coconut Smoothie",
          vendor: "Sweet Sip Bar",
          priceGhs: 22,
          etaMins: 12,
        },
      ]),
    },
    bakery: {
      id: "bakery-desserts",
      title: "Bakery & Desserts",
      items: withImages([
        {
          id: "bk-sliced-bread",
          name: "Deli Sandwich Trio",
          vendor: "Golden Crust Bakery",
          priceGhs: 20,
          etaMins: 15,
        },
        {
          id: "bk-chocolate-cake",
          name: "Strawberry Cream Roll Cake",
          vendor: "Sweet Tooth Desserts",
          priceGhs: 35,
          etaMins: 20,
        },
        {
          id: "bk-meat-pie",
          name: "Toasted Ham & Cheese Sub",
          vendor: "Golden Crust Bakery",
          priceGhs: 12,
          etaMins: 15,
        },
        {
          id: "bk-croissant",
          name: "Vanilla Cream Roll",
          vendor: "Le Petit Café",
          priceGhs: 18,
          etaMins: 15,
        },
        {
          id: "bk-doughnuts",
          name: "Strawberry Roll Slices (6 pcs)",
          vendor: "Sweet Tooth Desserts",
          priceGhs: 16,
          etaMins: 15,
        },
      ]),
    },
  },
  // Logos are the design's own 68x68 (1x) exports, read in place.
  popularPlaces: [
    {
      id: "pp-medie-foods",
      name: "Medie Foods",
      logo: require("../../../assets/UI SCREEN/popular places/Ellipse 3.png"),
    },
    {
      id: "pp-churros",
      name: "Churros",
      logo: require("../../../assets/UI SCREEN/popular places/Ellipse 4.png"),
    },
    {
      id: "pp-milk",
      name: "Milk",
      logo: require("../../../assets/UI SCREEN/popular places/Ellipse 5.png"),
    },
    {
      id: "pp-red-rock",
      name: "Red Rock",
      logo: require("../../../assets/UI SCREEN/popular places/Ellipse 6.png"),
    },
    {
      id: "pp-gamesa",
      name: "Gamesa",
      logo: require("../../../assets/UI SCREEN/popular places/Ellipse 7.png"),
    },
  ],
};
