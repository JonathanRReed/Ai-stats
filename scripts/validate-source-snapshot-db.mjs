import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const modulePath = process.env.PGLITE_TEST_MODULE;
if (!modulePath) throw new Error('Set PGLITE_TEST_MODULE to the isolated test-only PGlite module');
const { PGlite } = await import(modulePath);
const db = new PGlite();
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema private;
    create table public.intelligence_sources (
      id bigint generated always as identity primary key,
      source_key text not null unique
    );
    insert into public.intelligence_sources(source_key) values ('epoch-ai');
    grant usage on schema public, private to service_role;
    grant select on public.intelligence_sources to service_role;
  `);
  await db.exec(await readFile('supabase/migrations/20261002032322_validated_source_snapshots.sql', 'utf8'));
  const registered = await db.query("select to_regprocedure('public.promote_source_snapshot(bigint)') is not null as ready");
  assert.equal(registered.rows[0].ready, true, 'Snapshot promotion RPC must exist');
  const payload = { schemaVersion: 1, sourceKey: 'epoch-ai', observedAt: '2026-10-01T00:00:00.000Z', records: [{ id: 'one', value: 0 }] };
  const stage = async (data, hash, fetched = '2026-10-02T00:00:00Z') => {
    const result = await db.query('select public.stage_source_snapshot($1,$2,$3,$4,$5::jsonb,$6) as id',
      ['epoch-ai', hash, data.observedAt, fetched, JSON.stringify(data), data.records.length]);
    return result.rows[0].id;
  };
  await db.exec('set role service_role');
  const first = await stage(payload, 'a'.repeat(64));
  await db.query('select public.promote_source_snapshot($1)', [first]);
  const getCurrent = async () => (await db.query("select snapshot_id,payload from public.source_snapshot_cache where source_key='epoch-ai'")).rows[0];
  assert.equal((await getCurrent()).snapshot_id, first, 'Validated source should publish');
  assert.equal(await stage(payload, 'a'.repeat(64)), first, 'Unchanged snapshot should be idempotent');
  await assert.rejects(stage({ ...payload, records: [] }, 'b'.repeat(64)), /empty|count/);
  await assert.rejects(stage({ ...payload, records: [{ id: 'x', raw: { api_key: 'example' } }] }, 'b'.repeat(64)), /private/);
  await assert.rejects(stage({ ...payload, records: [{ id: 'x' }, { id: 'x' }] }, 'b'.repeat(64)), /duplicate/);
  assert.equal((await getCurrent()).snapshot_id, first, 'Rejected data must preserve last good pointer');
  const revised = { ...payload, records: [{ id: 'two', value: 4 }] };
  const second = await stage(revised, 'c'.repeat(64), '2026-10-02T02:00:00Z');
  assert.equal((await getCurrent()).snapshot_id, first, 'Staging cannot publish a partial snapshot');
  await db.query('select public.promote_source_snapshot($1)', [second]);
  assert.equal((await getCurrent()).snapshot_id, second);
  const history = await db.query('select count(*)::int as n from private.source_snapshots');
  assert.equal(history.rows[0].n, 2, 'Replacing current membership must preserve history');
  await assert.rejects(db.query('select public.promote_source_snapshot($1)', [first]), /older/);
  const oldEvidence = { ...payload, observedAt: '2026-09-29T00:00:00Z', records: [{ id: 'old', value: 1 }] };
  const third = await stage(oldEvidence, 'd'.repeat(64), '2026-10-02T03:00:00Z');
  await assert.rejects(db.query('select public.promote_source_snapshot($1)', [third]), /older/);
  assert.equal((await getCurrent()).snapshot_id, second, 'A fresh download cannot replace newer source evidence');
  await db.exec('reset role; set role anon');
  assert.equal((await getCurrent()).snapshot_id, second, 'Public sanitized cache must be readable');
  await assert.rejects(db.query('select * from private.source_snapshots'), /permission denied/);
  await assert.rejects(db.query('select public.promote_source_snapshot($1)', [first]), /permission denied/);
  await assert.rejects(db.query("delete from public.source_snapshot_cache"), /permission denied/);
  console.log('PASS: promotion, idempotence, malformed input, historical retention, ordering and access boundaries');
} finally { await db.close(); }
