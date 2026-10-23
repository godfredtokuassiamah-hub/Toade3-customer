/// <reference types="jest" />
import { decideFixedWindow, SERVER_RATE_LIMITS } from "../rateLimit";

const MIN = 60_000;

describe("decideFixedWindow", () => {
  test("first hit opens the window", () => {
    const d = decideFixedWindow(null, 10 * MIN + 5000, 5, MIN);
    expect(d).toEqual({ allowed: true, hits: 1, windowStart: 10 * MIN, retryAfterMs: 0 });
  });

  test("allows up to max, refuses max + 1 with the time to the window end", () => {
    let state: { windowStart: number; hits: number } | null = null;
    const now = 10 * MIN + 15_000;
    for (let i = 1; i <= 5; i++) {
      const d = decideFixedWindow(state, now, 5, MIN);
      expect(d.allowed).toBe(true);
      expect(d.hits).toBe(i);
      state = d;
    }
    const over = decideFixedWindow(state, now, 5, MIN);
    expect(over.allowed).toBe(false);
    expect(over.hits).toBe(6);
    expect(over.retryAfterMs).toBe(45_000);
  });

  test("a new window resets the count", () => {
    const state = { windowStart: 10 * MIN, hits: 5 };
    const d = decideFixedWindow(state, 11 * MIN, 5, MIN);
    expect(d).toEqual({ allowed: true, hits: 1, windowStart: 11 * MIN, retryAfterMs: 0 });
  });

  test("the last ms of a window still belongs to it", () => {
    const state = { windowStart: 10 * MIN, hits: 5 };
    const d = decideFixedWindow(state, 11 * MIN - 1, 5, MIN);
    expect(d.allowed).toBe(false);
    expect(d.retryAfterMs).toBe(1);
  });

  test("rejects a non-positive window", () => {
    expect(() => decideFixedWindow(null, 0, 1, 0)).toThrow();
  });
});

describe("SERVER_RATE_LIMITS", () => {
  test("the planned per-action limits", () => {
    expect(SERVER_RATE_LIMITS).toEqual({
      "order.place": { max: 5, windowSeconds: 60 },
      "order.cancel": { max: 10, windowSeconds: 60 },
      "profile.write": { max: 10, windowSeconds: 60 },
      "cart.write": { max: 60, windowSeconds: 60 },
    });
  });
});
