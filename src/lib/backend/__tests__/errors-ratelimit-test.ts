/// <reference types="jest" />
import { classifyAuthError, RATE_LIMIT_MESSAGE } from "../../auth/authErrors";
import { retryDelay, shouldRetry } from "../queryClient";
import {
  BackendError,
  friendlyOrderMessage,
  isBusinessError,
  mapBackendError,
  RATE_LIMIT_CODE,
  SQLSTATE_BY_CODE,
} from "../errors";
import { decideFallback } from "../fallback";
import { outcomeForError } from "../idempotency";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@react-native-community/netinfo", () => ({ addEventListener: jest.fn(() => () => {}) }));

describe("mapBackendError -> RATE_LIMITED", () => {
  test.each([
    ["HTTP 429", { code: "", message: "Too Many Requests" }, 429],
    ["T3429 body", { code: RATE_LIMIT_CODE, message: "RATE_LIMITED", details: '{"retry_after":9}' }, 429],
    ["T3429 without status", { code: RATE_LIMIT_CODE, message: "RATE_LIMITED" }, undefined],
    ["PT429", { code: "PT429", message: "Too Many Requests" }, undefined],
    ["message only", { message: "RATE_LIMITED" }, undefined],
  ])("%s", (_label, payload, status) => {
    const err = mapBackendError(payload, status);
    expect(err).toBeInstanceOf(BackendError);
    expect(err.code).toBe("RATE_LIMITED");
  });

  test("keeps details for the Retry-After hint", () => {
    const err = mapBackendError({ code: RATE_LIMIT_CODE, message: "RATE_LIMITED", details: '{"retry_after":9}' }, 429);
    expect(err.details).toBe('{"retry_after":9}');
    expect(err.status).toBe(429);
  });

  test("business codes still map as before", () => {
    expect(mapBackendError({ code: "T3010", message: "INVALID_INPUT" }, 400).code).toBe("INVALID_INPUT");
  });
});

describe("RATE_LIMITED semantics", () => {
  test("is not a business code and has no SQLSTATE entry", () => {
    expect(isBusinessError("RATE_LIMITED")).toBe(false);
    expect(Object.values(SQLSTATE_BY_CODE)).not.toContain(RATE_LIMIT_CODE);
  });

  test("checkout keeps the idempotency key (retryable outcome)", () => {
    expect(outcomeForError("RATE_LIMITED")).toBe("retryable");
  });

  test("never falls back to mock data", () => {
    for (const op of ["read", "write"] as const) {
      expect(decideFallback("RATE_LIMITED", { mode: "auto", isDev: true, op })).toBe("throw");
    }
  });

  test("queries never auto-retry it", () => {
    expect(shouldRetry(0, { code: RATE_LIMIT_CODE, message: "RATE_LIMITED" })).toBe(false);
    expect(shouldRetry(0, { code: "", message: "Network request failed" })).toBe(true);
  });

  test("checkout copy is the shared rate-limit message", () => {
    expect(friendlyOrderMessage("RATE_LIMITED")).toBe(RATE_LIMIT_MESSAGE);
    expect(RATE_LIMIT_MESSAGE).toBe("Too many attempts. Please wait a minute and try again.");
  });

  test("auth classification also recognises the DB limiter shape", () => {
    expect(classifyAuthError({ code: RATE_LIMIT_CODE, message: "RATE_LIMITED" })).toBe("rate_limited");
  });
});

describe("retryDelay (jittered)", () => {
  test("stays within [0, min(8000, 1000 * 2^attempt))", () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      for (let i = 0; i < 50; i++) {
        const d = retryDelay(attempt);
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThan(Math.min(8000, 1000 * 2 ** attempt));
      }
    }
  });
});
