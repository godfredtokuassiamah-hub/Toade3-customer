/// <reference types="jest" />
import { addRecentSearch, MAX_RECENT_SEARCHES, parseRecentSearches } from "../recentSearches";

// Package-provided in-memory mock (the native module isn't in Jest).
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

describe("recent searches", () => {
  test("most recent first, case-insensitive dedupe, capped", () => {
    let list: string[] = [];
    list = addRecentSearch(list, "Jollof rice");
    list = addRecentSearch(list, "Eggs");
    list = addRecentSearch(list, "  jollof RICE ");
    expect(list).toEqual(["jollof RICE", "Eggs"]);
    expect(addRecentSearch(list, "   ")).toBe(list);
    for (let i = 0; i < 20; i++) list = addRecentSearch(list, `term ${i}`);
    expect(list.length).toBe(MAX_RECENT_SEARCHES);
    expect(list[0]).toBe("term 19");
  });

  test("parse is defensive", () => {
    expect(parseRecentSearches(null)).toEqual([]);
    expect(parseRecentSearches("not json")).toEqual([]);
    expect(parseRecentSearches('["a", 3, "", "b"]')).toEqual(["a", "b"]);
  });
});
