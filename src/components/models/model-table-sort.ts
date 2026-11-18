export type ModelSortKey = "index" | "input" | "output" | "speed" | "context";
export type SortDirection = "asc" | "desc";

export const MODEL_SORT_KEYS: readonly ModelSortKey[] = ["index", "input", "output", "speed", "context"];

/** Reads a data-* attribute value; empty, missing or non-numeric text is a missing value, never zero. */
export const parseSortValue = (raw: string | null | undefined): number | null => {
  if (raw === null || raw === undefined || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

/**
 * Stable sort by one measure. Missing values always sort last, in either direction,
 * and ties keep the incoming order.
 */
export function sortByMeasure<T>(rows: readonly T[], value: (row: T) => number | null, direction: SortDirection): T[] {
  return rows
    .map((row, position) => ({ row, position, value: value(row) }))
    .sort((a, b) => {
      if (a.value === null || b.value === null) {
        if (a.value === b.value) return a.position - b.position;
        return a.value === null ? 1 : -1;
      }
      const diff = direction === "asc" ? a.value - b.value : b.value - a.value;
      return diff || a.position - b.position;
    })
    .map((entry) => entry.row);
}

/** Higher is better for Index, speed and context; lower for prices. */
export const defaultDirection = (key: ModelSortKey): SortDirection => (key === "input" || key === "output" ? "asc" : "desc");
