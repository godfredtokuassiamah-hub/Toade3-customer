/// <reference types="jest" />
import { resetClientLimitsForTests } from "../../lib/security/clientLimits";
import { clearPlacesCache, PlacesError, reverseGeocode, searchPlaces } from "../places";

const ok = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const fail = (status: number, retryAfter?: string) =>
  Promise.resolve({
    ok: false,
    status,
    headers: { get: (name: string) => (name === "Retry-After" ? (retryAfter ?? null) : null) },
    json: () => Promise.resolve({}),
  });

const fetchMock = jest.fn();
const realFetch = globalThis.fetch;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  clearPlacesCache();
  resetClientLimitsForTests();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  jest.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

describe("places retry on 429 / 503", () => {
  test("429 then 200: one retry, after the Retry-After delay", async () => {
    fetchMock.mockReturnValueOnce(fail(429, "2")).mockReturnValueOnce(ok({ features: [] }));
    const p = searchPlaces("Legon");
    await jest.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("503 is retried; gives up after 3 attempts with PlacesError", async () => {
    fetchMock.mockImplementation(() => fail(503));
    const p = searchPlaces("Legon").catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(20_000);
    const err = await p;
    expect(err).toBeInstanceOf(PlacesError);
    expect((err as PlacesError).status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("Retry-After is capped at 10 s", async () => {
    fetchMock.mockReturnValueOnce(fail(429, "3600")).mockReturnValueOnce(ok({ features: [] }));
    const p = reverseGeocode(5.6, -0.18);
    await jest.advanceTimersByTimeAsync(10_000);
    await expect(p).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("500 is not retried", async () => {
    fetchMock.mockReturnValueOnce(fail(500));
    await expect(searchPlaces("Legon")).rejects.toBeInstanceOf(PlacesError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("network failure is not retried", async () => {
    fetchMock.mockReturnValueOnce(Promise.reject(new TypeError("Network request failed")));
    await expect(searchPlaces("Legon")).rejects.toBeInstanceOf(PlacesError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("an abort during the backoff wait -> AbortError, no further request", async () => {
    fetchMock.mockReturnValueOnce(fail(429, "5"));
    const controller = new AbortController();
    const p = searchPlaces("Legon", { signal: controller.signal }).catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(100);
    controller.abort();
    const err = await p;
    expect((err as Error).name).toBe("AbortError");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("places client bucket", () => {
  test("20 requests in a burst, the 21st is refused without a fetch", async () => {
    fetchMock.mockImplementation(() => ok({ features: [] }));
    for (let i = 0; i < 20; i++) await searchPlaces(`Street ${i}`);
    await expect(searchPlaces("Street 99")).rejects.toMatchObject({ name: "PlacesError", message: "Rate limited" });
    expect(fetchMock).toHaveBeenCalledTimes(20);
    // Refills one request every 500 ms.
    jest.setSystemTime(Date.now() + 500);
    await searchPlaces("Street 100");
    expect(fetchMock).toHaveBeenCalledTimes(21);
  });

  test("cached results don't use the bucket", async () => {
    fetchMock.mockImplementation(() => ok({ features: [] }));
    for (let i = 0; i < 25; i++) await searchPlaces("Legon");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
