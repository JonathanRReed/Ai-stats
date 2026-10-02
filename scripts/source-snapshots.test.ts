import { expect, test } from 'bun:test';
import * as snapshots from './source-snapshots.mjs';

const input = { sourceKey: 'epoch-ai', observedAt: '2026-10-01T12:00:00Z',
  fetchedAt: '2026-10-02T00:00:00Z', records: [{ id: 'run-a', value: 0, conditions: { format: 'diff' } }] };
test('snapshot hashing is stable across fetch time and object key order', () => {
  const a = snapshots.prepareSourceSnapshot?.(input);
  const b = snapshots.prepareSourceSnapshot?.({ ...input, fetchedAt: '2026-10-02T01:00:00Z',
    records: [{ conditions: { format: 'diff' }, value: 0, id: 'run-a' }] });
  expect(a?.contentHash).toMatch(/^[a-f0-9]{64}$/);
  expect(a?.contentHash).toBe(b?.contentHash);
  expect(b?.fetchedAt).toBe('2026-10-02T01:00:00.000Z');
});
test('empty or malformed snapshots cannot replace last good data', () => {
  expect(() => snapshots.prepareSourceSnapshot?.({ ...input, records: [] })).toThrow('empty');
  expect(() => snapshots.prepareSourceSnapshot?.({ ...input, records: [{ id: 'x', value: NaN }] })).toThrow('finite');
});
test('duplicate source record identities are rejected', () => {
  expect(() => snapshots.prepareSourceSnapshot?.({ ...input, records: [input.records[0], input.records[0]] })).toThrow('duplicate');
});
test('removed records change membership without mutating the old snapshot', () => {
  const original = { ...input, records: [...input.records, { id: 'other', value: 2 }] };
  const old = snapshots.prepareSourceSnapshot?.(original);
  const next = snapshots.prepareSourceSnapshot?.(input);
  expect(old?.records).toHaveLength(2);
  expect(next?.records).toHaveLength(1);
  expect(old?.contentHash).not.toBe(next?.contentHash);
  expect(original.records).toHaveLength(2);
});
test('private raw records and credentials cannot enter a public cache payload', () => {
  expect(() => snapshots.prepareSourceSnapshot?.({ ...input, records: [{ id: 'x', raw: { a: 1 } }] })).toThrow('private');
  expect(() => snapshots.prepareSourceSnapshot?.({ ...input, records: [{ id: 'x', nested: { api_key: 'example' } }] })).toThrow('private');
});
test('invalid source and dates are rejected before network activity', () => {
  expect(() => snapshots.prepareSourceSnapshot?.({ ...input, sourceKey: 'unknown' })).toThrow('source');
  expect(() => snapshots.prepareSourceSnapshot?.({ ...input, fetchedAt: 'yesterday' })).toThrow('timestamp');
});

test('publication stages validated data before promoting its returned identity', async () => {
  const calls: Array<{url: string; body: Record<string, unknown>}> = [];
  const fetchImpl = async (url: string | URL, init?: RequestInit) => {
    calls.push({url: String(url), body: JSON.parse(String(init?.body))});
    return new Response('41', { status: 200 });
  };
  const result = await snapshots.publishSourceSnapshot?.({ input, baseUrl: 'https://bgbqdzmgxkwstjihgeef.supabase.co',
    serviceKey: 'test-only', fetchImpl });
  expect(calls).toHaveLength(2);
  expect(calls[0].url).toEndWith('/rest/v1/rpc/stage_source_snapshot');
  expect(calls[1].body).toEqual({ p_snapshot_id: 41 });
  expect(result?.snapshotId).toBe(41);
});
test('unsafe origins and invalid payloads fail before any credential transmission', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return new Response('41'); };
  await expect(snapshots.publishSourceSnapshot({ input,
    baseUrl: 'https://example.test', serviceKey: 'test-only', fetchImpl })).rejects.toThrow('origin');
  expect(calls).toBe(0);
});
test('failed staging never triggers promotion or leaks server response bodies', async () => {
  const calls: string[] = [];
  const fetchImpl = async (url: string | URL) => {
    calls.push(String(url)); return new Response('private upstream details', {status: 503});
  };
  await expect(snapshots.publishSourceSnapshot({ input,
    baseUrl: 'https://bgbqdzmgxkwstjihgeef.supabase.co', serviceKey: 'test-only', fetchImpl }))
    .rejects.toThrow('Source snapshot stage failed (503)');
  expect(calls).toHaveLength(1);
});

const epoch = { fetched_at: '2026-10-02T00:00:00Z',
  models: [{ model_version: 'model', display_name: 'Model', updated_at: '2026-10-02T00:00:00Z' }],
  benchmarks: [{ slug: 'test', name: 'Test' }],
  runs: [{ id: 'run', model_version: 'model', benchmark_slug: 'test', score: 0,
    conditions: { Shots: '0' }, evaluation_date: null, score_unit: 'native' }],
};
test('Epoch cache records preserve membership and omit download-only timestamps', () => {
  const first = snapshots.buildEpochCacheInput?.(epoch);
  expect(first?.sourceKey).toBe('epoch-ai');
  expect(first?.observedAt).toBeNull();
  expect(first?.records).toHaveLength(3);
  expect(first?.records.find((r: {kind: string}) => r.kind === 'run')?.data.conditions).toEqual({ Shots: '0' });
  const second = snapshots.buildEpochCacheInput?.({ ...epoch, fetched_at: '2026-10-02T06:00:00Z',
    models: [{ ...epoch.models[0], updated_at: '2026-10-02T06:00:00Z' }] });
  expect(first).toBeDefined();
  expect(snapshots.prepareSourceSnapshot(first).contentHash).toBe(snapshots.prepareSourceSnapshot(second).contentHash);
});
test('partial Epoch corpora cannot be promoted as valid snapshots', () => {
  expect(() => snapshots.buildEpochCacheInput?.({ ...epoch, runs: [] })).toThrow('incomplete');
  expect(() => snapshots.buildEpochCacheInput?.({ ...epoch, runs: [{ ...epoch.runs[0], model_version: 'missing' }] })).toThrow('identity');
});

test('missing model and run IDs cannot masquerade as a valid corpus', () => {
  expect(() => snapshots.buildEpochCacheInput({ ...epoch,
    models: [{}], runs: [{ ...epoch.runs[0], model_version: undefined }] })).toThrow('identity');
  expect(() => snapshots.buildEpochCacheInput({ ...epoch,
    runs: [{ ...epoch.runs[0], id: undefined }] })).toThrow('identity');
});

test('unchanged Epoch artifacts preserve the published download date without triggering a deploy', () => {
  const next = {...epoch, fetched_at: '2026-10-02T06:00:00Z'};
  const result = snapshots.selectEpochArtifact?.(epoch, next);
  expect(result?.changed).toBe(false);
  expect(result?.artifact.fetched_at).toBe(epoch.fetched_at);
  expect(result?.fetchedAt).toBe(next.fetched_at);
});
test('changed Epoch membership produces a new artifact and keeps the old value intact', () => {
  const next = {...epoch, runs: [...epoch.runs, {...epoch.runs[0], id: 'other', score: 2}]};
  const result = snapshots.selectEpochArtifact?.(epoch, next);
  expect(result?.changed).toBe(true);
  expect(result?.artifact.runs).toHaveLength(2);
  expect(epoch.runs).toHaveLength(1);
});
