/** Sort siblings by their stored order without changing the shared API arrays. */
export function inStoredOrder<T extends { order: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}
