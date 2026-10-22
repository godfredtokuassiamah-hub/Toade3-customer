import {
  DEFAULT_DROPOFF,
  deliveryFeeMinor,
  etaRange,
  formatEtaRange,
  haversineKm,
  priceDistanceKm,
  quoteDelivery,
  zoneFor,
} from "../deliveryQuote";

describe("haversineKm", () => {
  it("is ~111.19 km per degree on the equator and 0 for the same point", () => {
    expect(haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(
      111.19,
      1,
    );
    expect(haversineKm(DEFAULT_DROPOFF, DEFAULT_DROPOFF)).toBe(0);
  });
});

describe("priceDistanceKm", () => {
  it("rounds up to 0.1 km and keeps exact tenths", () => {
    expect(priceDistanceKm(1.04)).toBe(1.1);
    expect(priceDistanceKm(2.55)).toBe(2.6);
    expect(priceDistanceKm(1.0)).toBe(1.0);
    expect(priceDistanceKm(0.3)).toBe(0.3);
    expect(priceDistanceKm(0.01)).toBe(0.1);
    expect(priceDistanceKm(0)).toBe(0);
    expect(priceDistanceKm(5.01)).toBe(5.1);
  });
});

describe("zones and fees (pesewas)", () => {
  it.each([
    [0.4, 500],
    [1.0, 500],
    [priceDistanceKm(1.04), 800],
    [2.5, 800],
    [priceDistanceKm(2.55), 1200],
    [4.0, 1200],
    [4.1, 1225],
    [4.5, 1325],
    [5.0, 1450],
  ])("%p km -> %p", (km, fee) => {
    expect(deliveryFeeMinor(km)).toBe(fee);
  });

  it("is not deliverable over 5.0 km", () => {
    expect(zoneFor(priceDistanceKm(5.01))).toBeNull();
    expect(deliveryFeeMinor(priceDistanceKm(5.01))).toBeNull();
  });

  it("maps boundaries to the right zone", () => {
    expect(zoneFor(1.0)?.id).toBe(1);
    expect(zoneFor(1.1)?.id).toBe(2);
    expect(zoneFor(2.6)?.id).toBe(3);
    expect(zoneFor(4.1)?.id).toBe(4);
  });
});

describe("eta range", () => {
  it("adds prep min/max to the zone min/max", () => {
    const zone = zoneFor(1.5);
    if (!zone) throw new Error("zone expected");
    expect(etaRange([5, 10], zone)).toEqual([20, 35]);
    expect(formatEtaRange([20, 35])).toBe("20-35 min");
  });
});

describe("quoteDelivery", () => {
  it("quotes a nearby store and refuses a far one", () => {
    const near = quoteDelivery({ ...DEFAULT_DROPOFF, prepMins: [10, 15] }, DEFAULT_DROPOFF);
    expect(near).toEqual({ deliverable: true, distanceKm: 0, feeMinor: 500, etaMins: [20, 30] });
    // ~6.7 km north.
    const far = quoteDelivery(
      { latitude: DEFAULT_DROPOFF.latitude + 0.06, longitude: DEFAULT_DROPOFF.longitude, prepMins: [5, 10] },
      DEFAULT_DROPOFF,
    );
    expect(far.deliverable).toBe(false);
  });
});
