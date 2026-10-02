import {expect,test} from 'bun:test';
import {prepareSourceSnapshot} from './source-snapshots.mjs';
import {createCatalogStore} from './refresh-public-catalogs.mjs';
import * as sync from './sync-openrouter-usage.mjs';
const snapshot={schemaVersion:1,period:'day',estimated:false,filters:{},asOf:'2026-10-02T02:00:00.000Z',
 startDate:'2026-10-01',endDate:'2026-10-01',missingDays:[],sourceUrl:'https://openrouter.ai/rankings',
 licenseUrl:'https://creativecommons.org/licenses/by/4.0/',rows:[{date:'2026-10-01',modelPermaslug:'lab/a',totalTokens:'42'}]};
test('usage refresh without auth does not claim a lease or publish',async()=>{
 let calls=0;
 const result=await sync.prepareUsageRefresh?.({apiKey:'',store:{claim:async()=>{calls++;return {claimed:true};}}});
 expect(result).toMatchObject({sourceKey:'openrouter-usage',status:'blocked'});expect(calls).toBe(0);
});
test('usage candidate keeps one replaceable dated snapshot, not appended traffic',async()=>{
 const result=await sync.prepareUsageRefresh?.({apiKey:'test-key',now:'2026-10-02T07:00:00Z',
 store:{claim:async()=>({claimed:true,leaseId:'lease'}),fail:async()=>{}},
 fetchImpl:async()=>Response.json({meta:{as_of:snapshot.asOf,start_date:snapshot.startDate,end_date:snapshot.endDate,version:'v1'},
 data:[{date:'2026-10-01',model_permaslug:'lab/a',total_tokens:'42'}]})});
 expect(result).toMatchObject({status:'prepared',sourceKey:'openrouter-usage',leaseId:'lease'});
 expect(result?.input).toMatchObject({sourceKey:'openrouter-usage',observedAt:snapshot.asOf,records:[{id:'daily-usage',snapshot}]});
});
test('usage rate limit persists its lease-specific hold',async()=>{
 let failure:unknown;
 const result=await sync.prepareUsageRefresh?.({apiKey:'test-key',now:'2026-10-02T07:00:00Z',
 store:{claim:async()=>({claimed:true,leaseId:'lease'}),fail:async(value:unknown)=>{failure=value;}},
 fetchImpl:async()=>new Response(null,{status:429,headers:{'Retry-After':'7200'}})});
 expect(result?.status).toBe('failed');expect(failure).toMatchObject({sourceKey:'openrouter-usage',leaseId:'lease',notBefore:'2026-10-02T09:00:00.000Z'});
});

test('usage storage uses the existing guarded RPC without opening arbitrary sources',async()=>{
 const calls:string[]=[];
 const store=createCatalogStore({baseUrl:'https://bgbqdzmgxkwstjihgeef.supabase.co',serviceKey:'test-key',
 fetchImpl:async(input)=>{calls.push(String(input));return Response.json({claimed:false,reason:'interval'});}});
 expect(await store.claim('openrouter-usage')).toMatchObject({claimed:false,reason:'interval'});
 expect(calls[0]).toContain('/rpc/claim_catalog_refresh');
 await expect(store.claim('unknown')).rejects.toThrow();
});
test('usage cache verifies exact snapshot identity and reports its original dates',()=>{
 const input={sourceKey:'openrouter-usage',observedAt:snapshot.asOf,fetchedAt:'2026-10-02T03:00:00Z',records:[{id:'daily-usage',snapshot}]};
 const normalized=prepareSourceSnapshot(input);
 const cache={source_key:'openrouter-usage',snapshot_id:42,content_hash:normalized.contentHash,record_count:1,
 fetched_at:input.fetchedAt,published_at:'2026-10-02T04:00:00Z',refresh_status:'healthy',
 payload:{schemaVersion:1,sourceKey:input.sourceKey,observedAt:input.observedAt,records:input.records}};
 expect(sync.parseUsageCache?.(cache,{now:'2026-10-02T07:00:00Z'})).toMatchObject({snapshot,receipt:{snapshotId:'42',fetchedAt:'2026-10-02T03:00:00.000Z'}});
 expect(sync.parseUsageCache?.({...cache,content_hash:'b'.repeat(64)},{now:'2026-10-02T07:00:00Z'})).toBeNull();
});

test('usage CLI keeps missing-auth runs inert and rejects malformed publish candidates',async()=>{
 let wrote:unknown;let published=0;
 const store={claim:async()=>({claimed:false}),publish:async()=>{published++;return 1;}};
 const result=await sync.runUsageCli?.({argv:['--prepare','--file','test.json'],env:{},store,
 writeJson:async(_path:string,value:unknown)=>{wrote=value;}});
 expect(result).toMatchObject({status:'blocked'});expect(wrote).toMatchObject({status:'blocked'});
 await expect(sync.runUsageCli?.({argv:['--publish','--file','test.json'],env:{},store,
 readJson:async()=>({sourceKey:'openrouter-usage',status:'prepared',leaseId:'lease',input:{sourceKey:'openrouter-usage',records:[]}})})).rejects.toThrow();
 expect(published).toBe(0);
});
