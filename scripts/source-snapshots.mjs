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

/** Publish only to this application's existing production project, using its server identity. */
export async function publishSourceSnapshot({
  input, baseUrl, serviceKey, fetchImpl = (url, init) => globalThis.fetch(url, init),
}) {
  const snapshot = prepareSourceSnapshot(input);
  let origin;
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'bgbqdzmgxkwstjihgeef.supabase.co' ||
      url.username || url.password || (url.pathname !== '/' && url.pathname !== '') ||
      url.search || url.hash || url.port) throw new Error('invalid');
    origin = url.origin;
  } catch { throw new Error('Invalid source cache origin'); }
  if (typeof serviceKey !== 'string' || !serviceKey.trim()) throw new Error('Missing source cache credentials');
  const rpc = async (name, body, label) => {
    let response;
    try {
      response = await fetchImpl(origin + '/rest/v1/rpc/' + name, {
        method: 'POST',
        headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch { throw new Error('Source snapshot ' + label + ' request failed'); }
    if (!response.ok) throw new Error('Source snapshot ' + label + ' failed (' + response.status + ')');
    let value;
    try { value = await response.json(); } catch { throw new Error('Invalid source snapshot receipt'); }
    if (!((typeof value === 'number' && Number.isSafeInteger(value) && value > 0) ||
      (typeof value === 'string' && /^[1-9][0-9]*$/.test(value)))) throw new Error('Invalid source snapshot identity');
    return value;
  };
  const snapshotId = await rpc('stage_source_snapshot', {
    p_source_key: snapshot.sourceKey, p_content_hash: snapshot.contentHash,
    p_observed_at: snapshot.observedAt, p_fetched_at: snapshot.fetchedAt,
    p_payload: { schemaVersion: snapshot.schemaVersion, sourceKey: snapshot.sourceKey,
      observedAt: snapshot.observedAt, records: snapshot.records },
    p_record_count: snapshot.recordCount,
  }, 'stage');
  const promoted = await rpc('promote_source_snapshot', { p_snapshot_id: snapshotId }, 'promotion');
  if (String(promoted) !== String(snapshotId)) throw new Error('Source snapshot promotion identity mismatch');
  return { snapshotId, contentHash: snapshot.contentHash, recordCount: snapshot.recordCount };
}

const pick = (row, keys) => Object.fromEntries(keys.filter(key => row[key] !== undefined).map(key => [key, row[key]]));

/** Build a durable cache from the sanitized public Epoch artifact, never raw archive rows. */
export function buildEpochCacheInput(snapshot) {
  if (!snapshot || !['models', 'benchmarks', 'runs'].every(key => Array.isArray(snapshot[key]) && snapshot[key].length)) {
    throw new Error('Epoch snapshot is incomplete');
  }
  const modelKeys = new Set(snapshot.models.map(row => row.model_version));
  const benchmarkKeys = new Set(snapshot.benchmarks.map(row => row.slug));
  if (snapshot.runs.some(run => !modelKeys.has(run.model_version) || !benchmarkKeys.has(run.benchmark_slug))) {
    throw new Error('Epoch observation identity does not resolve');
  }
  if (!snapshot.runs.some(run => typeof run.score === 'number' && Number.isFinite(run.score))) {
    throw new Error('Epoch snapshot has incomplete measured evidence');
  }
  const records = [
    ...snapshot.models.map(row => ({
      id: 'model:' + row.model_version, kind: 'model',
      data: pick(row, ['model_version', 'model_name', 'display_name', 'organization', 'country',
        'model_accessibility', 'release_date', 'eci_score', 'training_compute_flop',
        'training_compute_confidence', 'description']),
    })),
    ...snapshot.benchmarks.map(row => ({
      id: 'benchmark:' + row.slug, kind: 'benchmark',
      data: pick(row, ['slug', 'name', 'description', 'source']),
    })),
    ...snapshot.runs.map(row => ({
      id: 'run:' + row.id, kind: 'run',
      data: pick(row, ['id', 'model_version', 'benchmark_slug', 'score', 'score_metric',
        'score_unit', 'conditions', 'evaluation_date', 'release_date', 'organization',
        'country', 'stderr', 'source_name', 'source_link']),
    })),
  ];
  const input = { sourceKey: 'epoch-ai', observedAt: snapshot.source_observed_at ?? null,
    fetchedAt: snapshot.fetched_at, records };
  prepareSourceSnapshot(input);
  return input;
}
