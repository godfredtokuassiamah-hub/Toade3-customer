/// <reference types="jest" />
import {
  createChunkedStorage,
  type KeyValueBackend,
  splitIntoChunks,
} from "../chunkedStorage";

function memoryBackend() {
  const map = new Map<string, string>();
  const backend: KeyValueBackend = {
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => {
      map.set(k, v);
    },
    removeItem: async (k) => {
      map.delete(k);
    },
  };
  return { map, backend };
}

const KEY = "sb-ref-auth-token";

describe("createChunkedStorage", () => {
  test.each([
    ["short", "hello"],
    ["exactly chunk size", "x".repeat(10)],
    ["4KB", "a".repeat(4096)],
    ["empty", ""],
  ])("round-trips a %s value", async (_label, value) => {
    const { backend } = memoryBackend();
    const s = createChunkedStorage(backend, 10);
    await s.setItem(KEY, value);
    expect(await s.getItem(KEY)).toBe(value);
  });

  test("never splits a surrogate pair", async () => {
    const value = "abcdefghi😀ñé漢字😀😀😀";
    const chunks = splitIntoChunks(value, 10);
    for (const c of chunks) {
      const last = c.charCodeAt(c.length - 1);
      expect(last >= 0xd800 && last <= 0xdbff).toBe(false);
    }
    expect(chunks.join("")).toBe(value);

    const { backend } = memoryBackend();
    const s = createChunkedStorage(backend, 10);
    await s.setItem(KEY, value);
    expect(await s.getItem(KEY)).toBe(value);
  });

  test("overwriting long -> short removes stale chunks", async () => {
    const { map, backend } = memoryBackend();
    const s = createChunkedStorage(backend, 10);
    await s.setItem(KEY, "a".repeat(45));
    expect(map.has(`${KEY}.4`)).toBe(true);
    await s.setItem(KEY, "b".repeat(12));
    expect(map.get(`${KEY}.n`)).toBe("2");
    expect(map.has(`${KEY}.2`)).toBe(false);
    expect(map.has(`${KEY}.4`)).toBe(false);
    expect(await s.getItem(KEY)).toBe("b".repeat(12));
  });

  test("missing count -> null", async () => {
    const { backend } = memoryBackend();
    expect(await createChunkedStorage(backend).getItem(KEY)).toBeNull();
  });

  test("missing chunk -> null", async () => {
    const { map, backend } = memoryBackend();
    const s = createChunkedStorage(backend, 10);
    await s.setItem(KEY, "a".repeat(25));
    map.delete(`${KEY}.1`);
    expect(await s.getItem(KEY)).toBeNull();
  });

  test("removeItem clears every key", async () => {
    const { map, backend } = memoryBackend();
    const s = createChunkedStorage(backend, 10);
    await s.setItem(KEY, "a".repeat(35));
    await s.removeItem(KEY);
    expect(map.size).toBe(0);
    expect(await s.getItem(KEY)).toBeNull();
  });

  test("a throwing backend never throws and getItem returns null", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const failing: KeyValueBackend = {
      getItem: async () => {
        throw new Error("boom");
      },
      setItem: async () => {
        throw new Error("boom");
      },
      removeItem: async () => {
        throw new Error("boom");
      },
    };
    const s = createChunkedStorage(failing);
    await expect(s.getItem(KEY)).resolves.toBeNull();
    await expect(s.setItem(KEY, "secret-token")).resolves.toBeUndefined();
    await expect(s.removeItem(KEY)).resolves.toBeUndefined();
    // The value is never logged.
    for (const call of warn.mock.calls) {
      expect(String(call[0])).not.toContain("secret-token");
    }
    warn.mockRestore();
  });
});
