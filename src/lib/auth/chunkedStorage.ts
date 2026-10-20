// Splits large values across several keys so a Supabase session (often
// 2-4KB) fits in expo-secure-store, which can reject values over ~2048 bytes
// on some iOS releases. Pure (backend injected) so it unit-tests without RN.
//
// Layout for key K: count at `K.n`, chunks at `K.0` .. `K.(n-1)`. Every key
// stays within SecureStore's allowed characters [A-Za-z0-9._-].

export type KeyValueBackend = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type ChunkedStorage = KeyValueBackend;

// 600 UTF-16 units encode to at most 1800 UTF-8 bytes, under the 2048 limit.
export const DEFAULT_CHUNK_SIZE = 600;

const countKey = (key: string) => `${key}.n`;
const chunkKey = (key: string, i: number) => `${key}.${i}`;

// Splits into pieces of at most `size` UTF-16 units without breaking a
// surrogate pair (emoji etc.).
export function splitIntoChunks(value: string, size: number): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < value.length) {
    let end = Math.min(i + size, value.length);
    if (end < value.length && size > 1) {
      const last = value.charCodeAt(end - 1);
      if (last >= 0xd800 && last <= 0xdbff) end -= 1;
    }
    chunks.push(value.slice(i, end));
    i = end;
  }
  return chunks;
}

function parseCount(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// Values are never logged: they hold auth tokens.
function warn(op: string, key: string): void {
  console.warn(`[chunkedStorage] ${op} failed for ${key}`);
}

export function createChunkedStorage(
  backend: KeyValueBackend,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): ChunkedStorage {
  return {
    async getItem(key) {
      try {
        const count = parseCount(await backend.getItem(countKey(key)));
        if (count === null) return null;
        let out = "";
        for (let i = 0; i < count; i++) {
          const part = await backend.getItem(chunkKey(key, i));
          // A missing chunk means a torn write: treat as signed out.
          if (part === null) return null;
          out += part;
        }
        return out;
      } catch {
        warn("getItem", key);
        return null;
      }
    },

    async setItem(key, value) {
      try {
        const previous = parseCount(await backend.getItem(countKey(key)));
        const chunks = splitIntoChunks(value, chunkSize);
        for (let i = 0; i < chunks.length; i++) {
          await backend.setItem(chunkKey(key, i), chunks[i]);
        }
        await backend.setItem(countKey(key), String(chunks.length));
        // Drop stale chunks left over from a longer previous value.
        if (previous !== null) {
          for (let i = chunks.length; i < previous; i++) {
            await backend.removeItem(chunkKey(key, i));
          }
        }
      } catch {
        warn("setItem", key);
      }
    },

    async removeItem(key) {
      try {
        const count = parseCount(await backend.getItem(countKey(key)));
        await backend.removeItem(countKey(key));
        for (let i = 0; i < (count ?? 0); i++) {
          await backend.removeItem(chunkKey(key, i));
        }
      } catch {
        warn("removeItem", key);
      }
    },
  };
}
