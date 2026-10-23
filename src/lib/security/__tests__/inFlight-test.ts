/// <reference types="jest" />
import { createInFlight } from "../inFlight";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("createInFlight", () => {
  test("concurrent calls with the same key share one execution", async () => {
    const f = createInFlight();
    const d = deferred<string>();
    const fn = jest.fn(() => d.promise);
    const a = f.run("k", fn);
    const b = f.run("k", fn);
    expect(fn).toHaveBeenCalledTimes(1);
    d.resolve("v");
    await expect(Promise.all([a, b])).resolves.toEqual(["v", "v"]);
  });

  test("different keys run separately", () => {
    const f = createInFlight();
    const fn = jest.fn(() => new Promise<void>(() => {}));
    void f.run("a", fn);
    void f.run("b", fn);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(f.size()).toBe(2);
  });

  test("a rejection is shared and frees the key", async () => {
    const f = createInFlight();
    const d = deferred<string>();
    const a = f.run("k", () => d.promise);
    const b = f.run("k", () => Promise.resolve("never"));
    d.reject(new Error("boom"));
    await expect(a).rejects.toThrow("boom");
    await expect(b).rejects.toThrow("boom");
    expect(f.size()).toBe(0);
    await expect(f.run("k", () => Promise.resolve("again"))).resolves.toBe("again");
  });

  test("the key is freed after success", async () => {
    const f = createInFlight();
    const fn = jest.fn(() => Promise.resolve(1));
    await f.run("k", fn);
    expect(f.size()).toBe(0);
    await f.run("k", fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("a synchronous throw becomes a rejection", async () => {
    const f = createInFlight();
    await expect(
      f.run("k", () => {
        throw new Error("sync");
      }),
    ).rejects.toThrow("sync");
    expect(f.size()).toBe(0);
  });
});
