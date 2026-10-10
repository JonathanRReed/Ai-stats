import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const modulePath=process.env.PGLITE_TEST_MODULE;
if(!modulePath)throw new Error('Set PGLITE_TEST_MODULE to the isolated test database module');
const {PGlite}=await import(modulePath);const db=new PGlite();
try{
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');
 const manifest={datasetRevision:'d'.repeat(64),schemaVersion:'ai-stats-compare-release.v1',generatedAt:'2026-10-02T12:00:00.000Z',models:[{id:'a'},{id:'b'}],defaultModelIds:['a','b'],delivery:{catalog:{rows:[['a'],['b']]}}};
 const assets={m00:{records:[{id:'a'}]},m01:{records:[{id:'b'}]}};
 const publish=async(revision,data=manifest,contents=assets)=>db.query('select public.publish_app_release($1,$2::jsonb,$3::jsonb,$4::jsonb) as revision',[revision,JSON.stringify(data),JSON.stringify(contents),JSON.stringify([])]);
 const current=async()=> (await db.query('select revision from public.app_release_cache where active')).rows[0]?.revision;
 // Check each deployed function boundary before a later replacement can mask it.
 const assertBoundary=async(stage,hasTimeout)=>{
  for(const signature of ['public.publish_app_release(text,jsonb,jsonb,jsonb)','public.rollback_app_release(text)']) {
   const fn=(await db.query('select prosecdef,proconfig from pg_proc where oid=$1::regprocedure',[signature])).rows[0];
   assert.equal(fn.prosecdef,false,stage+': '+signature+' must remain security invoker');
   assert.ok(fn.proconfig.includes('search_path=""'),stage+': '+signature+' must retain an empty search_path');
   if(signature.startsWith('public.publish_app_release(')) {
    const timeout=fn.proconfig.find(value=>value.startsWith('statement_timeout='));
    assert.equal(timeout,hasTimeout?'statement_timeout=30s':undefined,
     hasTimeout?stage+' must configure statement_timeout=30s':stage+' must start without a function timeout');
   }
   for(const role of ['anon','authenticated','service_role']) {
    const allowed=(await db.query("select has_function_privilege($1,$2,'EXECUTE') as allowed",[role,signature])).rows[0].allowed;
    assert.equal(allowed,role==='service_role',stage+': '+role+' execute boundary for '+signature);
   }
  }
  assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.app_release_cache'::regclass")).rows[0].relrowsecurity,true,stage+': cache RLS must remain enabled');
  for(const role of ['anon','authenticated','service_role']) {
   for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) {
    const allowed=(await db.query("select has_table_privilege($1,'public.app_release_cache',$2) as allowed",[role,privilege])).rows[0].allowed;
    const expected=privilege==='SELECT'||(role==='service_role'&&['INSERT','UPDATE'].includes(privilege));
    assert.equal(allowed,expected,stage+': '+role+' '+privilege+' cache boundary');
   }
  }
  await db.exec('set role service_role');
  try {
   await publish('a'.repeat(64));
   assert.equal(await current(),'a'.repeat(64),stage+': service_role can publish');
   await db.query('select public.rollback_app_release($1)',['a'.repeat(64)]);
  }finally{await db.exec('reset role');}
  for(const role of ['anon','authenticated']) {
   await db.exec('set role '+role);
   try {
    assert.equal(await current(),'a'.repeat(64),stage+': '+role+' can read the cache');
    await assert.rejects(publish('a'.repeat(64)),/permission denied/i);
    await assert.rejects(db.query('select public.rollback_app_release($1)',['a'.repeat(64)]),/permission denied/i);
    await assert.rejects(db.query('update public.app_release_cache set active=false'),/permission denied/i);
   }finally{await db.exec('reset role');}
  }
  // Only this disposable synthetic cache is cleared between migration stages.
  await db.exec('delete from public.app_release_cache');
 };
 await db.exec(await readFile('supabase/migrations/20261002200437_independent_app_release_cache.sql','utf8'));
 await assertBoundary('base release migration',false);
 await db.exec(await readFile('supabase/migrations/20261003024932_app_release_publication_timeout.sql','utf8'));
 await assertBoundary('standalone timeout migration',true);
 await db.exec(await readFile('supabase/migrations/20261003173339_publisher_release_protocol_v2.sql','utf8'));
 await assertBoundary('publisher-v2 migration',true);
 console.log('PASS: synthetic base → timeout → publisher-v2 path, intermediate 30s timeout and invoker/service-only boundaries');
 await db.exec('set role service_role');
 await publish('a'.repeat(64));assert.equal(await current(),'a'.repeat(64));
 await publish('a'.repeat(64));assert.equal((await db.query('select count(*)::int as n from public.app_release_cache')).rows[0].n,1);
 await assert.rejects(publish('b'.repeat(64),{...manifest,models:[]}),/empty|seed|manifest/i);assert.equal(await current(),'a'.repeat(64));
 await assert.rejects(publish('b'.repeat(64),{...manifest,password:'do-not-publish'}),/private/i);
 await assert.rejects(publish('b'.repeat(64),{...manifest,models:[null,null]}),/seed|identity/i);
 await assert.rejects(publish('b'.repeat(64),{...manifest,raw_response:{client_secret:'private'}}),/private/i);
 await publish('b'.repeat(64),{...manifest,generatedAt:'2026-10-02T13:00:00.000Z'});
 await db.query('select public.rollback_app_release($1)',['a'.repeat(64)]);
 await assert.rejects(publish('b'.repeat(64),{...manifest,generatedAt:'2026-10-02T13:00:00.000Z'},{m00:{changed:true}}),/conflict/i);
 assert.equal(await current(),'a'.repeat(64));
 await publish('b'.repeat(64),{...manifest,generatedAt:'2026-10-02T13:00:00.000Z'});
 await publish('c'.repeat(64),{...manifest,generatedAt:'2026-10-02T14:00:00.000Z'});
 assert.equal((await db.query('select count(*)::int as n from public.app_release_cache')).rows[0].n,2);
 await assert.rejects(publish('d'.repeat(64)),/older/i);assert.equal(await current(),'c'.repeat(64));
 await db.query('select public.rollback_app_release($1)', ['b'.repeat(64)]);assert.equal(await current(),'b'.repeat(64));
 await publish('e'.repeat(64),{...manifest,schemaVersion:'ai-stats-compare-release.v2',generatedAt:'2026-10-02T15:00:00.000Z'});assert.equal(await current(),'e'.repeat(64));
 await assert.rejects(publish('f'.repeat(64),{...manifest,schemaVersion:'ai-stats-compare-release.v3'}),/manifest/i);
 await assert.rejects(publish('f'.repeat(64),{...manifest,schemaVersion:null}),/manifest/i);
 await db.query('select public.rollback_app_release($1)',['b'.repeat(64)]);
 await db.exec('reset role; set role anon');
 assert.equal(await current(),'b'.repeat(64));
 await assert.rejects(publish('d'.repeat(64)),/permission denied/i);
 await assert.rejects(db.query('select public.rollback_app_release($1)',['c'.repeat(64)]),/permission denied/i);
 await assert.rejects(db.query('update public.app_release_cache set active=false'),/permission denied/i);
 console.log('PASS: atomic release promotion, bounded derived cache, idempotence, rejection, rollback and public read-only boundary');
}finally{await db.close();}
