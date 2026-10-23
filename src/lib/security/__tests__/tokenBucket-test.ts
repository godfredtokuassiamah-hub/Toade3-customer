/// <reference types="jest" />
import { createCooldown, createTokenBucket } from "../tokenBucket";

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("createTokenBucket", () => {
  test("allows `capacity` takes, then refuses", () => {
    const c = clock();
    const b = createTokenBucket({ capacity: 3, refillPerMs: 1 / 1000, now: c.now });
    expect([b.tryTake(), b.tryTake(), b.tryTake(), b.tryTake()]).toEqual([true, true, true, false]);
  });

  test("refills over time, never above capacity", () => {
    const c = clock();
    const b = createTokenBucket({ capacity: 2, refillPerMs: 1 / 1000, now: c.now });
    b.tryTake();
    b.tryTake();
    expect(b.tryTake()).toBe(false);
    c.advance(1000);
    expect(b.tryTake()).toBe(true);
    expect(b.tryTake()).toBe(false);
    c.advance(60_000);
    expect([b.tryTake(), b.tryTake(), b.tryTake()]).toEqual([true, true, false]);
  });

  test("exact refill boundaries are not lost to float error", () => {
    const c = clock();
    const b = createTokenBucket({ capacity: 1, refillPerMs: 1 / 12_000, now: c.now });
    expect(b.tryTake()).toBe(true);
    c.advance(11_999);
    expect(b.tryTake()).toBe(false);
    c.advance(1);
    expect(b.tryTake()).toBe(true);
  });

  test("keys are isolated", () => {
    const c = clock();
    const b = createTokenBucket({ capacity: 1, refillPerMs: 1 / 1000, now: c.now });
    expect(b.tryTake("a@example.com")).toBe(true);
    expect(b.tryTake("a@example.com")).toBe(false);
    expect(b.tryTake("b@example.com")).toBe(true);
  });

  test("msUntilAvailable", () => {
    const c = clock();
    const b = createTokenBucket({ capacity: 1, refillPerMs: 1 / 1000, now: c.now });
    expect(b.msUntilAvailable()).toBe(0);
    b.tryTake();
    expect(b.msUntilAvailable()).toBe(1000);
    c.advance(400);
    expect(b.msUntilAvailable()).toBe(600);
    expect(b.msUntilAvailable("other")).toBe(0);
  });

  test("a refused take consumes nothing; cost > 1 works", () => {
    const c = clock();
    const b = createTokenBucket({ capacity: 5, refillPerMs: 1 / 1000, now: c.now });
    expect(b.tryTake(undefined, 4)).toBe(true);
    expect(b.tryTake(undefined, 2)).toBe(false);
    expect(b.tryTake(undefined, 1)).toBe(true);
  });

  test("reset(key) and reset()", () => {
    const c = clock();
    const b = createTokenBucket({ capacity: 1, refillPerMs: 1 / 1000, now: c.now });
    b.tryTake("a");
    b.tryTake("b");
    b.reset("a");
    expect(b.tryTake("a")).toBe(true);
    expect(b.tryTake("b")).toBe(false);
    b.reset();
    expect(b.tryTake("b")).toBe(true);
  });

  test("a clock moving backwards adds no tokens", () => {
    const c = clock();
    const b = createTokenBucket({ capacity: 1, refillPerMs: 1 / 1000, now: c.now });
    b.tryTake();
    c.advance(-50_000);
    expect(b.tryTake()).toBe(false);
  });

  test("rejects invalid options", () => {
    expect(() => createTokenBucket({ capacity: 0, refillPerMs: 1 })).toThrow();
    expect(() => createTokenBucket({ capacity: 1, refillPerMs: 0 })).toThrow();
  });

  test("prunes full buckets past maxKeys", () => {
    const c = clock();
    const b = createTokenBucket({ capacity: 1, refillPerMs: 1 / 1000, now: c.now, maxKeys: 2 });
    b.tryTake("a");
    b.tryTake("b");
    c.advance(5000);
    b.tryTake("c");
    // a and b refilled and were pruned; they start full again.
    expect(b.tryTake("a")).toBe(true);
    expect(b.tryTake("c")).toBe(false);
  });
});

describe("createCooldown", () => {
  test("one action per window per key", () => {
    const c = clock();
    const cd = createCooldown(60_000, c.now);
    expect(cd.tryTake("a@example.com")).toBe(true);
    expect(cd.tryTake("a@example.com")).toBe(false);
    expect(cd.msUntilAvailable("a@example.com")).toBe(60_000);
    c.advance(59_999);
    expect(cd.tryTake("a@example.com")).toBe(false);
    c.advance(1);
    expect(cd.tryTake("a@example.com")).toBe(true);
  });
});
