// Pure email helpers (no React Native imports, so they unit-test in isolation).
// ASCII only for v1: Unicode/IDN addresses are deliberately rejected.

const MAX_LENGTH = 254;
const MAX_LOCAL = 64;
const MAX_LABEL = 63;
const LOCAL_RE = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/;
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const TLD_RE = /^[a-z]{2,}$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  const v = normalizeEmail(value);
  if (v.length === 0 || v.length > MAX_LENGTH || /\s/.test(v)) return false;

  const parts = v.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;

  if (local.length === 0 || local.length > MAX_LOCAL) return false;
  if (!LOCAL_RE.test(local)) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes(".."))
    return false;

  const labels = domain.split(".");
  if (labels.length < 2) return false;
  for (const label of labels) {
    if (label.length === 0 || label.length > MAX_LABEL) return false;
    if (!LABEL_RE.test(label)) return false;
  }
  return TLD_RE.test(labels[labels.length - 1]);
}

// True once the user has typed enough of a domain that "wrong" feedback is
// fair (gates the debounced haptic so we don't buzz mid-typing).
export function looksComplete(value: string): boolean {
  const v = value.trim();
  const at = v.lastIndexOf("@");
  return at !== -1 && v.length - at - 1 >= 3;
}

const DOMAIN_FIXES: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yhoo.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "outlok.com": "outlook.com",
  "outlook.co": "outlook.com",
  "outlook.con": "outlook.com",
  "iclod.com": "icloud.com",
  "icloud.co": "icloud.com",
};

// "Did you mean" for common domain typos. Returns null when there's nothing
// to suggest. The local part is kept as typed (trimmed).
export function suggestEmail(value: string): string | null {
  const v = value.trim();
  const parts = v.split("@");
  if (parts.length !== 2 || parts[0].length === 0) return null;
  const fix = DOMAIN_FIXES[parts[1].toLowerCase()];
  return fix ? `${parts[0]}@${fix}` : null;
}
