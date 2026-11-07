import { ORDER_STATUSES } from "../orderPlaced";
import {
  arrivalText,
  canCancel,
  cancelErrorMessage,
  curvedPath,
  acceptDeadlineText,
  dropoffByText,
  etaLabels,
  formatClock,
  isRealPoint,
  isTerminal,
  stepIndex,
  trackingCopy,
} from "../orderTracking";

describe("canCancel", () => {
  test("only while waiting for the store", () => {
    expect(ORDER_STATUSES.filter(canCancel)).toEqual(["pending"]);
  });
});

describe("trackingCopy", () => {
  test("every status has a title and banner", () => {
    for (const s of ORDER_STATUSES) {
      const c = trackingCopy(s, "KFC");
      expect(c.title).not.toBe("");
      expect(c.banner).not.toBe("");
    }
  });
  test("pending tells the user they can still cancel", () => {
    expect(trackingCopy("pending", "KFC").banner).toMatch(/KFC.*cancel/);
  });
  test("falls back when the vendor name is blank", () => {
    expect(trackingCopy("accepted", "  ").banner).toBe("The store accepted your order");
  });
  test("ended orders use the error tone", () => {
    expect(trackingCopy("rejected", "KFC").tone).toBe("error");
    expect(trackingCopy("cancelled", "KFC").tone).toBe("error");
  });
});

describe("stepIndex / isTerminal", () => {
  test("progress follows the lifecycle", () => {
    expect(stepIndex("pending")).toBe(-1);
    expect(stepIndex("accepted")).toBe(0);
    expect(stepIndex("ready")).toBe(1);
    expect(stepIndex("out_for_delivery")).toBe(2);
    expect(stepIndex("delivered")).toBe(3);
    expect(stepIndex("cancelled")).toBeNull();
  });
  test("terminal statuses", () => {
    expect(ORDER_STATUSES.filter(isTerminal)).toEqual(["delivered", "rejected", "cancelled"]);
  });
});

describe("arrivalText", () => {
  const created = new Date(2026, 9, 28, 10, 15).toISOString();
  test("window from placement time + ETA", () => {
    expect(arrivalText(created, [30, 35], "preparing")).toBe("Arriving at 10:45 AM \u2013 10:50 AM");
  });
  test("single time when min == max", () => {
    expect(arrivalText(created, [30, 30], "pending")).toBe("Arriving at 10:45 AM");
  });
  test("null without ETA, with a bad date, or once the order ended", () => {
    expect(arrivalText(created, null, "pending")).toBeNull();
    expect(arrivalText("nope", [30, 35], "pending")).toBeNull();
    expect(arrivalText(created, [30, 35], "delivered")).toBeNull();
  });
  test("formatClock handles noon and midnight", () => {
    expect(formatClock(new Date(2026, 0, 1, 0, 5))).toBe("12:05 AM");
    expect(formatClock(new Date(2026, 0, 1, 12, 0))).toBe("12:00 PM");
  });
});

describe("dropoffByText", () => {
  const created = new Date(2026, 9, 28, 10, 15).toISOString();
  test("placement time + upper ETA", () => {
    expect(dropoffByText(created, [30, 35], "pending")).toBe("10:50 AM");
  });
  test("null without ETA or after the order ended", () => {
    expect(dropoffByText(created, null, "pending")).toBeNull();
    expect(dropoffByText(created, [30, 35], "cancelled")).toBeNull();
  });
});

describe("isRealPoint", () => {
  test("rejects the 0,0 placeholder and out-of-range values", () => {
    expect(isRealPoint({ latitude: 5.6, longitude: -0.18 })).toBe(true);
    expect(isRealPoint({ latitude: 0, longitude: 0 })).toBe(false);
    expect(isRealPoint({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isRealPoint({ latitude: Number.NaN, longitude: 1 })).toBe(false);
    expect(isRealPoint(null)).toBe(false);
  });
});

describe("curvedPath", () => {
  const a = { latitude: 5.6, longitude: -0.2 };
  const b = { latitude: 5.7, longitude: -0.1 };
  test("starts at a, ends at b, with segments + 1 points", () => {
    const p = curvedPath(a, b, 10);
    expect(p).toHaveLength(11);
    expect(p[0]).toEqual(a);
    expect(p[10].latitude).toBeCloseTo(b.latitude);
    expect(p[10].longitude).toBeCloseTo(b.longitude);
  });
  test("bends away from the straight line", () => {
    const mid = curvedPath(a, b, 10)[5];
    // Straight midpoint would be (5.65, -0.15).
    expect(Math.abs(mid.latitude - 5.65) + Math.abs(mid.longitude + 0.15)).toBeGreaterThan(0.005);
  });
});

describe("cancelErrorMessage", () => {
  test("a race with the store explains it was accepted", () => {
    expect(cancelErrorMessage("STALE_VERSION")).toMatch(/already accepted/);
    expect(cancelErrorMessage("NOT_CANCELLABLE")).toMatch(/already accepted/);
  });
});

describe("trackingCopy with live data", () => {
  test("names the real rider by stage", () => {
    expect(trackingCopy("preparing", "KFC", { rider: "Ama" }).banner).toBe("Ama is heading to KFC");
    expect(trackingCopy("ready", "KFC", { rider: "Ama" }).banner).toBe("Ama is picking up your order");
    expect(trackingCopy("out_for_delivery", "KFC", { rider: "Ama" }).banner).toBe("Ama is on the way to you");
  });
  test("no rider name without a rider", () => {
    expect(trackingCopy("preparing", "KFC").banner).toBe("KFC is preparing your order");
  });
  test("explains an accept timeout", () => {
    expect(trackingCopy("rejected", "KFC", { rejectReason: "no_response" }).banner).toMatch(/didn't respond.*won't be charged/);
  });
});

describe("etaLabels", () => {
  const at = (h: number, m: number) => new Date(2026, 9, 28, h, m).getTime();
  test("duration before accept", () => {
    expect(etaLabels({ kind: "duration", mins: [25, 35] }).arrival).toBe("About 25\u201335 min once the store accepts");
  });
  test("window and map bubble", () => {
    const l = etaLabels({ kind: "window", from: at(10, 45), to: at(10, 50), basis: "store", late: false });
    expect(l.arrival).toBe("Arriving at 10:45 AM \u2013 10:50 AM");
    expect(l.dropoffBy).toBe("10:50 AM");
  });
  test("running late", () => {
    const l = etaLabels({ kind: "window", from: at(11, 5), to: at(11, 10), basis: "store", late: true });
    expect(l.arrival).toBe("Running late \u00b7 now 11:05 AM \u2013 11:10 AM");
    expect(l.late).toBe(true);
  });
  test("accept deadline only while in the future", () => {
    expect(acceptDeadlineText(at(10, 23), at(10, 20))).toBe("The store has until 10:23 AM to accept");
    expect(acceptDeadlineText(at(10, 23), at(10, 30))).toBeNull();
  });
});