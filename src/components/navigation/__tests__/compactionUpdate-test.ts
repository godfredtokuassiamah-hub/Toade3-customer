// TypeScript 6 no longer auto-includes @types/*, so pull in jest globals here.
/// <reference types="jest" />
import {
  type CompactionState,
  nextCompactionState,
} from "../scrollCompaction";

// Regression test for the Home scroll worklet's data flow after the
// object-shared-value fix. The worklet no longer persists a CompactionState
// object in a shared value; it holds `compact`/`travel` as PRIMITIVE shared
// values, reads them into a throwaway object each frame, calls the unchanged
// pure `nextCompactionState`, then writes the primitive fields back
// individually, driving `progress` only when the compact state flips.
//
// This models those primitive shared values as plain cells and reproduces the
// exact update step, so the primitive read -> reduce -> write-back flow and the
// "progress changes only on a compact transition" rule stay locked. It is a
// pure-function test — no Reanimated shared values involved.

type PrimitiveStore = {
  compact: boolean;
  travel: number;
};

// Mirrors the `onScroll` worklet body: read the two primitives into a
// throwaway object, reduce, write back individually. Returns whether the
// compact state flipped (the condition that drives `progress` withTiming).
function applyScrollStep(
  store: PrimitiveStore,
  offsetY: number,
  deltaY: number,
): { compactChanged: boolean } {
  const prev: CompactionState = { compact: store.compact, travel: store.travel };
  const next = nextCompactionState(prev, offsetY, deltaY);
  let compactChanged = false;
  if (next.compact !== prev.compact) {
    store.compact = next.compact;
    compactChanged = true;
  }
  if (next.travel !== prev.travel) {
    store.travel = next.travel;
  }
  return { compactChanged };
}

// Well below NEAR_TOP so only travel decides (matches scrollCompaction-test).
const START = 500;

// Drives the primitive store through a sequence of deltas, tracking the offset
// the way the scroll handler does, and records every compact-state flip.
function run(
  initial: PrimitiveStore,
  deltas: number[],
): { store: PrimitiveStore; flips: number } {
  const store: PrimitiveStore = { ...initial };
  let offset = START;
  let flips = 0;
  for (const delta of deltas) {
    offset += delta;
    const { compactChanged } = applyScrollStep(store, offset, delta);
    if (compactChanged) flips += 1;
  }
  return { store, flips };
}

describe("home scroll compaction update step (primitive write-back)", () => {
  test("primitive write-back tracks nextCompactionState after 48 down", () => {
    const { store, flips } = run({ compact: false, travel: 0 }, [48]);
    expect(store).toEqual({ compact: true, travel: 0 });
    expect(flips).toBe(1);
  });

  test("47 down leaves primitives expanded with no compact flip", () => {
    const { store, flips } = run({ compact: false, travel: 0 }, [47]);
    expect(store.compact).toBe(false);
    expect(store.travel).toBe(47);
    expect(flips).toBe(0);
  });

  test("compact then 20 up expands and flips once", () => {
    const { store, flips } = run({ compact: true, travel: 0 }, [-20]);
    expect(store).toEqual({ compact: false, travel: 0 });
    expect(flips).toBe(1);
  });

  test("progress is driven only on a compact transition, not per travel change", () => {
    // 16 + 16 + 16 accumulates travel without flipping until the third step.
    const store: PrimitiveStore = { compact: false, travel: 0 };
    let offset = START;
    const flipsPerStep: boolean[] = [];
    for (const delta of [16, 16, 16]) {
      offset += delta;
      flipsPerStep.push(applyScrollStep(store, offset, delta).compactChanged);
    }
    expect(flipsPerStep).toEqual([false, false, true]);
    expect(store).toEqual({ compact: true, travel: 0 });
  });

  test("jitter never flips the primitives and never signals progress", () => {
    const jitter = Array.from({ length: 50 }, (_, i) => (i % 2 === 0 ? 10 : -10));
    for (const initial of [
      { compact: false, travel: 0 },
      { compact: true, travel: 0 },
    ]) {
      const { store, flips } = run(initial, jitter);
      expect(store.compact).toBe(initial.compact);
      expect(flips).toBe(0);
    }
  });

  test("near the top (offset <= 24) the write-back forces expanded", () => {
    const store: PrimitiveStore = { compact: true, travel: 0 };
    const { compactChanged } = applyScrollStep(store, 24, 10);
    expect(store).toEqual({ compact: false, travel: 0 });
    expect(compactChanged).toBe(true);
  });
});
