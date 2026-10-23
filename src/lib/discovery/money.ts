// Money is integer pesewas (GHS minor units) everywhere. GHS text is
// parsed with string operations only, never float multiplication.

export const PRICE_FORMAT_ERROR = "Enter a valid price (up to 2 decimals).";
export const PRICE_ORDER_ERROR =
  "Maximum price must be equal to or higher than minimum price.";

// Digits, optionally "." and 1-2 decimals. Max GHS 9,999,999.99.
const GHS_PATTERN = /^\d{1,7}(\.\d{1,2})?$/;

export type ParsedPrice =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

// "" -> null (unbounded); "45" -> 4500; "45.5" -> 4550; "45.555", "-1",
// "abc" -> error. A comma decimal separator (some keyboards) is accepted.
export function parseGhsToMinor(text: string): ParsedPrice {
  const t = text.trim().replace(",", ".");
  if (t === "") return { ok: true, value: null };
  if (!GHS_PATTERN.test(t)) return { ok: false, error: PRICE_FORMAT_ERROR };
  const [whole, fraction = ""] = t.split(".");
  return { ok: true, value: parseInt(whole + fraction.padEnd(2, "0"), 10) };
}

function grouped(whole: number): string {
  return whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// 4500 -> "45", 4550 -> "45.50" (field text, no currency).
export function minorToText(minor: number): string {
  const whole = Math.floor(minor / 100);
  const fraction = minor % 100;
  return fraction === 0 ? `${whole}` : `${whole}.${fraction.toString().padStart(2, "0")}`;
}

// 4500 -> "GHS 45", 4550 -> "GHS 45.50", 120000 -> "GHS 1,200".
export function formatMinor(minor: number): string {
  const whole = Math.floor(minor / 100);
  const fraction = minor % 100;
  const tail = fraction === 0 ? "" : `.${fraction.toString().padStart(2, "0")}`;
  return `GHS ${grouped(whole)}${tail}`;
}

// 4500 -> "GHS 45.00" (item cards).
export function formatMinorFixed(minor: number): string {
  const whole = Math.floor(minor / 100);
  const fraction = (minor % 100).toString().padStart(2, "0");
  return `GHS ${grouped(whole)}.${fraction}`;
}

// 1089 -> "GH₵10.89", 123456 -> "GH₵1,234.56" (storefront mockup style:
// cedi sign, always 2 decimals). Uses grouped() rather than toLocaleString so
// output is identical on Hermes/Android/iOS regardless of device locale.
export function formatCedi(minor: number): string {
  const whole = Math.floor(minor / 100);
  const fraction = (minor % 100).toString().padStart(2, "0");
  return `GH₵${grouped(whole)}.${fraction}`;
}

// Max bucket edge for "No limit": "GHS 150+".
export function formatOpenMax(minor: number): string {
  return `${formatMinor(minor)}+`;
}

// Chip / summary text for a price group.
export function priceSummary(min: number | null, max: number | null): string {
  if (min == null && max == null) return "Any price";
  if (min == null) return `Up to ${formatMinor(max as number)}`;
  if (max == null) return `From ${formatMinor(min)}`;
  return `${formatMinor(min)} – ${formatMinor(max)}`;
}
