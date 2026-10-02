const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Null means membership could not be verified; never label retained rows as current in that case. */
export function filterAaCurrentModels<T extends {id: string}>(rows: T[], cache: unknown): T[] | null {
  if (!object(cache) || cache.source_key !== 'artificial-analysis' || !object(cache.payload)) return null;
  const payload = cache.payload;
  if (payload.schemaVersion !== 1 || payload.sourceKey !== 'artificial-analysis' ||
    !Array.isArray(payload.records) || !payload.records.length || payload.records.length !== cache.record_count) return null;
  const ids = new Set<string>();
  for (const record of payload.records) {
    if (!object(record) || record.kind !== 'model-membership' || typeof record.id !== 'string' ||
      !record.id.trim() || ids.has(record.id)) return null;
    ids.add(record.id);
  }
  const selected = rows.filter(row => ids.has(row.id));
  return selected.length === ids.size ? selected : null;
}

export async function readAaCohort<T extends {id: string}>(
  sources: {models: () => Promise<T[]>; cache: () => Promise<unknown>}, includeHistory = false,
): Promise<Array<T & {current_source_member: boolean | null}>> {
  const [rows, cache] = await Promise.all([sources.models(), sources.cache().catch(() => null)]);
  const current = filterAaCurrentModels(rows, cache);
  const ids = current ? new Set(current.map(row => row.id)) : null;
  return (includeHistory || !current ? rows : current).map(row => ({
    ...row, current_source_member: ids ? ids.has(row.id) : null,
  }));
}
