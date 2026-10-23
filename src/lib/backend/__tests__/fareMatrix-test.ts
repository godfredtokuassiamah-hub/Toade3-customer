/// <reference types="jest" />
// The client fee calculator and the SQL quote_delivery / place_order fare
// matrix must agree. Both are checked against one shared fixture; the SQL
// constants are parsed from the FARE_MATRIX_BEGIN/END block of 0007.
import {
  deliveryFeeMinor,
  MAX_PAYLOAD_G,
  priceDistanceKm,
  zoneFor,
} from "../../stores/deliveryQuote";
import { SERVICE_CHARGE_MINOR } from "../../cart/checkoutTotals";
import fixture from "../__fixtures__/fareMatrix.json";
import { fs, repoPath } from "../__fixtures__/nodeFs";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

type Zone = (typeof fixture.zones)[number];

const sql = fs.readFileSync(repoPath("supabase/migrations/0007_order_functions.sql"), "utf8");
const block = (() => {
  const start = sql.indexOf("-- FARE_MATRIX_BEGIN");
  const end = sql.indexOf("-- FARE_MATRIX_END");
  if (start < 0 || end < start) throw new Error("FARE_MATRIX block missing in 0007");
  return sql.slice(start, end);
})();

// Mirror of public.t3_fare_for_tenths + t3_price_tenths, driven by the
// numbers parsed out of the SQL.
const sqlZones = [...block.matchAll(/\(\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/g)].map(
  (m) => ({
    zone: Number(m[1]),
    maxTenths: Number(m[2]),
    feeBase: Number(m[3]),
    perTenth: Number(m[4]),
    etaMin: Number(m[5]),
    etaMax: Number(m[6]),
  }),
);
const overFrom = Number(/greatest\(0, p_tenths - (\d+)\)/.exec(block)?.[1]);
const sqlPayload = Number(/t3_max_payload_g\(\)[\s\S]*?select (\d+)/.exec(block)?.[1]);
const sqlService = Number(/t3_service_fee_minor\(\)[\s\S]*?select (\d+)/.exec(block)?.[1]);
const sqlEpsilon = /ceil\(p_km \* 10 - 1e-9\)/.test(sql);

function sqlFee(km: number): number | null {
  const tenths = Math.max(0, Math.ceil(km * 10 - 1e-9));
  const z = sqlZones.find((s) => tenths >= 0 && tenths <= s.maxTenths);
  if (!z) return null;
  return z.feeBase + z.perTenth * Math.max(0, tenths - overFrom);
}

describe("fare matrix: SQL constants == fixture", () => {
  it("parses four zones", () => {
    expect(sqlZones).toHaveLength(fixture.zones.length);
  });

  it.each(fixture.zones)("zone $id", (z: Zone) => {
    const s = sqlZones.find((x) => x.zone === z.id);
    expect(s).toBeDefined();
    expect(s?.maxTenths).toBe(z.maxTenths);
    expect(s?.feeBase).toBe(z.feeMinor);
    expect(s?.perTenth).toBe("perTenthOver40Minor" in z ? z.perTenthOver40Minor : 0);
    expect([s?.etaMin, s?.etaMax]).toEqual(z.etaMins);
  });

  it("over-40 offset, payload, service fee and rounding", () => {
    expect(overFrom).toBe(40);
    expect(sqlPayload).toBe(fixture.maxPayloadG);
    expect(sqlService).toBe(fixture.serviceFeeMinor);
    expect(sqlEpsilon).toBe(true);
  });
});

describe("fare matrix: TS calculator == fixture", () => {
  it.each(fixture.zones)("zone $id bounds and eta", (z: Zone) => {
    const zone = zoneFor(z.maxTenths / 10);
    expect(zone?.id).toBe(z.id);
    expect(zone?.maxTenths).toBe(z.maxTenths);
    expect(zone?.etaMins).toEqual(z.etaMins);
  });

  it("service fee and payload", () => {
    expect(SERVICE_CHARGE_MINOR).toBe(fixture.serviceFeeMinor);
    expect(MAX_PAYLOAD_G).toBe(fixture.maxPayloadG);
  });
});

describe("fare matrix: boundary cases agree (TS vs SQL mirror)", () => {
  it.each(fixture.cases)("$km km -> $priceKm km -> $feeMinor", (c) => {
    const priceKm = priceDistanceKm(c.km);
    expect(priceKm).toBeCloseTo(c.priceKm, 10);
    expect(deliveryFeeMinor(priceKm)).toBe(c.feeMinor);
    expect(sqlFee(c.km)).toBe(c.feeMinor);
    if (c.feeMinor == null) expect(c.error).toBe("OUT_OF_RADIUS");
  });
});
