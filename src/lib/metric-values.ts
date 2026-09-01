export const parseFiniteMetricValue = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export const hasFiniteMetricValue = (value: unknown): boolean =>
  parseFiniteMetricValue(value) !== null;

export const compareOptionalMetricValues = (
  left: unknown,
  right: unknown,
  direction: "asc" | "desc" = "desc",
): number => {
  const leftValue = parseFiniteMetricValue(left);
  const rightValue = parseFiniteMetricValue(right);

  if (leftValue === null && rightValue === null) return 0;
  if (leftValue === null) return 1;
  if (rightValue === null) return -1;
  return direction === "desc"
    ? rightValue - leftValue
    : leftValue - rightValue;
};
