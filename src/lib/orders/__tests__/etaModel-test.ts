import { computeEta, type EtaInput, rideMins } from "../etaModel";

const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 28, 10, 0);

function input(over: Partial<EtaInput> = {}): EtaInput {
  return {
    status: "pending",
    now: T0,
    distanceKm: 2,
    prepMins: [10, 15],
    acceptedAt: null,
    readyBy: null,
    pickedUpAt: null,
    riderToStoreKm: null,
    riderToDropKm: null,
    promisedTo: null,
    ...over,
  };
}

function win(over: Partial<EtaInput>) {
  const eta = computeEta(input(over));
  if (eta.kind !== "window") throw new Error(`expected window, got ${eta.kind}`);
  return { ...eta, fromMin: (eta.from - T0) / MIN, toMin: (eta.to - T0) / MIN };
}

describe("rideMins", () => {
  test("2 km straight line ~ 6.75-10.1 min on the road", () => {
    const [lo, hi] = rideMins(2);
    expect(lo).toBeCloseTo(6.75);
    expect(hi).toBeCloseTo(10.125);
  });
});

describe("pending", () => {
  test("a duration in 5-min steps, never a clock time", () => {
    const eta = computeEta(input());
    // lo 2 + 10 + 6.75 + 2 = 20.75 -> 20; hi 5 + 15 + 10.1 + 4 = 34.1 -> 35.
    expect(eta).toEqual({ kind: "duration", mins: [20, 35] });
  });
});

describe("accepted / preparing", () => {
  test("anchored on the vendor's ready_by plus slack", () => {
    const w = win({ status: "preparing", acceptedAt: T0, readyBy: T0 + 15 * MIN });
    // from 15 + 6.75 + 2 = 23.75 -> 23; to 20 + 10.1 + 4 = 34.1 -> 35.
    expect([w.fromMin, w.toMin]).toEqual([23, 35]);
    expect(w.basis).toBe("store");
  });

  test("a far-away rider pushes the departure later than ready_by", () => {
    const w = win({ status: "preparing", readyBy: T0 + 5 * MIN, riderToStoreKm: 4 });
    // rider 13.5-20.25 min beats ready 5 min.
    expect(w.fromMin).toBeGreaterThanOrEqual(13.5 + 6.75 + 2 - 1);
  });

  test("late once the new window ends after the promise", () => {
    expect(win({ status: "preparing", readyBy: T0 + 30 * MIN, promisedTo: T0 + 35 * MIN }).late).toBe(true);
    expect(win({ status: "preparing", readyBy: T0 + 15 * MIN, promisedTo: T0 + 35 * MIN }).late).toBe(false);
  });

  test("never in the past when the kitchen ran over", () => {
    const w = win({ status: "preparing", readyBy: T0 - 30 * MIN });
    expect(w.fromMin).toBeGreaterThanOrEqual(0);
    expect(w.toMin - w.fromMin).toBeGreaterThanOrEqual(5);
  });
});

describe("ready / out for delivery", () => {
  test("ready: rider to store + ride", () => {
    const w = win({ status: "ready" });
    expect([w.fromMin, w.toMin]).toEqual([11, 23]);
  });

  test("on the way with a live rider position", () => {
    const w = win({ status: "out_for_delivery", riderToDropKm: 1 });
    expect(w.basis).toBe("rider");
    expect([w.fromMin, w.toMin]).toEqual([5, 10]);
  });

  test("on the way without a fix: from the pickup time", () => {
    const w = win({ status: "out_for_delivery", pickedUpAt: T0 - 5 * MIN });
    expect(w.basis).toBe("store");
    expect(w.fromMin).toBe(3);
  });
});

describe("ended", () => {
  test.each(["delivered", "rejected", "cancelled"] as const)("%s has no estimate", (status) => {
    expect(computeEta(input({ status }))).toEqual({ kind: "none" });
  });
});
