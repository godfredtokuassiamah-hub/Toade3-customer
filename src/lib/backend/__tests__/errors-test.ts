/// <reference types="jest" />
import {
  BackendError,
  friendlyOrderMessage,
  isBusinessError,
  mapBackendError,
  SQLSTATE_BY_CODE,
} from "../errors";

describe("mapBackendError", () => {
  it("maps every business code from the exception message", () => {
    for (const [code, sqlstate] of Object.entries(SQLSTATE_BY_CODE)) {
      const err = mapBackendError({ code: sqlstate, message: code, details: "{}" }, 400);
      expect(err.code).toBe(code);
      expect(err.rawCode).toBe(sqlstate);
      expect(isBusinessError(err.code)).toBe(true);
    }
  });

  it("maps a business code from the SQLSTATE alone", () => {
    expect(mapBackendError({ code: "T3006", message: "something else" }).code).toBe("OUT_OF_RADIUS");
    expect(mapBackendError({ code: "T3008", message: "" }).code).toBe("STALE_VERSION");
  });

  it("keeps details for the caller", () => {
    const err = mapBackendError({ code: "T3006", message: "OUT_OF_RADIUS", details: '{"distance_km":5.1}' });
    expect(err.details).toBe('{"distance_km":5.1}');
  });

  it("maps a missing table / function to BACKEND_MISSING", () => {
    for (const code of ["42P01", "42883", "PGRST202", "PGRST205"]) {
      expect(mapBackendError({ code, message: "missing" }).code).toBe("BACKEND_MISSING");
    }
    expect(mapBackendError({ code: "", message: "Not found" }, 404).code).toBe("BACKEND_MISSING");
  });

  it("maps fetch failures to NETWORK", () => {
    // supabase-js returns transport failures as { code: "", status: 0 }.
    expect(mapBackendError({ code: "", message: "TypeError: Network request failed" }, 0).code).toBe(
      "NETWORK",
    );
    expect(mapBackendError(new TypeError("Network request failed")).code).toBe("NETWORK");
    const abort = new Error("Aborted");
    abort.name = "AbortError";
    expect(mapBackendError(abort).code).toBe("NETWORK");
    const fn = new Error("Failed to send a request");
    fn.name = "FunctionsFetchError";
    expect(mapBackendError(fn).code).toBe("NETWORK");
  });

  it("maps RLS / auth refusals to FORBIDDEN", () => {
    expect(mapBackendError({ code: "42501", message: "permission denied" }).code).toBe("FORBIDDEN");
    expect(mapBackendError({ code: "", message: "JWT expired" }, 401).code).toBe("FORBIDDEN");
  });

  it("maps anything else to UNKNOWN", () => {
    expect(mapBackendError({ code: "XX000", message: "boom" }, 500).code).toBe("UNKNOWN");
    expect(mapBackendError(new Error("boom")).code).toBe("UNKNOWN");
    expect(mapBackendError("boom").code).toBe("UNKNOWN");
    expect(mapBackendError(null).code).toBe("UNKNOWN");
  });

  it("passes BackendErrors through", () => {
    const e = new BackendError("OVER_WEIGHT", "OVER_WEIGHT");
    expect(mapBackendError(e)).toBe(e);
  });
});

describe("friendlyOrderMessage", () => {
  it("has the checkout copy", () => {
    expect(friendlyOrderMessage("ITEM_UNAVAILABLE")).toBe(
      "Some items are no longer available. Review your cart.",
    );
    expect(friendlyOrderMessage("OUT_OF_RADIUS")).toMatch(/deliver/);
    expect(friendlyOrderMessage("OVER_WEIGHT")).toMatch(/8 kg/);
    expect(friendlyOrderMessage("MIXED_VENDORS")).toMatch(/more than one store/);
    expect(friendlyOrderMessage("NETWORK")).toMatch(/connection/);
    expect(friendlyOrderMessage("UNKNOWN")).toBe("Something went wrong. Please try again.");
  });
});
