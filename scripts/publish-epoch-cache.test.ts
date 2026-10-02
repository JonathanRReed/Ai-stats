import { expect, test } from 'bun:test';
import { runEpochCachePublication } from './publish-epoch-cache.mjs';

const snapshot = { fetched_at: '2026-10-02T00:00:00Z',
  archive_manifest:{source:'https://epoch.ai/data/benchmark_data.zip',sha256:'a'.repeat(64),parsed:true,files:[{path:'bench.csv',row_count:1}]},
  models: [{ model_version: 'model' }], benchmarks: [{ slug: 'bench' }],
  runs: [{ id: 'run', model_version: 'model', benchmark_slug: 'bench', score: 0 }] };
test('dry-run validates the artifact without credentials or network writes', async () => {
  let writes = 0;
  const result = await runEpochCachePublication({
    argv: ['--input', 'snapshot.json', '--dry-run'], env: {},
    readFileImpl: async () => JSON.stringify(snapshot),
    publishImpl: async () => { writes++; throw new Error('unexpected'); },
  });
  expect(result.dryRun).toBe(true);
  expect(result.recordCount).toBe(3);
  expect(writes).toBe(0);
});
test('publication reads only the explicit sanitized artifact and returns a safe receipt', async () => {
  let path = '';
  let input;
  const result = await runEpochCachePublication({
    argv: ['--input', 'snapshot.json'],
    env: { SUPABASE_URL: 'https://bgbqdzmgxkwstjihgeef.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only' },
    readFileImpl: async (value: string) => { path = value; return JSON.stringify(snapshot); },
    publishImpl: async (args: {input: unknown}) => { input = args.input; return {snapshotId: 4, recordCount: 3, contentHash: 'hash'}; },
  });
  expect(path).toBe('snapshot.json');
  expect(input).toMatchObject({ sourceKey: 'epoch-ai', observedAt: null });
  expect(result).toEqual({snapshotId: 4, recordCount: 3, contentHash: 'hash', dryRun: false});
});
test('invalid arguments and partial artifacts cannot reach publication', async () => {
  let calls = 0;
  for (const argv of [[], ['--input'], ['--input', 'x', '--force']]) {
    await expect(runEpochCachePublication({ argv, env: {}, readFileImpl: async () => '{}',
      publishImpl: async () => { calls++; throw new Error('unexpected publication'); } })).rejects.toThrow();
  }
  await expect(runEpochCachePublication({ argv: ['--input', 'x'], env: {},
    readFileImpl: async () => JSON.stringify({...snapshot, runs: []}),
    publishImpl: async () => { calls++; throw new Error('unexpected publication'); } })).rejects.toThrow('incomplete');
  expect(calls).toBe(0);
});
