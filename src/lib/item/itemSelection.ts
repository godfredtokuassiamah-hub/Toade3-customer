// Pure option-selection and pricing logic for the item detail sheet.
// Money is integer pesewas. A group with max === 1 is single-select (radio);
// otherwise multi-select (checkbox) capped at max.
import type { OptionGroup } from "../../data/mock/itemOptions";

// groupId -> selected option ids (in tap order).
export type Selection = Readonly<Record<string, readonly string[]>>;

export type SelectedOption = {
  groupId: string;
  optionId: string;
  label: string;
  priceMinor: number;
};

export const MIN_QTY = 1;
export const MAX_QTY = 20;

export function isSingleSelect(group: OptionGroup): boolean {
  return group.max === 1;
}

// Every group starts empty: required radios are NOT preselected.
export function initialSelection(groups: readonly OptionGroup[]): Selection {
  const out: Record<string, string[]> = {};
  for (const g of groups) out[g.id] = [];
  return out;
}

export type ToggleResult = { selection: Selection; accepted: boolean };

// Single-select: tapping another option swaps; tapping the selected one
// clears it only when the group is optional. Multi-select: toggles, and a
// new pick beyond max is rejected (accepted: false, selection unchanged).
export function toggle(
  groups: readonly OptionGroup[],
  selection: Selection,
  groupId: string,
  optionId: string,
): ToggleResult {
  const group = groups.find((g) => g.id === groupId);
  if (!group || !group.options.some((o) => o.id === optionId)) {
    return { selection, accepted: false };
  }
  const current = selection[groupId] ?? [];
  const selected = current.includes(optionId);
  let next: string[];
  if (isSingleSelect(group)) {
    if (selected) {
      if (group.required) return { selection, accepted: true };
      next = [];
    } else {
      next = [optionId];
    }
  } else if (selected) {
    next = current.filter((id) => id !== optionId);
  } else {
    if (current.length >= group.max) return { selection, accepted: false };
    next = [...current, optionId];
  }
  return { selection: { ...selection, [groupId]: next }, accepted: true };
}

export function isGroupSatisfied(group: OptionGroup, selection: Selection): boolean {
  const count = (selection[group.id] ?? []).length;
  const min = group.required ? Math.max(1, group.min) : group.min;
  return count >= min && count <= group.max;
}

export function firstUnsatisfiedGroup(
  groups: readonly OptionGroup[],
  selection: Selection,
): OptionGroup | null {
  return groups.find((g) => !isGroupSatisfied(g, selection)) ?? null;
}

// Selected options in group order, then option order.
export function selectedOptions(
  groups: readonly OptionGroup[],
  selection: Selection,
): SelectedOption[] {
  const out: SelectedOption[] = [];
  for (const g of groups) {
    const ids = selection[g.id] ?? [];
    for (const o of g.options) {
      if (ids.includes(o.id)) {
        out.push({ groupId: g.id, optionId: o.id, label: o.label, priceMinor: o.priceMinor });
      }
    }
  }
  return out;
}

export function clampQty(qty: number): number {
  if (!Number.isFinite(qty)) return MIN_QTY;
  return Math.min(MAX_QTY, Math.max(MIN_QTY, Math.trunc(qty)));
}

// (base + selected option prices) x qty, all integer pesewas.
export function lineTotalMinor(
  basePriceMinor: number,
  groups: readonly OptionGroup[],
  selection: Selection,
  qty: number,
): number {
  const options = selectedOptions(groups, selection).reduce((sum, o) => sum + o.priceMinor, 0);
  return (basePriceMinor + options) * clampQty(qty);
}
