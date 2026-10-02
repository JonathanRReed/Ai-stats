import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const modulePath=process.env.PGLITE_TEST_MODULE;if(!modulePath)throw new Error('Set isolated database module');
const {PGlite}=await import(modulePath);const db=new PGlite();
try{
 await db.exec('create schema private; create table private.source_snapshots(id bigint primary key); create table public.source_snapshot_cache(source_key text primary key,snapshot_id bigint references private.source_snapshots(id)); insert into private.source_snapshots values(1),(2); insert into public.source_snapshot_cache values(\'aa\',1),(\'epoch\',2);');
 const paths=(await readdir('supabase/migrations')).filter(path=>path.endsWith('_index_source_snapshot_cache_reference.sql'));
 assert.equal(paths.length,1);
 const sql=await readFile('supabase/migrations/'+paths[0],'utf8');
 await db.exec(sql);await db.exec(sql);
 const indexes=(await db.query("select indexdef from pg_indexes where schemaname='public' and indexname='idx_source_snapshot_cache_snapshot_id'")).rows;
 assert.equal(indexes.length,1);assert.match(indexes[0].indexdef,/snapshot_id/);
 assert.equal((await db.query('select count(*)::int as n from public.source_snapshot_cache')).rows[0].n,2);
 await assert.rejects(db.exec("insert into public.source_snapshot_cache values('invalid',3)"),/foreign key/i);
 console.log('PASS: covering cache index, idempotence, retained rows and foreign key enforcement');
}finally{await db.close();}
