import type { Language } from "./languages";

// Letters used by Ewe/Twi/Hausa that NFD does not decompose into a base
// letter + combining mark.
const EXTRA_FOLDS: Record<string, string> = {
  ʋ: "v",
  ɛ: "e",
  ɔ: "o",
  ŋ: "n",
  ƒ: "f",
  ɖ: "d",
  ɣ: "g",
};
const EXTRA_FOLD_RE = new RegExp(`[${Object.keys(EXTRA_FOLDS).join("")}]`, "g");

// Lowercase, strip accents and fold special letters so "FRANÇAIS",
// "francais" and "Français" compare equal.
export function foldForSearch(s: string): string {
  let out = s.toLowerCase();
  if (typeof out.normalize === "function") {
    out = out.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  return out.replace(EXTRA_FOLD_RE, (ch) => EXTRA_FOLDS[ch] ?? ch).trim();
}

// Live filter for the language list: matches code, English name or native
// name; case- and accent-insensitive. Keeps the original order.
export function filterLanguages(
  list: readonly Language[],
  query: string,
): readonly Language[] {
  const q = foldForSearch(query);
  if (!q) return list;
  return list.filter(
    (l) =>
      foldForSearch(l.name).includes(q) ||
      foldForSearch(l.nativeName).includes(q) ||
      foldForSearch(l.code).includes(q),
  );
}
