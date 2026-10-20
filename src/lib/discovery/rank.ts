// Relevance tiers and stable sorts (§07). No sponsored boost, no
// popularity or rating signals.
import { isTypoOf } from "./normalize";
import type { DiscoverySort } from "./types";

export const TIER_EXACT = 4;
export const TIER_PREFIX = 3;
export const TIER_TOKEN = 2;
export const TIER_TYPO = 1;
export const TIER_NONE = 0;

export type RankFields = {
  // Normalized item name and aliases.
  names: string[];
  // Words of name, aliases, vendor and category labels.
  words: string[];
};

// exact name/alias > name/alias prefix > every term matches a word (exact
// or prefix) > every term matches with at most one typo.
export function relevanceTier(fields: RankFields, normalizedQ: string, terms: readonly string[]): number {
  if (terms.length === 0) return TIER_TOKEN;
  const phrase = terms.join(" ");
  if (fields.names.some((n) => n === normalizedQ || n === phrase)) return TIER_EXACT;
  if (fields.names.some((n) => n.startsWith(normalizedQ) || n.startsWith(phrase))) return TIER_PREFIX;
  const token = terms.every((t) => fields.words.some((w) => w.startsWith(t)));
  if (token) return TIER_TOKEN;
  const typo = terms.every((t) => fields.words.some((w) => w.startsWith(t) || isTypoOf(t, w)));
  return typo ? TIER_TYPO : TIER_NONE;
}

export type Rankable = {
  item_id: string;
  price_minor: number;
  tier: number;
  // vendor open AND item orderable
  ready: boolean;
};

function byId(a: Rankable, b: Rankable): number {
  return a.item_id < b.item_id ? -1 : a.item_id > b.item_id ? 1 : 0;
}

// best_match: tier desc; within an equal tier open/orderable first; then
// item_id asc. Price sorts: (price, item_id) asc / (price desc, item_id asc).
export function compareForSort(sort: DiscoverySort): (a: Rankable, b: Rankable) => number {
  switch (sort) {
    case "price_asc":
      return (a, b) => a.price_minor - b.price_minor || byId(a, b);
    case "price_desc":
      return (a, b) => b.price_minor - a.price_minor || byId(a, b);
    case "best_match":
      return (a, b) =>
        b.tier - a.tier || Number(b.ready) - Number(a.ready) || byId(a, b);
  }
}
