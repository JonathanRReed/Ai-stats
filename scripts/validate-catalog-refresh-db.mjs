
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const modulePath=process.env.PGLITE_TEST_MODULE;
if(!modulePath)throw new Error('Set PGLITE_TEST_MODULE for isolated catalog database verification');
const {PGlite}=await import(modulePath);
const db=new PGlite();
try{
 await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema private;
  create table public.intelligence_sources(
   id bigint generated always as identity primary key, source_key text unique not null,
   display_name text not null, description text, homepage_url text, license_name text,
   status text not null default 'unavailable',status_message text,coverage_label text,
   last_observed_at timestamptz,last_successful_run_at timestamptz,is_enabled boolean not null default true,
   metadata jsonb not null default '{}',updated_at timestamptz not null default now());
  insert into public.intelligence_sources(source_key,display_name) values('openrouter','OpenRouter');
  grant usage on schema public,private to service_role;
  grant select,insert,update on public.intelligence_sources to service_role;
  grant usage,select on sequence public.intelligence_sources_id_seq to service_role;
 `);
 await db.exec(await readFile('supabase/migrations/20261002014704_validated_source_snapshots.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261002054319_durable_catalog_refresh.sql','utf8'));
 await db.exec('set role service_role');
 const claim=async()=> (await db.query("select public.claim_catalog_refresh('openrouter') as result")).rows[0].result;
 const first=await claim();assert.equal(first.claimed,true);
 assert.equal((await claim()).reason,'active');
 const payload={schemaVersion:1,sourceKey:'openrouter',observedAt:null,records:[{id:'lab/model',prompt_price_1m:0}]};
 const publish=async(leaseId)=> (await db.query(
  "select public.publish_catalog_refresh('openrouter',$1,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',null,now(),$2::jsonb,1,'v1',null) as id",
  [leaseId,JSON.stringify(payload)])).rows[0].id;
 await assert.rejects(publish('00000000-0000-0000-0000-000000000000'),/lease/);
 const id=await publish(first.leaseId);
 assert.equal((await claim()).reason,'interval');
 const current=async()=> (await db.query("select snapshot_id,published_at,payload from public.source_snapshot_cache where source_key='openrouter'")).rows[0];
 const initial=await current();
 const makeDue=()=>db.exec("update public.source_snapshot_cache set fetched_at=now()-interval '2 days' where source_key='openrouter'");
 await makeDue();
 const unchanged=await claim();assert.equal(unchanged.claimed,true);
 assert.equal(await publish(unchanged.leaseId),id);
 assert.equal(new Date((await current()).published_at).getTime(),new Date(initial.published_at).getTime(),'unchanged content retains its publication date');
 await makeDue();
 const failure=await claim();
 await db.query("select public.fail_catalog_refresh('openrouter',$1,now()+interval '2 hours','rate limited')",[failure.leaseId]);
 assert.equal((await claim()).reason,'backoff');
 assert.equal((await current()).snapshot_id,id,'failure preserves last-good snapshot');
 assert.equal((await db.query("select refresh_status from public.source_snapshot_cache where source_key='openrouter'")).rows[0].refresh_status,'failed');
 await db.exec("update private.catalog_refresh_state set next_allowed_at=null,lease_until=null where source_key='openrouter'");
 const expired=await claim();
 await db.exec("update private.catalog_refresh_state set lease_until=now()-interval '1 second' where source_key='openrouter'");
 const replacement=await claim();assert.equal(replacement.claimed,true);
 await assert.rejects(publish(expired.leaseId),/lease/);
 await db.query("select public.fail_catalog_refresh('openrouter',$1,now(),'test cleanup')",[replacement.leaseId]);
 await db.exec("update private.catalog_refresh_state set next_allowed_at=null,requests_today=8,request_day=(now() at time zone 'UTC')::date where source_key='openrouter'");
 assert.equal((await claim()).reason,'quota');
 await db.exec("update private.catalog_refresh_state set request_day=(now() at time zone 'UTC')::date-1 where source_key='openrouter'");
 assert.equal((await claim()).claimed,true,'daily request allowance resets on UTC date');
 await db.exec('reset role;set role anon');
 assert.equal((await current()).snapshot_id,id);
 await assert.rejects(claim(),/permission denied/);
 await assert.rejects(db.query('select * from private.catalog_refresh_state'),/permission denied/);
 console.log('PASS: catalog leases, quotas, backoff, atomic publication, last-good retention, unchanged receipts and access boundaries');
}finally{await db.close();}
