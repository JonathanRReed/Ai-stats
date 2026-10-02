import { expect, test } from 'bun:test';
import * as cache from './epoch-cache';

const row = { source_key: 'epoch-ai', fetched_at: '2026-10-02T00:00:00Z', record_count: 3,
  payload: { schemaVersion: 1, sourceKey: 'epoch-ai', records: [
    { id: 'model:x', kind: 'model', data: { model_version: 'x', display_name: 'X' } },
    { id: 'benchmark:b', kind: 'benchmark', data: { slug: 'b', name: 'Benchmark' } },
    { id: 'run:r', kind: 'run', data: { id: 'r', model_version: 'x', benchmark_slug: 'b',
      score: 0, conditions: { Shots: '0' }, evaluation_date: null, score_unit: 'native' } },
  ] },
};
test('cached Epoch records decode with exact conditions and a separate fetch receipt', () => {
  const result = cache.decodeEpochCache?.(row);
  expect(result?.fetched_at).toBe(row.fetched_at);
  expect(result?.models).toHaveLength(1);
  expect(result?.benchmarks).toHaveLength(1);
  expect(result?.runs[0]).toMatchObject({ id: 'r', score: 0, conditions: { Shots: '0' } });
});
test('partial caches fail closed for the last-good fallback', () => {
  expect(cache.decodeEpochCache?.({ ...row, record_count: 4 })).toBeNull();
  expect(cache.decodeEpochCache?.({ ...row, fetched_at: 'not-a-date' })).toBeNull();
  expect(cache.decodeEpochCache?.({ ...row, source_key: 'other' })).toBeNull();
});
test('unresolved and duplicate observation identities are rejected', () => {
  const wrong = structuredClone(row);
  wrong.payload.records[2].data.model_version = 'missing';
  expect(cache.decodeEpochCache?.(wrong)).toBeNull();
  const duplicate = { ...row, record_count: 4, payload: { ...row.payload, records: [...row.payload.records, row.payload.records[2]] } };
  expect(cache.decodeEpochCache?.(duplicate)).toBeNull();
});
