// Query normalization + bounded typo tolerance. Pure (no RN imports) so it
// is unit-tested and matches the server contract (§07).

// NFKD, strip diacritics, lowercase, punctuation -> space, fold spaces.
// "  Jóllof   RICE! " -> "jollof rice". The user-facing text is kept as typed.
export function normalizeText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokenize(input: string): string[] {
  const n = normalizeText(input);
  return n === "" ? [] : n.split(" ");
}

// Allowlisted spellings and local synonyms -> the catalog's term. Only
// these are substituted without a fuzzy candidate search.
// TODO(discovery): server-side synonyms table owned by S4.
export const SYNONYMS: Readonly<Record<string, string>> = {
  jolof: "jollof",
  jolloff: "jollof",
  wakye: "waakye",
  waakey: "waakye",
  bissap: "sobolo",
  chiken: "chicken",
  chicke: "chicken",
  tomatos: "tomatoes",
};

// Levenshtein distance with an early exit once it exceeds `max`.
export function levenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

// Typo tolerance: words of 4+ characters, at most one edit.
export const FUZZY_MIN_LENGTH = 4;
export const FUZZY_MAX_DISTANCE = 1;

export function isTypoOf(term: string, word: string): boolean {
  return (
    term.length >= FUZZY_MIN_LENGTH &&
    word.length >= FUZZY_MIN_LENGTH &&
    levenshtein(term, word, FUZZY_MAX_DISTANCE) <= FUZZY_MAX_DISTANCE
  );
}

function isKnown(word: string, vocabulary: ReadonlySet<string>): boolean {
  if (vocabulary.has(word)) return true;
  for (const v of vocabulary) if (v.startsWith(word)) return true;
  return false;
}

export type InterpretedQuery = {
  // Normalized input ("" for browse).
  normalized: string;
  // Terms to match (after confident corrections).
  terms: string[];
  // Confident correction text, or null.
  corrected: string | null;
  // Uncertain correction offered to the user, or null.
  suggested: string | null;
};

// Synonyms and a UNIQUE one-edit vocabulary candidate are confident
// corrections. Several candidates are uncertain: the word is not replaced
// and the lexicographically first candidate is only suggested.
export function interpretQuery(
  query: string,
  vocabulary: ReadonlySet<string>,
): InterpretedQuery {
  const normalized = normalizeText(query);
  if (normalized === "") {
    return { normalized, terms: [], corrected: null, suggested: null };
  }
  const words = normalized.split(" ");
  const terms: string[] = [];
  const suggestedWords: string[] = [];
  let uncertain = false;
  for (const word of words) {
    const synonym = SYNONYMS[word];
    if (synonym) {
      terms.push(synonym);
      suggestedWords.push(synonym);
      continue;
    }
    if (word.length < FUZZY_MIN_LENGTH || isKnown(word, vocabulary)) {
      terms.push(word);
      suggestedWords.push(word);
      continue;
    }
    const candidates = [...vocabulary].filter((v) => isTypoOf(word, v)).sort();
    if (candidates.length === 1) {
      terms.push(candidates[0]);
      suggestedWords.push(candidates[0]);
    } else {
      terms.push(word);
      if (candidates.length > 1) {
        uncertain = true;
        suggestedWords.push(candidates[0]);
      } else {
        suggestedWords.push(word);
      }
    }
  }
  const text = terms.join(" ");
  const corrected = text !== normalized ? text : null;
  const suggestion = suggestedWords.join(" ");
  return {
    normalized,
    terms,
    corrected,
    suggested: uncertain && suggestion !== text ? suggestion : null,
  };
}
