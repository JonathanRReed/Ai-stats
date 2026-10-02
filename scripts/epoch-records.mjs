/** Keep only recorded scalar evaluation settings; missing is not an empty known configuration. */
export function normalizeEpochConditions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value).flatMap(([key, item]) => {
    if (!key.trim()) return [];
    if (typeof item === 'string' && item.trim()) return [[key, item.trim()]];
    if (typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item))) return [[key, item]];
    return [];
  });
  return entries.length ? Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b))) : null;
}

export function normalizeEpochEvaluationDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  const day = new Date(time).toISOString().slice(0, 10);
  return day === value.slice(0, 10) ? day : null;
}

export function normalizeEpochScoreUnit(value) {
  return value === 'percent' || value === 'fraction' ? value : 'native';
}
