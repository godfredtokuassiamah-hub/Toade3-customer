/// <reference types="jest" />
import {
  clearPlacesCache,
  PlacesError,
  reverseGeocode,
  searchPlaces,
} from "../places";

const FEATURE = {
  type: "Feature",
  geometry: { type: "Point", coordinates: [-0.1223785, 5.7112394] },
  properties: {
    osm_type: "W",
    osm_id: 315869534,
    name: "University Avenue",
    state: "Greater Accra Region",
    country: "Ghana",
  },
};

const ok = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

const fetchMock = jest.fn();
const realFetch = globalThis.fetch;

beforeEach(() => {
  clearPlacesCache();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

const lastUrl = () => String(fetchMock.mock.calls.at(-1)?.[0]);

describe("searchPlaces", () => {
  test("fewer than 3 chars -> [] without a request", async () => {
    await expect(searchPlaces("  ab ")).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("builds the Photon URL with the Accra bias by default", async () => {
    fetchMock.mockReturnValueOnce(ok({ features: [FEATURE] }));
    const out = await searchPlaces("University Avenue");
    const url = lastUrl();
    expect(url.startsWith("https://photon.komoot.io/api/?")).toBe(true);
    expect(url).toContain("q=University%20Avenue");
    expect(url).toContain("limit=6");
    expect(url).toContain("lang=en");
    expect(url).toContain("lat=5.6037");
    expect(url).toContain("lon=-0.187");
    expect(url).not.toContain("bbox");
    expect(url).not.toContain("countrycode");
    expect(out[0].title).toBe("University Avenue");
  });

  test("sends Accept and a descriptive User-Agent on native", async () => {
    fetchMock.mockReturnValueOnce(ok({ features: [] }));
    await searchPlaces("Legon");
    const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers.Accept).toBe("application/json");
    expect(init.headers["User-Agent"]).toMatch(/^Toade3-Customer\//);
  });

  test("uses a custom bias", async () => {
    fetchMock.mockReturnValueOnce(ok({ features: [] }));
    await searchPlaces("Legon", { bias: { lat: 6.6885, lng: -1.6244 } });
    expect(lastUrl()).toContain("lat=6.6885");
    expect(lastUrl()).toContain("lon=-1.6244");
  });

  test("serves a repeated query from the cache", async () => {
    fetchMock.mockReturnValueOnce(ok({ features: [FEATURE] }));
    const a = await searchPlaces("University Avenue");
    const b = await searchPlaces("university avenue ");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(b).toEqual(a);
  });

  test("non-OK response -> PlacesError (not cached)", async () => {
    fetchMock.mockReturnValueOnce(
      Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }),
    );
    await expect(searchPlaces("Legon")).rejects.toBeInstanceOf(PlacesError);
    fetchMock.mockReturnValueOnce(ok({ features: [] }));
    await expect(searchPlaces("Legon")).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("invalid JSON -> PlacesError", async () => {
    fetchMock.mockReturnValueOnce(
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError("bad")),
      }),
    );
    await expect(searchPlaces("Legon")).rejects.toBeInstanceOf(PlacesError);
  });

  test("network failure -> PlacesError", async () => {
    fetchMock.mockReturnValueOnce(Promise.reject(new TypeError("Network request failed")));
    await expect(searchPlaces("Legon")).rejects.toBeInstanceOf(PlacesError);
  });

  test("aborted signal -> AbortError, not PlacesError", async () => {
    const controller = new AbortController();
    controller.abort();
    const err = await searchPlaces("Legon", { signal: controller.signal }).catch(
      (e: unknown) => e,
    );
    expect((err as Error).name).toBe("AbortError");
    expect(err).not.toBeInstanceOf(PlacesError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("abort during the request -> AbortError", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementationOnce(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            const e = new Error("Aborted");
            e.name = "AbortError";
            reject(e);
          });
        }),
    );
    const p = searchPlaces("Legon", { signal: controller.signal });
    controller.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("reverseGeocode", () => {
  test("calls /reverse and returns the first mapped feature", async () => {
    fetchMock.mockReturnValueOnce(ok({ features: [FEATURE] }));
    const s = await reverseGeocode(5.65051234, -0.18621234);
    expect(lastUrl()).toBe(
      "https://photon.komoot.io/reverse?lat=5.6505&lon=-0.1862&limit=1&lang=en",
    );
    expect(s?.id).toBe("photon:W315869534");
  });

  test("empty result -> null", async () => {
    fetchMock.mockReturnValueOnce(ok({ features: [] }));
    await expect(reverseGeocode(0, 0)).resolves.toBeNull();
  });
});

describe("EXPO_PUBLIC_PLACES_BASE_URL", () => {
  const original = process.env.EXPO_PUBLIC_PLACES_BASE_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_PLACES_BASE_URL;
    else process.env.EXPO_PUBLIC_PLACES_BASE_URL = original;
  });

  test("overrides the base URL (trailing slash trimmed)", async () => {
    process.env.EXPO_PUBLIC_PLACES_BASE_URL = "https://geo.example.com/";
    let mod: typeof import("../places") | undefined;
    jest.isolateModules(() => {
      // Fresh module instance so the env var is read again at load time.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require("../places") as typeof import("../places");
    });
    expect(mod?.PLACES_BASE_URL).toBe("https://geo.example.com");
    fetchMock.mockReturnValueOnce(ok({ features: [] }));
    await mod?.searchPlaces("Legon");
    expect(lastUrl().startsWith("https://geo.example.com/api/?")).toBe(true);
  });
});
