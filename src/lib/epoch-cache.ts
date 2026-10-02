export type DecodedEpochSnapshot = {
  fetched_at: string;
  models: Array<Record<string, unknown>>;
  benchmarks: Array<Record<string, unknown>>;
  runs: Array<Record<string, unknown>>;
};

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const identity = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/** Reject partial/unknown cache contracts so consumers can retain their last-good artifact. */
export function decodeEpochCache(value: unknown): DecodedEpochSnapshot | null {
  if (!object(value) || value.source_key !== 'epoch-ai' || !identity(value.fetched_at) ||
    !/^\d{4}-\d{2}-\d{2}T/.test(value.fetched_at) || !Number.isFinite(Date.parse(value.fetched_at))) return null;
  const payload = value.payload;
  if (!object(payload) || payload.schemaVersion !== 1 || payload.sourceKey !== 'epoch-ai' ||
    !Array.isArray(payload.records) || payload.records.length !== value.record_count) return null;
  const result: DecodedEpochSnapshot = { fetched_at: value.fetched_at, models: [], benchmarks: [], runs: [] };
  const seen = new Set<string>();
  for (const record of payload.records) {
    if (!object(record) || !identity(record.id) || seen.has(record.id) || !object(record.data)) return null;
    seen.add(record.id);
    const row = record.data;
    if (record.kind === 'model') {
      if (!identity(row.model_version) || record.id !== 'model:' + row.model_version) return null;
      result.models.push(row);
    } else if (record.kind === 'benchmark') {
      if (!identity(row.slug) || record.id !== 'benchmark:' + row.slug) return null;
      result.benchmarks.push(row);
    } else if (record.kind === 'run') {
      if (!identity(row.id) || record.id !== 'run:' + row.id ||
        !identity(row.model_version) || !identity(row.benchmark_slug) ||
        !(row.score === null || (typeof row.score === 'number' && Number.isFinite(row.score)))) return null;
      result.runs.push(row);
    } else return null;
  }
  if (!result.models.length || !result.benchmarks.length || !result.runs.some(row => typeof row.score === 'number')) return null;
  const models = new Set(result.models.map(row => row.model_version));
  const benchmarks = new Set(result.benchmarks.map(row => row.slug));
  if (result.runs.some(row => !models.has(row.model_version) || !benchmarks.has(row.benchmark_slug))) return null;
  return result;
}
