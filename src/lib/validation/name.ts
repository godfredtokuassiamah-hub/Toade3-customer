// Full-name validation (pure).
//
// Letters are explicit Latin ranges rather than \p{L} (unicode property
// escapes aren't exercised on Hermes by our Node tests): ASCII, Latin-1
// letters, Latin Extended-A/B + IPA (covers Ghanaian ɛ ɔ Ɛ Ɔ ŋ) and Latin
// Extended Additional. Combining accents (U+0300-036F) are allowed after
// the first letter for tone marks with no precomposed form (Yoruba ọ̀).
const L = "A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02AF\\u1E00-\\u1EFF";
const NAME_RE = new RegExp(`^[${L}][${L}\\u0300-\\u036F '\\u2019.\\-]*$`);
const LETTER_RE = new RegExp(`[${L}]`, "g");

export const NAME_MIN_LETTERS = 2;
export const NAME_MAX_LENGTH = 80;

// Trim and collapse internal whitespace.
export function normalizeFullName(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

// 2-80 chars, at least 2 letters, starts with a letter, then only letters,
// spaces, hyphens, apostrophes (' and ’) and periods.
export function isValidFullName(input: string): boolean {
  const n = normalizeFullName(input);
  if (n.length > NAME_MAX_LENGTH) return false;
  if (!NAME_RE.test(n)) return false;
  return (n.match(LETTER_RE)?.length ?? 0) >= NAME_MIN_LETTERS;
}
