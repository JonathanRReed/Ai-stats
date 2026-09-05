import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../supabase/functions/ingest-artificialanalysis/index.ts', import.meta.url), 'utf8')
  .replace(/^import .*;$/gm, '');
const code = new Bun.Transpiler({ loader: 'ts' }).transformSync(source);
const setup = (fetcher = async () => Response.json({})) => {
  let handler: (request: Request) => Promise<Response> = async () => new Response();
  const context = { URL, Request, Response, atob, fetch: fetcher, console,
    Deno: { env: { get: () => 'test-service' }, serve: (fn: typeof handler) => { handler = fn; } } };
  runInNewContext(code, context);
  return { context, handler };
};

test('AA ingestion rejects an anonymous caller before contacting AA', async () => {
  let calls = 0;
  const { handler } = setup(async () => { calls++; return Response.json({}); });
  expect((await handler(new Request('https://example.test', { headers: { Authorization: 'Bearer anon' } }))).status).toBe(401);
  expect(calls).toBe(0);
});

test('AA pagination rejects empty or mixed-version snapshots', async () => {
  const { context } = setup(async () => Response.json({ intelligence_index_version: 4.1, data: [{ id: 'two' }] }));
  await expect(runInNewContext("fetchAllPages('language/models/free', 'key', {body:{data:[]}})", context)).rejects.toThrow('empty snapshot');
  await expect(runInNewContext("fetchAllPages('language/models/free', 'key', {body:{intelligence_index_version:4.2,data:[{id:'one'}],pagination:{page:1,has_more:true}}})", context)).rejects.toThrow('version changed');
});

test('AA model mapping retains unknown evaluation fields and response provenance', () => {
  const { context } = setup();
  const row = runInNewContext("mapModel({id:'one',evaluations:{artificial_analysis_intelligence_index:0.7,new_future_metric:12}}, {path:'language/models/free',intelligenceIndexVersion:4.2,tier:'free'}, '2026-09-05T12:00:00Z')", context);
  expect(row.aa_intelligence_index).toBe(0.7);
  expect(row.evaluations.new_future_metric).toBe(12);
  expect(row.source_metadata.intelligence_index_version).toBe(4.2);
  expect(row.source_metadata.performance_prompt).toBe('long');
  expect(row.last_seen).toBe('2026-09-05T12:00:00Z');
});

test('AA pagination rejects a failed continuation instead of importing page one', async () => {
  const { context } = setup(async () => new Response('unavailable', { status: 503 }));
  await expect(runInNewContext("fetchAllPages('language/models/free', 'key', {body:{intelligence_index_version:4.2,data:[{id:'one'}],pagination:{page:1,has_more:true}}})", context)).rejects.toThrow('page 2: 503');
});
