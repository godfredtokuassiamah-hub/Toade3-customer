/// <reference types="jest" />
import type { BackendMode } from "../config";
import type { BackendErrorCode } from "../errors";
import { createFallbackRunner, decideFallback, type FallbackOp } from "../fallback";

const ERRORS: Record<string, { error: unknown; code: BackendErrorCode }> = {
  "42P01": { error: { code: "42P01", message: "relation does not exist" }, code: "BACKEND_MISSING" },
  "42883": { error: { code: "42883", message: "function does not exist" }, code: "BACKEND_MISSING" },
  PGRST202: { error: { code: "PGRST202", message: "not in schema cache" }, code: "BACKEND_MISSING" },
  PGRST205: { error: { code: "PGRST205", message: "table not in schema cache" }, code: "BACKEND_MISSING" },
  "404": { error: { code: "", message: "Not Found", status: 404 }, code: "BACKEND_MISSING" },
  network: { error: new TypeError("Network request failed"), code: "NETWORK" },
  T3002: { error: { code: "T3002", message: "ITEM_UNAVAILABLE" }, code: "ITEM_UNAVAILABLE" },
  "401": { error: { code: "", message: "JWT expired", status: 401 }, code: "FORBIDDEN" },
  "500": { error: { code: "XX000", message: "internal", status: 500 }, code: "UNKNOWN" },
};

describe("decideFallback", () => {
  const matrix: [BackendMode, boolean, FallbackOp, BackendErrorCode, "mock" | "throw"][] = [
    ["mock", false, "read", "UNKNOWN", "mock"],
    ["mock", false, "write", "ITEM_UNAVAILABLE", "mock"],
    ["remote", true, "read", "BACKEND_MISSING", "throw"],
    ["remote", true, "read", "NETWORK", "throw"],
    ["auto", true, "read", "BACKEND_MISSING", "mock"],
    ["auto", false, "read", "BACKEND_MISSING", "mock"],
    ["auto", true, "write", "BACKEND_MISSING", "mock"],
    ["auto", false, "write", "BACKEND_MISSING", "throw"],
    ["auto", true, "read", "NETWORK", "mock"],
    ["auto", false, "read", "NETWORK", "throw"],
    ["auto", true, "write", "NETWORK", "mock"],
    ["auto", false, "write", "NETWORK", "throw"],
    ["auto", true, "read", "ITEM_UNAVAILABLE", "throw"],
    ["auto", true, "write", "OUT_OF_RADIUS", "throw"],
    ["auto", true, "read", "FORBIDDEN", "throw"],
    ["auto", true, "read", "UNKNOWN", "throw"],
  ];
  it.each(matrix)("mode %s dev=%s %s %s -> %s", (mode, isDev, op, code, expected) => {
    expect(decideFallback(code, { mode, isDev, op })).toBe(expected);
  });
});

function runner(mode: BackendMode, isDev: boolean, hasSession = true) {
  const log = jest.fn();
  const r = createFallbackRunner({ mode, isDev, hasSession: async () => hasSession, log });
  return { r, log };
}

describe("createFallbackRunner", () => {
  it.each(Object.entries(ERRORS))("auto + dev: %s", async (_name, { error, code }) => {
    const { r } = runner("auto", true);
    const p = r.run({
      resource: "stores",
      op: "read",
      remote: () => Promise.reject(error),
      mock: () => "mock",
    });
    if (code === "BACKEND_MISSING" || code === "NETWORK") {
      await expect(p).resolves.toBe("mock");
    } else {
      await expect(p).rejects.toMatchObject({ code });
    }
  });

  it("production: network errors and missing-backend writes propagate", async () => {
    const { r, log } = runner("auto", false);
    await expect(
      r.run({ resource: "stores", op: "read", remote: () => Promise.reject(ERRORS.network.error), mock: () => 1 }),
    ).rejects.toMatchObject({ code: "NETWORK" });
    await expect(
      r.run({ resource: "orders.place", op: "write", remote: () => Promise.reject(ERRORS.PGRST202.error), mock: () => 1 }),
    ).rejects.toMatchObject({ code: "BACKEND_MISSING" });
    // Reads of an undeployed backend still fall back in production...
    await expect(
      r.run({ resource: "stores", op: "read", remote: () => Promise.reject(ERRORS.PGRST205.error), mock: () => 2 }),
    ).resolves.toBe(2);
    // ...silently (logging is dev-only).
    expect(log).not.toHaveBeenCalled();
  });

  it("mock mode never calls remote", async () => {
    const { r } = runner("mock", true);
    const remote = jest.fn(() => Promise.resolve("remote"));
    await expect(r.run({ resource: "x", op: "read", remote, mock: () => "mock" })).resolves.toBe("mock");
    expect(remote).not.toHaveBeenCalled();
  });

  it("remote mode propagates a missing backend", async () => {
    const { r } = runner("remote", true);
    await expect(
      r.run({ resource: "x", op: "read", remote: () => Promise.reject(ERRORS["42P01"].error), mock: () => 1 }),
    ).rejects.toMatchObject({ code: "BACKEND_MISSING" });
  });

  it("latches a missing backend per resource and logs once", async () => {
    const { r, log } = runner("auto", true);
    const remote = jest.fn(() => Promise.reject(ERRORS.PGRST205.error));
    await r.run({ resource: "stores", op: "read", remote, mock: () => 1 });
    await r.run({ resource: "stores", op: "read", remote, mock: () => 1 });
    await r.run({ resource: "stores", op: "read", remote, mock: () => 1 });
    expect(remote).toHaveBeenCalledTimes(1);
    expect(r.isLatched("stores")).toBe(true);
    expect(r.isLatched("catalog")).toBe(false);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("does not latch on network errors", async () => {
    const { r, log } = runner("auto", true);
    const remote = jest.fn(() => Promise.reject(ERRORS.network.error));
    await r.run({ resource: "stores", op: "read", remote, mock: () => 1 });
    await r.run({ resource: "stores", op: "read", remote, mock: () => 1 });
    expect(remote).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("auth-required calls without a session: mock in dev, NOT_AUTHENTICATED in production", async () => {
    const remote = jest.fn(() => Promise.resolve("remote"));
    const dev = runner("auto", true, false).r;
    await expect(dev.run({ resource: "orders", op: "write", requiresAuth: true, remote, mock: () => "mock" })).resolves.toBe(
      "mock",
    );
    const prod = runner("auto", false, false).r;
    await expect(
      prod.run({ resource: "orders", op: "write", requiresAuth: true, remote, mock: () => "mock" }),
    ).rejects.toMatchObject({ code: "NOT_AUTHENTICATED" });
    expect(remote).not.toHaveBeenCalled();
  });

  it("returns remote data when it works", async () => {
    const { r } = runner("auto", true);
    await expect(
      r.run({ resource: "stores", op: "read", remote: () => Promise.resolve("remote"), mock: () => "mock" }),
    ).resolves.toBe("remote");
  });
});
