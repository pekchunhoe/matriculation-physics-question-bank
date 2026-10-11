/** Ephemeral presentation data. This shared plan is used for both sections and footers. */
export function numberingPlan<T extends { id: string }>(selected: readonly T[]) {
  if (new Set(selected.map((item) => item.id)).size !== selected.length)
    throw new Error('Selected question IDs must be unique');
  return selected.map((item, index) => ({ ...item, displayNumber: index + 1 }));
}
