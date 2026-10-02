import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const modulePath=process.env.PGLITE_TEST_MODULE;if(!modulePath)throw new Error('Set isolated database module');
const {PGlite}=await import(modulePath);const db=new PGlite();
try{
 await db.exec('create schema private; create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public,private to service_role;');
 await db.exec(await readFile('supabase/migrations/20261002201013_aa_fixed_window_refresh.sql','utf8'));
 const call=async(sql,params=[])=> (await db.query(sql,params)).rows[0].value;
 await db.exec('set role service_role');
 const claim=await call('select public.claim_aa_refresh() as value');assert.equal(claim.claimed,true);
 assert.equal((await call('select public.claim_aa_refresh() as value')).reason,'active');
 const lease=claim.leaseId;
 assert.equal(await call('select public.reserve_aa_request($1) as value',[lease]),true);
 const reset=new Date(Date.now()+12*3600000).toISOString();
 await call('select public.record_aa_response($1,$2,$3,$4,$5) as value',[lease,100,10,reset,null]);
 assert.equal(await call('select public.reserve_aa_request($1) as value',[lease]),false);
 await call('select public.finish_aa_refresh($1,$2) as value',[lease,false]);
 assert.equal((await call('select public.claim_aa_refresh() as value')).reason,'backoff');
 await db.exec("update private.aa_refresh_state set next_allowed_at=null,window_reset_at=now()-interval '1 second',requests_used=90,remaining=0");
 const next=await call('select public.claim_aa_refresh() as value');assert.equal(next.claimed,true);
 assert.equal(await call('select public.reserve_aa_request($1) as value',[next.leaseId]),true);
 assert.equal((await db.query('select requests_used,remaining from private.aa_refresh_state')).rows[0].requests_used,1);
 await call('select public.finish_aa_refresh($1,$2) as value',[next.leaseId,true]);
 assert.equal((await call('select public.claim_aa_refresh() as value')).reason,'interval');
 await db.exec('reset role; set role anon');
 await assert.rejects(call('select public.claim_aa_refresh() as value'),/permission denied/);
 await assert.rejects(db.query('select * from private.aa_refresh_state'),/permission denied/);
 console.log('PASS: AA lease, fixed window reset, quota reserve, backoff, cadence and public denial');
}finally{await db.close();}
