/// <reference types="jest" />
import { filterLanguages, foldForSearch } from "../filterLanguages";
import { getLanguageName, LANGUAGES } from "../languages";

const codes = (query: string) =>
  filterLanguages(LANGUAGES, query).map((l) => l.code);

describe("LANGUAGES", () => {
  test("has all 8 languages with unique codes", () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual([
      "EN",
      "FR",
      "TW",
      "EE",
      "HA",
      "PCM",
      "PT",
      "AR",
    ]);
    expect(new Set(LANGUAGES.map((l) => l.code)).size).toBe(LANGUAGES.length);
  });

  test("getLanguageName", () => {
    expect(getLanguageName("FR")).toBe("French");
    expect(getLanguageName("XX")).toBe("XX");
  });
});

describe("foldForSearch", () => {
  test("lowercases, strips accents and folds special letters", () => {
    expect(foldForSearch("  FRANÇAIS ")).toBe("francais");
    expect(foldForSearch("Português")).toBe("portugues");
    expect(foldForSearch("Eʋegbe")).toBe("evegbe");
  });
});

describe("filterLanguages", () => {
  test.each(["", "   "])("empty query %p returns everything", (q) => {
    expect(filterLanguages(LANGUAGES, q)).toBe(LANGUAGES);
  });

  test.each([
    ["FR", ["FR"]],
    ["fr", ["FR"]],
    ["francais", ["FR"]],
    ["FRANÇAIS", ["FR"]],
    ["evegbe", ["EE"]],
    ["hausa", ["HA"]],
    ["pcm", ["PCM"]],
    ["naija", ["PCM"]],
    ["portugues", ["PT"]],
    ["العربية", ["AR"]],
    ["en", ["EN", "FR", "HA"]],
  ])("%p matches %p", (q, expected) => {
    expect(codes(q)).toEqual(expected);
  });

  test("no match returns an empty list", () => {
    expect(codes("zzz")).toEqual([]);
  });
});
