// Country dial codes for the profile phone field. Ghana first (default),
// then West Africa, the rest of Africa, and common diaspora countries.
import { foldForSearch } from "../components/language/filterLanguages";

export type Country = {
  name: string;
  // ISO 3166-1 alpha-2, uppercase.
  iso2: string;
  // E.164 country calling code with "+", e.g. "+233".
  dialCode: string;
  // Emoji flag built from iso2 (see flagFromIso2).
  flag: string;
  // Domestic trunk prefix dropped in international format (Ghana 020... ->
  // +233 20...). Omitted where a leading 0 is part of the number (Italy) or
  // there's no trunk prefix (US, Senegal, ...).
  trunkPrefix?: "0";
};

// Regional-indicator pair, e.g. "GH" -> 🇬🇭. Computed so no emoji literals
// live in source.
export function flagFromIso2(iso2: string): string {
  const up = iso2.toUpperCase();
  if (!/^[A-Z]{2}$/.test(up)) return "";
  return String.fromCodePoint(
    0x1f1e6 + up.charCodeAt(0) - 65,
    0x1f1e6 + up.charCodeAt(1) - 65,
  );
}

type Seed = [name: string, iso2: string, dialCode: string, trunk?: "0"];

const SEED: Seed[] = [
  ["Ghana", "GH", "+233", "0"],
  ["Nigeria", "NG", "+234", "0"],
  ["Côte d'Ivoire", "CI", "+225"],
  ["Togo", "TG", "+228"],
  ["Benin", "BJ", "+229"],
  ["Burkina Faso", "BF", "+226"],
  ["Senegal", "SN", "+221"],
  ["Liberia", "LR", "+231", "0"],
  ["Sierra Leone", "SL", "+232", "0"],
  ["The Gambia", "GM", "+220"],
  ["Cameroon", "CM", "+237"],
  ["Kenya", "KE", "+254", "0"],
  ["South Africa", "ZA", "+27", "0"],
  ["Egypt", "EG", "+20", "0"],
  ["Morocco", "MA", "+212", "0"],
  ["United Kingdom", "GB", "+44", "0"],
  ["Ireland", "IE", "+353", "0"],
  ["United States", "US", "+1"],
  ["Canada", "CA", "+1"],
  ["France", "FR", "+33", "0"],
  ["Germany", "DE", "+49", "0"],
  ["Netherlands", "NL", "+31", "0"],
  ["Belgium", "BE", "+32", "0"],
  ["Italy", "IT", "+39"],
  ["Spain", "ES", "+34"],
  ["Portugal", "PT", "+351"],
  ["United Arab Emirates", "AE", "+971", "0"],
  ["Saudi Arabia", "SA", "+966", "0"],
  ["India", "IN", "+91", "0"],
  ["China", "CN", "+86", "0"],
  ["Australia", "AU", "+61", "0"],
];

export const COUNTRIES: readonly Country[] = SEED.map(
  ([name, iso2, dialCode, trunkPrefix]) => ({
    name,
    iso2,
    dialCode,
    flag: flagFromIso2(iso2),
    ...(trunkPrefix ? { trunkPrefix } : {}),
  }),
);

export const DEFAULT_COUNTRY: Country = COUNTRIES[0];

export function getCountryByIso2(iso2: string): Country | undefined {
  const up = iso2.toUpperCase();
  return COUNTRIES.find((c) => c.iso2 === up);
}

// Live filter: name (accent-insensitive), ISO code, or dial code with or
// without "+". Keeps the original order.
export function filterCountries(
  list: readonly Country[],
  query: string,
): readonly Country[] {
  const q = foldForSearch(query);
  if (!q) return list;
  const digits = q.replace(/^\+/, "");
  const isDial = /^\d+$/.test(digits);
  return list.filter((c) =>
    isDial
      ? c.dialCode.slice(1).startsWith(digits)
      : foldForSearch(c.name).includes(q) || c.iso2.toLowerCase() === q,
  );
}
