/** Step visible ranked results through 5 → 20 → 50 → all. */
export function nextLeaderboardLimit(current: number): number {
  if (current < 20) return 20;
  if (current < 50) return 50;
  return Number.POSITIVE_INFINITY;
}

export function visibleLeaderboardRows<T>(rankedRows: T[], limit = 5): T[] {
  return rankedRows.slice(0, limit);
}
