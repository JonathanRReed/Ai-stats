import { expect, test } from 'bun:test';
import * as evidence from './epoch-evidence';

const published = { fetchedAt: '2026-10-01T00:00:00Z', epochModels: [], epochBenchmarks: [],
  epochRuns: [{ id: 'r', model_version: 'x', benchmark_id: 'b', score: 8,
    release_date: null, organization: null, country: null, stderr: null }] };
test('a present invalid cache falls back to the validated artifact, never uncommitted legacy rows', async () => {
  let legacyCalls = 0;
  const result = await evidence.readEpochEvidence?.({
    published: async () => published,
    cache: async () => ({ found: true, evidence: null }),
    receipt: async () => '2026-10-02T00:00:00Z',
    legacy: async () => { legacyCalls++; return { ...published, fetchedAt: '2026-10-02T00:00:00Z' }; },
  });
  expect(result).toEqual(published);
  expect(legacyCalls).toBe(0);
});
test('a valid newer cache replaces the artifact without loading legacy corpus tables', async () => {
  let legacyCalls = 0;
  const cached = { ...published, fetchedAt: '2026-10-02T00:00:00Z' };
  const result = await evidence.readEpochEvidence?.({
    published: async () => published,
    cache: async () => ({ found: true, evidence: cached }),
    receipt: async () => '2026-10-03T00:00:00Z',
    legacy: async () => { legacyCalls++; return published; },
  });
  expect(result).toEqual(cached);
  expect(legacyCalls).toBe(0);
});
