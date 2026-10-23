/// <reference types="jest" />
import { getOptionGroups } from "../../../data/mock/itemOptions";
import {
  clampQty,
  firstUnsatisfiedGroup,
  initialSelection,
  isGroupSatisfied,
  lineTotalMinor,
  selectedOptions,
  toggle,
} from "../itemSelection";

const food = getOptionGroups("lm-jollof-chicken", ["rice-meals"]);
const [protein, drinks] = food;

describe("item selection", () => {
  test("mock rules per category", () => {
    expect(food.map((g) => g.id)).toEqual(["protein", "drink-addition", "extras"]);
    expect(getOptionGroups("dr-sobolo", ["drinks"]).map((g) => g.id)).toEqual(["size", "ice"]);
    expect(getOptionGroups("bk-croissant", ["snacks"]).map((g) => g.id)).toEqual(["addons"]);
    expect(getOptionGroups("gf-gift-hamper", ["gifts"])).toEqual([]);
    expect(getOptionGroups("el-earbuds", ["gadgets"])).toEqual([]);
  });

  test("initial selection is empty, required radios not preselected", () => {
    const sel = initialSelection(food);
    expect(sel).toEqual({ protein: [], "drink-addition": [], extras: [] });
    expect(isGroupSatisfied(protein, sel)).toBe(false);
    expect(isGroupSatisfied(drinks, sel)).toBe(true);
    expect(firstUnsatisfiedGroup(food, sel)?.id).toBe("protein");
  });

  test("single-select swaps; required stays selected on re-tap", () => {
    let sel = initialSelection(food);
    sel = toggle(food, sel, "protein", "protein-chicken").selection;
    sel = toggle(food, sel, "protein", "protein-beef").selection;
    expect(sel.protein).toEqual(["protein-beef"]);
    const again = toggle(food, sel, "protein", "protein-beef");
    expect(again.accepted).toBe(true);
    expect(again.selection.protein).toEqual(["protein-beef"]);
    expect(firstUnsatisfiedGroup(food, sel)).toBeNull();
  });

  test("optional single-select clears on re-tap", () => {
    const groups = getOptionGroups("dr-sobolo", ["drinks"]);
    let sel = initialSelection(groups);
    sel = toggle(groups, sel, "ice", "ice-none").selection;
    expect(sel.ice).toEqual(["ice-none"]);
    sel = toggle(groups, sel, "ice", "ice-none").selection;
    expect(sel.ice).toEqual([]);
  });

  test("multi-select enforces max", () => {
    let sel = initialSelection(food);
    sel = toggle(food, sel, "drink-addition", "drink-sprite").selection;
    sel = toggle(food, sel, "drink-addition", "drink-coke").selection;
    const third = toggle(food, sel, "drink-addition", "drink-water");
    expect(third.accepted).toBe(false);
    expect(third.selection).toBe(sel);
    sel = toggle(food, sel, "drink-addition", "drink-sprite").selection;
    expect(sel["drink-addition"]).toEqual(["drink-coke"]);
  });

  test("unknown group or option is rejected", () => {
    const sel = initialSelection(food);
    expect(toggle(food, sel, "nope", "x").accepted).toBe(false);
    expect(toggle(food, sel, "protein", "drink-coke").accepted).toBe(false);
  });

  test("line total = (base + options) x qty in pesewas", () => {
    let sel = initialSelection(food);
    expect(lineTotalMinor(3800, food, sel, 1)).toBe(3800);
    sel = toggle(food, sel, "protein", "protein-fish").selection;
    sel = toggle(food, sel, "drink-addition", "drink-sprite").selection;
    sel = toggle(food, sel, "extras", "extra-shito").selection;
    // 3800 + 800 + 1760 + 400 = 6760
    expect(lineTotalMinor(3800, food, sel, 3)).toBe(20280);
    expect(selectedOptions(food, sel).map((o) => o.label)).toEqual([
      "Fish",
      "Sprite 450ml",
      "Extra shito",
    ]);
  });

  test("quantity clamps to 1..20", () => {
    expect(clampQty(0)).toBe(1);
    expect(clampQty(5)).toBe(5);
    expect(clampQty(99)).toBe(20);
    expect(clampQty(Number.NaN)).toBe(1);
  });
});
