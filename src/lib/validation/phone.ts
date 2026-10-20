// Phone number normalization to E.164 (pure, no libphonenumber).
//
// Rules, in order:
// 1. Strip spaces and the separators - . ( ).
// 2. Accept a pasted international prefix for the selected country:
//    "+233..." or "00233..." -> drop it. Any other "+" is rejected.
// 3. Only digits may remain.
// 4. Drop ONE leading "0" when the country uses "0" as a domestic trunk
//    prefix (Ghana 0201234567 -> 201234567). Countries where the 0 is part
//    of the number (Italy) keep it.
// 5. The national number must be 6-14 digits and dial code + national
//    must be at most 15 digits (E.164 limit).
// e164 = dialCode + national, e.g. "+233201234567".
import type { Country } from "../../data/countries";

export const PHONE_MIN_DIGITS = 6;
export const PHONE_MAX_DIGITS = 14;
const E164_MAX_DIGITS = 15;

export type PhoneResult =
  | { ok: true; national: string; e164: string }
  | { ok: false; reason: "empty" | "invalid_chars" | "too_short" | "too_long" };

export function normalizePhone(
  country: Pick<Country, "dialCode" | "trunkPrefix">,
  input: string,
): PhoneResult {
  let s = input.replace(/[\s\-.()]/g, "");
  if (s === "") return { ok: false, reason: "empty" };

  const dial = country.dialCode.replace(/^\+/, "");
  if (s.startsWith("+")) {
    if (!s.startsWith(`+${dial}`)) return { ok: false, reason: "invalid_chars" };
    s = s.slice(dial.length + 1);
  } else if (s.startsWith(`00${dial}`)) {
    s = s.slice(dial.length + 2);
  }

  if (!/^\d*$/.test(s)) return { ok: false, reason: "invalid_chars" };
  if (country.trunkPrefix === "0" && s.startsWith("0")) s = s.slice(1);

  if (s.length < PHONE_MIN_DIGITS) return { ok: false, reason: "too_short" };
  if (s.length > PHONE_MAX_DIGITS || dial.length + s.length > E164_MAX_DIGITS) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true, national: s, e164: `+${dial}${s}` };
}
