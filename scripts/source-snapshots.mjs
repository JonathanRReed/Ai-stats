import { createHash } from 'node:crypto';

const SOURCES = new Set(['artificial-analysis', 'epoch-ai', 'openrouter', 'openrouter-usage', 'huggingface', 'litellm', 'polibench']);
const PRIVATE_KEYS = /^(raw|api[_-]?key|service[_-]?role[_-]?key|access[_-]?token|refresh[_-]?token|authorization|password|secret)$/i;
const timestamp = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error('Invalid source timestamp');
  }
  return new Date(value).toISOString();
};
const canonical = (value, depth = 0) => {
  if (depth > 32) throw new Error('Source record nesting exceeds limit');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Source numbers must be finite');
    return value;
  }
  if (Array.isArray(value)) return value.map(item => canonical(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => {
      if (PRIVATE_KEYS.test(key)) throw new Error('Source record contains private fields');
      return [key, canonical(item, depth + 1)];
    }));
  }
  throw new Error('Source record is not JSON data');
};

/** Validate and clone a sanitized source payload before any network write. */
export function prepareSourceSnapshot({ sourceKey, observedAt, fetchedAt, records }) {
  if (!SOURCES.has(sourceKey)) throw new Error('Unknown source');
  if (!Array.isArray(records) || !records.length) throw new Error('Cannot publish an empty source snapshot');
  const fetched = timestamp(fetchedAt);
  const observed = observedAt === null ? null : timestamp(observedAt);
  const ids = new Set();
  const normalized = records.map(record => {
    if (!record || typeof record !== 'object' || Array.isArray(record) ||
      typeof record.id !== 'string' || !record.id.trim()) throw new Error('Source record needs an identity');
    if (ids.has(record.id)) throw new Error('Source snapshot has duplicate identities');
    ids.add(record.id);
    return canonical(record);
  }).sort((a, b) => a.id.localeCompare(b.id));
  const payload = { schemaVersion: 1, sourceKey, observedAt: observed, records: normalized };
  return {
    ...payload,
    fetchedAt: fetched,
    contentHash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
    recordCount: normalized.length,
  };
}
