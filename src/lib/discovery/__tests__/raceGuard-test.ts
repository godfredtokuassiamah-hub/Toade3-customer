/// <reference types="jest" />
import { createRequestTracker } from "../raceGuard";

describe("race guard", () => {
  test("an out-of-order (older) response is rejected", () => {
    const t = createRequestTracker();
    const first = t.next("fp-a", 1);
    const second = t.next("fp-b", 1);
    const current = { fingerprint: "fp-b", contextRevision: 1 };
    // The older request resolves last: rejected even though it wasn't aborted.
    expect(t.accept(first, 1, current)).toBe(false);
    expect(t.accept(second, 1, current)).toBe(true);
  });

  test("fingerprint or context revision mismatch is rejected", () => {
    const t = createRequestTracker();
    const tok = t.next("fp-a", 1);
    expect(t.accept(tok, 1, { fingerprint: "fp-x", contextRevision: 1 })).toBe(false);
    expect(t.accept(tok, 1, { fingerprint: "fp-a", contextRevision: 2 })).toBe(false);
    expect(t.accept(tok, 2, { fingerprint: "fp-a", contextRevision: 1 })).toBe(false);
    expect(t.accept(tok, 1, { fingerprint: "fp-a", contextRevision: 1 })).toBe(true);
  });

  test("invalidate drops the pending request", () => {
    const t = createRequestTracker();
    const tok = t.next("fp-a", 1);
    t.invalidate();
    expect(t.accept(tok, 1, { fingerprint: "fp-a", contextRevision: 1 })).toBe(false);
  });
});
