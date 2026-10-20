// TypeScript 6 no longer auto-includes @types/*, so pull in jest globals here.
/// <reference types="jest" />
import {
  clampScrollOffset,
  type CompactionState,
  nextCompactionState,
} from "../scrollCompaction";

const EXPANDED: CompactionState = { compact: false, travel: 0 };
const COMPACT: CompactionState = { compact: true, travel: 0 };
// Well below NEAR_TOP so only travel decides.
const START = 500;

// Feeds a sequence of deltas, tracking the offset like the scroll handler.
function run(
  initial: CompactionState,
  deltas: number[],
  onStep?: (state: CompactionState) => void,
): CompactionState {
  let state = initial;
  let offset = START;
  for (const delta of deltas) {
    offset += delta;
    state = nextCompactionState(state, offset, delta);
    onStep?.(state);
  }
  return state;
}

describe("nextCompactionState", () => {
  test("47 down stays expanded", () => {
    expect(run(EXPANDED, [47]).compact).toBe(false);
    expect(run(EXPANDED, [20, 27]).compact).toBe(false);
  });

  test("48 down compacts", () => {
    expect(run(EXPANDED, [48])).toEqual(COMPACT);
    expect(run(EXPANDED, [16, 16, 16])).toEqual(COMPACT);
  });

  test("alternating +/-10 for 50 iterations never toggles", () => {
    const jitter = Array.from({ length: 50 }, (_, i) => (i % 2 === 0 ? 10 : -10));
    for (const initial of [EXPANDED, COMPACT]) {
      run(initial, jitter, (state) => {
        expect(state.compact).toBe(initial.compact);
      });
    }
  });

  test("compact then 19 up stays compact", () => {
    expect(run(COMPACT, [-19]).compact).toBe(true);
  });

  test("compact then 20 up expands", () => {
    expect(run(COMPACT, [-20])).toEqual(EXPANDED);
    expect(run(COMPACT, [-10, -10])).toEqual(EXPANDED);
  });

  test("direction change resets travel (down 30, up 5, down 30 stays expanded)", () => {
    expect(run(EXPANDED, [30, -5, 30])).toEqual({ compact: false, travel: 30 });
  });

  test("offset <= 24 forces expanded even when compact", () => {
    expect(nextCompactionState(COMPACT, 24, 10)).toEqual(EXPANDED);
    expect(nextCompactionState(COMPACT, 0, -5)).toEqual(EXPANDED);
    expect(nextCompactionState({ compact: false, travel: 40 }, 10, 30)).toEqual(
      EXPANDED,
    );
  });

  test("deltaY 0 returns prev unchanged", () => {
    const prev: CompactionState = { compact: false, travel: 30 };
    expect(nextCompactionState(prev, START, 0)).toBe(prev);
  });
});

describe("clampScrollOffset", () => {
  test("negative (top rubber-band) -> 0", () => {
    expect(clampScrollOffset(-60, 2000, 800)).toBe(0);
  });

  test("overscroll past the end -> max offset", () => {
    expect(clampScrollOffset(1300, 2000, 800)).toBe(1200);
  });

  test("in range is unchanged", () => {
    expect(clampScrollOffset(450, 2000, 800)).toBe(450);
  });

  test("content shorter than viewport -> 0", () => {
    expect(clampScrollOffset(30, 500, 800)).toBe(0);
    expect(clampScrollOffset(-30, 500, 800)).toBe(0);
  });
});
