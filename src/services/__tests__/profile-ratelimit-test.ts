/// <reference types="jest" />
import { RATE_LIMIT_CODE } from "../../lib/backend/errors";
import { resetClientLimitsForTests } from "../../lib/security/clientLimits";
import { isRateLimitedError, RateLimitedError } from "../../lib/security/rateLimitError";
import { supabase } from "../../lib/supabase";
import { completeProfile, ProfileSaveError, saveAddress } from "../profile";

jest.mock("../../lib/supabase", () => {
  const maybeSingle = jest.fn();
  const query: Record<string, jest.Mock> = { maybeSingle };
  query.update = jest.fn(() => query);
  query.eq = jest.fn(() => query);
  query.select = jest.fn(() => query);
  return {
    supabase: {
      from: jest.fn(() => query),
      auth: {
        getSession: jest.fn(() =>
          Promise.resolve({ data: { session: { user: { id: "user-1" } } }, error: null }),
        ),
      },
      __query: query,
    },
  };
});

const query = (supabase as unknown as { __query: { update: jest.Mock; maybeSingle: jest.Mock } }).__query;
const OK = { data: { id: "user-1" }, error: null, status: 200 };
const INPUT = { fullName: "Ama Mensah", phone: "+233201234567", countryCode: "+233" };

beforeEach(() => {
  resetClientLimitsForTests();
  query.update.mockClear();
  query.maybeSingle.mockReset();
  query.maybeSingle.mockResolvedValue(OK);
  // Zero backoff delay (full jitter with random 0).
  jest.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("profile writes", () => {
  test("success: one PATCH", async () => {
    await completeProfile(INPUT);
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
  });

  test("server T3429 / 429 -> RateLimitedError (server) with the hint, not retried", async () => {
    query.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { code: RATE_LIMIT_CODE, message: "RATE_LIMITED", details: '{"action":"profile.write","retry_after":30}' },
      status: 429,
    });
    const err = await completeProfile(INPUT).catch((e: unknown) => e);
    expect(isRateLimitedError(err)).toBe(true);
    expect((err as RateLimitedError).source).toBe("server");
    expect((err as RateLimitedError).retryAfterMs).toBe(30_000);
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
  });

  test("network failures retry up to 3 attempts, then ProfileSaveError", async () => {
    query.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: "", message: "TypeError: Network request failed" },
      status: 0,
    });
    await expect(completeProfile(INPUT)).rejects.toBeInstanceOf(ProfileSaveError);
    expect(query.maybeSingle).toHaveBeenCalledTimes(3);
  });

  test("503 retries and can recover", async () => {
    query.maybeSingle
      .mockResolvedValueOnce({ data: null, error: { code: "", message: "Service Unavailable" }, status: 503 })
      .mockResolvedValueOnce(OK);
    await completeProfile(INPUT);
    expect(query.maybeSingle).toHaveBeenCalledTimes(2);
  });

  test("a 400 is not retried", async () => {
    query.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { code: "23514", message: "check constraint" },
      status: 400,
    });
    await expect(completeProfile(INPUT)).rejects.toBeInstanceOf(ProfileSaveError);
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
  });

  test("identical concurrent saves share one PATCH", async () => {
    await Promise.all([completeProfile(INPUT), completeProfile(INPUT)]);
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
  });

  test("client bucket: 3 quick saves, the 4th is refused without a request", async () => {
    for (let i = 0; i < 3; i++) {
      await saveAddress({ label: `Street ${i}`, fullAddress: "", lat: 5.6, lng: -0.18, placeId: "p", details: null });
    }
    const err = await saveAddress({
      label: "Street 9",
      fullAddress: "",
      lat: 5.6,
      lng: -0.18,
      placeId: "p",
      details: null,
    }).catch((e: unknown) => e);
    expect(isRateLimitedError(err)).toBe(true);
    expect((err as RateLimitedError).source).toBe("client");
    expect(query.maybeSingle).toHaveBeenCalledTimes(3);
  });

  test("no row -> ProfileSaveError", async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null, status: 200 });
    await expect(completeProfile(INPUT)).rejects.toBeInstanceOf(ProfileSaveError);
  });
});
