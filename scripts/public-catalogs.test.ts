import {expect,test} from 'bun:test';
import * as catalogs from './public-catalogs.mjs';
import * as refresh from './refresh-public-catalogs.mjs';
test('catalogs preserve zero and unknown prices while stripping unapproved fields',()=>{
 const rows=catalogs.normalizeCatalog?.('openrouter',{data:[
  {id:'lab/free',pricing:{prompt:'0',completion:'0'},secret:'omit'},
  {id:'lab/unknown',pricing:{prompt:null,completion:''}},
 ]});
 expect(rows?.[0]).toMatchObject({id:'lab/free',prompt_price_1m:0,completion_price_1m:0,is_free:true});
 expect(rows?.[1]).toMatchObject({prompt_price_1m:null,completion_price_1m:null,is_free:false});
 expect(JSON.stringify(rows)).not.toContain('secret');
});
test('catalog snapshots reject empty, duplicate and malformed identities',()=>{
 for(const payload of [{data:[]},{data:[{id:'a'},{id:'a'}]},{data:[{name:'no id'}]}])
  expect(()=>catalogs.normalizeCatalog?.('openrouter',payload)).toThrow();
});
test('HF and LiteLLM retain source fields without inventing retrieval dates',()=>{
 expect(catalogs.normalizeCatalog?.('huggingface',[{id:'lab/model',downloads:0,likes:4,tags:['text'],lastModified:'2025-01-01'}])?.[0])
  .toMatchObject({model_id:'lab/model',downloads:0,likes:4,last_modified:'2025-01-01'});
 const rows=catalogs.normalizeCatalog?.('litellm',{'sample_spec':{},'provider/model':{mode:'chat',input_cost_per_token:0.000002,output_cost_per_token:0,supports_vision:true},image:{mode:'image_generation'}});
 expect(rows).toHaveLength(1);expect(rows?.[0]).toMatchObject({id:'provider/model',input_price_1m:2,output_price_1m:0,supports_vision:true});
 expect(JSON.stringify(rows)).not.toContain('fetched_at');
});
const now='2026-10-02T06:00:00.000Z';
const snapshot={snapshot_id:1,content_hash:'a'.repeat(64),fetched_at:'2026-10-01T00:00:00Z',
 payload:{schemaVersion:1,sourceKey:'openrouter',observedAt:null,records:[{id:'lab/model',name:'Model'}]}};
test('an unclaimed lease makes no upstream requests',async()=>{
 let requests=0;
 const store={claim:async()=>({claimed:false,reason:'backoff'}),current:async()=>snapshot,fail:async()=>{}};
 const result=await refresh.prepareCatalogRefresh?.({sourceKey:'openrouter',store,now,fetchImpl:async()=>{requests++;return Response.json({});}});
 expect(result?.status).toBe('skipped');expect(requests).toBe(0);
});
test('a conditional 304 reuses only an existing validated snapshot and keeps observation time',async()=>{
 let validator:string|null=null;
 const store={claim:async()=>({claimed:true,leaseId:'lease',etag:'"v1"',attempts:0}),current:async()=>snapshot,fail:async()=>{}};
 const result=await refresh.prepareCatalogRefresh?.({sourceKey:'openrouter',store,now,fetchImpl:async(_url:unknown,init?:RequestInit)=>{
  validator=new Headers(init?.headers).get('if-none-match');return new Response(null,{status:304});
 }});
 expect(validator as string|null).toBe('"v1"');expect(result?.status).toBe('unchanged');
 expect(result?.input).toMatchObject({observedAt:null,fetchedAt:now,records:snapshot.payload.records});
});
test('429 respects Retry-After, does not publish, and keeps last-good data',async()=>{
 const failures:Array<{notBefore:string}>=[];let requests=0;
 const store={claim:async()=>({claimed:true,leaseId:'lease',attempts:0}),current:async()=>snapshot,fail:async(value:{notBefore:string})=>{failures.push(value);}};
 const result=await refresh.prepareCatalogRefresh?.({sourceKey:'openrouter',store,now,fetchImpl:async()=>{requests++;return new Response(null,{status:429,headers:{'Retry-After':'7200'}});}});
 expect(result?.status).toBe('failed');expect(requests).toBe(1);expect(failures[0].notBefore).toBe('2026-10-02T08:00:00.000Z');
 expect(result?.input).toBeUndefined();
});
test('304 without a usable cache cannot become a successful refresh',async()=>{
 let failed=false;
 const store={claim:async()=>({claimed:true,leaseId:'lease',attempts:0}),current:async()=>null,fail:async()=>{failed=true;}};
 const result=await refresh.prepareCatalogRefresh?.({sourceKey:'openrouter',store,now,fetchImpl:async()=>new Response(null,{status:304})});
 expect(result?.status).toBe('failed');expect(failed).toBe(true);
});

test('catalog store rejects other projects before sending server credentials',()=>{
 expect(()=>refresh.createCatalogStore?.({baseUrl:'https://other.supabase.co',serviceKey:'test-key'})).toThrow();
});
test('catalog store sends credentials only in headers to the fixed project',async()=>{
 const calls:Array<{url:string;headers:Headers}>=[]; 
 const store=refresh.createCatalogStore?.({baseUrl:'https://bgbqdzmgxkwstjihgeef.supabase.co',serviceKey:'test-key',
 fetchImpl:async(input:string|URL|Request,init?:RequestInit)=>{calls.push({url:String(input),headers:new Headers(init?.headers)});return Response.json({claimed:false,reason:'interval'});}});
 expect(store).toBeDefined();await store?.claim('openrouter');
 expect(calls[0].url).not.toContain('test-key');expect(calls[0].headers.get('authorization')).toBe('Bearer test-key');
});
test('an unchanged 200 response clears obsolete HTTP validators',async()=>{
 const store={claim:async()=>({claimed:true,leaseId:'lease',etag:'old-etag',lastModified:'old-date',attempts:0}),current:async()=>snapshot,fail:async()=>{}};
 const result=await refresh.prepareCatalogRefresh({sourceKey:'openrouter',store,now,fetchImpl:async()=>Response.json({data:[{id:'lab/model'}]})});
 expect(result.etag).toBeNull();expect(result.lastModified).toBeNull();
});

test('malformed LiteLLM records cannot replace last-good measurements',async()=>{
 for(const value of [null,[], 'broken'])expect(()=>catalogs.normalizeCatalog('litellm',{'provider/model':value})).toThrow();
 let failed=false;
 const store={claim:async()=>({claimed:true,leaseId:'lease',attempts:0}),current:async()=>({...snapshot,payload:{...snapshot.payload,sourceKey:'litellm',records:[{id:'provider/model',input_price_1m:2,max_input_tokens:10000}]}}),fail:async()=>{failed=true;}};
 const result=await refresh.prepareCatalogRefresh({sourceKey:'litellm',store,now,fetchImpl:async()=>Response.json({'provider/model':null})});
 expect(result.status).toBe('failed');expect(result.input).toBeUndefined();expect(failed).toBe(true);
});
