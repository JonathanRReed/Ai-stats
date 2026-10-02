import {expect,test} from 'bun:test';
import * as usage from './sync-openrouter-usage.mjs';
const now='2026-10-02T07:00:00Z';
const fixture=()=>({meta:{version:'v1',as_of:'2026-10-02T02:00:00Z',start_date:'2026-09-29',end_date:'2026-10-01'},
 data:[{date:'2026-09-29',model_permaslug:'lab/a',total_tokens:'9007199254740993'},
 {date:'2026-09-29',model_permaslug:'other',total_tokens:'7'},
 {date:'2026-10-01',model_permaslug:'lab/b',total_tokens:'0'}]});
test('daily usage preserves exact integers, Other, gaps and source dates',()=>{
 const value=usage.normalizeUsageSnapshot?.(fixture(),{now});
 expect(value?.rows).toHaveLength(3);
 expect(value?.rows[0]).toEqual({date:'2026-09-29',modelPermaslug:'lab/a',totalTokens:'9007199254740993'});
 expect(value?.missingDays).toEqual(['2026-09-30']);
 expect(value).toMatchObject({period:'day',estimated:false,filters:{},asOf:'2026-10-02T02:00:00.000Z'});
 expect(value?.rows.some((row:{modelPermaslug:string})=>row.modelPermaslug==='other')).toBe(true);
});
test('daily adapter rejects malformed numbers, duplicate buckets and incomplete days',()=>{
 for(const total_tokens of ['-1','1.5','1e3',Number.MAX_SAFE_INTEGER+1,null]){
  const payload=fixture();payload.data[0].total_tokens=total_tokens as never;
  expect(()=>usage.normalizeUsageSnapshot?.(payload,{now})).toThrow();
 }
 const duplicate=fixture();duplicate.data.push(duplicate.data[0]);
 expect(()=>usage.normalizeUsageSnapshot?.(duplicate,{now})).toThrow();
 const incomplete=fixture();incomplete.data[0].date='2026-10-02';
 expect(()=>usage.normalizeUsageSnapshot?.(incomplete,{now})).toThrow();
 const badDate=fixture();badDate.data[0].date='2026-02-30';
 expect(()=>usage.normalizeUsageSnapshot?.(badDate,{now})).toThrow();
});
test('daily adapter refuses sampled or filtered series',()=>{
 for(const meta of [{period:'week'},{estimated:true},{filters:{category:'programming'}},{modality:'text'}]){
  const payload=fixture();Object.assign(payload.meta,meta);
  expect(()=>usage.normalizeUsageSnapshot?.(payload,{now})).toThrow();
 }
});
test('revised daily snapshot replaces matching date-model values without doubling traffic',()=>{
 const original=usage.normalizeUsageSnapshot?.(fixture(),{now});
 const revised=fixture();revised.data[0].total_tokens='42';
 const update=usage.normalizeUsageSnapshot?.(revised,{now});
 expect(original?.rows[0].totalTokens).toBe('9007199254740993');
 expect(update?.rows).toHaveLength(3);expect(update?.rows[0].totalTokens).toBe('42');
});
test('missing auth makes no upstream request',async()=>{
 let calls=0;
 await expect(usage.fetchUsageSnapshot?.({apiKey:'',now,fetchImpl:async()=>{calls++;return Response.json(fixture());}})).rejects.toThrow();
 expect(calls).toBe(0);
});
test('official request is exact daily UTC data and never follows credential redirects',async()=>{
 let target='',options:RequestInit={};
 const value=await usage.fetchUsageSnapshot?.({apiKey:'test-key',now,fetchImpl:async(url,init)=>{target=String(url);options=init;return Response.json(fixture());}});
 const url=new URL(target);
 expect(url.origin+url.pathname).toBe('https://openrouter.ai/api/v1/datasets/rankings-daily');
 expect(url.searchParams.get('period')).toBe('day');
 expect(url.searchParams.get('end_date')).toBe('2026-10-01');
 expect(url.searchParams.get('start_date')).toBe('2026-07-04');
 expect(options.redirect).toBe('error');expect(target).not.toContain('test-key');
 expect(new Headers(options.headers).get('authorization')).toBe('Bearer test-key');
 expect(value?.rows).toHaveLength(3);
});
test('rate-limit failure exposes only a bounded retry receipt and no provider body or key',async()=>{
 let error:unknown;
 try{await usage.fetchUsageSnapshot?.({apiKey:'test-key',now,fetchImpl:async()=>new Response('secret provider body',{status:429,headers:{'Retry-After':'7200'}})});}catch(value){error=value;}
 expect(error).toMatchObject({status:429,retryAt:'2026-10-02T09:00:00.000Z'});
 expect(String(error)).not.toContain('secret provider body');expect(String(error)).not.toContain('test-key');
});

test('invalid or timezone-less observation timestamps are rejected without normalization',()=>{
 for(const as_of of ['2026-09-31T02:00:00Z','2026-10-02T02:00:00','2026-10-01T24:00:00Z']){
  const payload=fixture();payload.meta.as_of=as_of;expect(()=>usage.normalizeUsageSnapshot(payload,{now})).toThrow();
 }
});
test('daily source admits at most 50 named models, with Other separately optional',()=>{
 const payload=fixture();payload.data=Array.from({length:51},(_,index)=>({date:'2026-10-01',model_permaslug:'lab/'+index,total_tokens:'1'}));
 expect(()=>usage.normalizeUsageSnapshot(payload,{now})).toThrow();
 payload.data.pop();expect(usage.normalizeUsageSnapshot(payload,{now}).rows).toHaveLength(50);
 payload.data.push({date:'2026-10-01',model_permaslug:'other',total_tokens:'2'});
 expect(usage.normalizeUsageSnapshot(payload,{now}).rows).toHaveLength(51);
});
test('HTTP failure backoff escalates from the persisted attempt count',async()=>{
 let receipt:unknown;
 await usage.prepareUsageRefresh({apiKey:'test-key',now,
  store:{claim:async()=>({claimed:true,leaseId:'lease',attempts:8}),fail:async(value:unknown)=>{receipt=value;}},
  fetchImpl:async()=>new Response(null,{status:500})});
 expect(receipt).toMatchObject({notBefore:'2026-10-02T07:04:16.000Z'});
});
