/// <reference types="jest" />
import {
  addFavourite,
  isFavourite,
  parseFavourites,
  removeFavourite,
  toggleFavourite,
} from "../favouritesStore";

// Package-provided in-memory mock (the native module isn't in Jest).
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

describe("favourites helpers", () => {
  test("add puts the id first and de-duplicates", () => {
    let list: string[] = [];
    list = addFavourite(list, "a");
    list = addFavourite(list, "b");
    expect(list).toEqual(["b", "a"]);
    // Re-adding moves it to the front, no duplicate.
    list = addFavourite(list, "a");
    expect(list).toEqual(["a", "b"]);
    // Empty id is ignored (returns a copy).
    expect(addFavourite(list, "")).toEqual(["a", "b"]);
  });

  test("remove and isFavourite", () => {
    const list = ["a", "b", "c"];
    expect(isFavourite(list, "b")).toBe(true);
    expect(isFavourite(list, "z")).toBe(false);
    expect(removeFavourite(list, "b")).toEqual(["a", "c"]);
    // Removing a missing id is a no-op (new array, same contents).
    expect(removeFavourite(list, "z")).toEqual(["a", "b", "c"]);
  });

  test("toggle adds then removes", () => {
    let list: string[] = [];
    list = toggleFavourite(list, "x");
    expect(list).toEqual(["x"]);
    list = toggleFavourite(list, "x");
    expect(list).toEqual([]);
  });

  test("parse is defensive", () => {
    expect(parseFavourites(null)).toEqual([]);
    expect(parseFavourites("not json")).toEqual([]);
    expect(parseFavourites("{}")).toEqual([]);
    expect(parseFavourites('["a", 3, "", "a", "b"]')).toEqual(["a", "b"]);
  });
});
