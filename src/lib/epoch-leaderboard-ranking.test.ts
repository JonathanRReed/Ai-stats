import {expect,test} from 'bun:test';
import {
 buildEpochRankingPayload,
 createEpochRankingController,
 epochRankingUrl,
 parseEpochRankingPayload,
 visibleCountAfterExpansion,
 type EpochRankingPayload,
} from './epoch-leaderboard-ranking';
import type {EpochBenchmark,EpochBenchmarkRun} from './supabase';

const R1='a'.repeat(64),R2='b'.repeat(64);
const benchmark:EpochBenchmark={id:'gpqa',slug:'gpqa',name:'GPQA',description:null,source:null,metadata:{benchmark:'epoch'}};
const run=(id:string,score:number):EpochBenchmarkRun=>({
 id,model_version:'m:'+id,benchmark_id:'gpqa',benchmark_slug:'gpqa',score,score_metric:'accuracy',
 score_unit:'percent',benchmark_version:'1',higher_is_better:true,conditions:null,organization:'Org',
 source_key:undefined,source_name:'Epoch',source_link:null,release_date:null,country:null,stderr:null,evaluation_date:null,
});
const corpus=(revision:string,rows:EpochBenchmarkRun[]):EpochRankingPayload=>buildEpochRankingPayload({
 revision,benchmarks:[benchmark],runs:rows,labels:{gpqa:'GPQA'},modelNames:Object.fromEntries(rows.map(row=>[row.model_version,'Name '+row.id])),
});
const fullRows=Array.from({length:8},(_,index)=>run('r'+index,90-index));
const topFive=fullRows.slice(0,5);
const ids=(rows:EpochBenchmarkRun[])=>rows.map(row=>row.id);
const scores=(rows:EpochBenchmarkRun[])=>Object.fromEntries(rows.map(row=>[row.id,row.score]));

function deferredFetch(){
 const calls:Array<{url:string;resolve:(response:Response)=>void;reject:(error:Error)=>void}>=[];
 const fetch=(url:string)=>new Promise<Response>((resolve,reject)=>{calls.push({url,resolve,reject});});
 return {calls,fetch};
}
const page=()=>({revision:R1,benchmarks:[benchmark],runs:topFive,modelNames:{}});
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));

test('the full ranking payload carries every ranked row and its page revision',()=>{
 const payload=corpus(R1,fullRows);
 expect(payload.revision).toBe(R1);
 expect(ids(payload.runs as EpochBenchmarkRun[])).toEqual(['r0','r1','r2','r3','r4','r5','r6','r7']);
 expect(payload.modelNames['m:r7']).toBe('Name r7');
 expect(parseEpochRankingPayload(JSON.parse(JSON.stringify(payload)),R1).runs).toHaveLength(8);
 expect(()=>parseEpochRankingPayload(payload,R2)).toThrow('Epoch ranking revision does not match this page');
 expect(epochRankingUrl(R1)).toBe(`/api/epoch-ranking/${R1}.json`);
});

test('concurrent expansions share one request for the page revision and adopt the full ranking',async()=>{
 const network=deferredFetch();
 const ranking=createEpochRankingController(page(),{fetch:network.fetch});
 const first=ranking.ensureComplete(),second=ranking.ensureComplete();
 expect(ranking.status()).toBe('loading');
 await flush();
 expect(network.calls.map(call=>call.url)).toEqual([`/api/epoch-ranking/${R1}.json`]);
 network.calls[0].resolve(Response.json(corpus(R1,fullRows)));
 expect(await Promise.all([first,second])).toEqual([true,true]);
 expect(ids(ranking.view().runs)).toEqual(['r0','r1','r2','r3','r4','r5','r6','r7']);
 expect(ranking.status()).toBe('idle');
 expect(await ranking.ensureComplete()).toBe(true);
 expect(network.calls).toHaveLength(1);
});

test('a late page-revision response cannot overwrite newer live rows or resurrect withdrawn ones',async()=>{
 const network=deferredFetch();
 const ranking=createEpochRankingController(page(),{fetch:network.fetch});
 const pending=ranking.ensureComplete();
 await flush();
 // Newer data arrives mid-load: r0 is rescored and r1 is withdrawn.
 const liveRows=[run('r0',99),...fullRows.slice(2)];
 expect(ranking.applyLiveSnapshot({benchmarks:[benchmark],runs:liveRows,modelNames:{}})).toBe(true);
 network.calls[0].resolve(Response.json(corpus(R1,fullRows)));
 expect(await pending).toBe(true);
 expect(ids(ranking.view().runs)).toEqual(['r0','r2','r3','r4','r5','r6','r7']);
 expect(scores(ranking.view().runs).r0).toBe(99);
 // Retrying after the invalidation keeps the live rows and does not refetch the old revision.
 expect(await ranking.ensureComplete()).toBe(true);
 expect(network.calls).toHaveLength(1);
 expect(ids(ranking.view().runs)).toEqual(['r0','r2','r3','r4','r5','r6','r7']);
 expect(scores(ranking.view().runs).r0).toBe(99);
});

test('a ranking from another revision is refused and the rendered rows stay',async()=>{
 const network=deferredFetch();
 const ranking=createEpochRankingController(page(),{fetch:network.fetch});
 const warn=console.warn;console.warn=()=>{};
 try{
  const pending=ranking.ensureComplete();
  await flush();
  // A redeploy or stale cache serves a different dataset: r0 rescored, r1 removed.
  network.calls[0].resolve(Response.json(corpus(R2,[run('r0',10),...fullRows.slice(2)])));
  expect(await pending).toBe(false);
 }finally{console.warn=warn;}
 expect(ranking.status()).toBe('failed');
 expect(ids(ranking.view().runs)).toEqual(['r0','r1','r2','r3','r4']);
 expect(scores(ranking.view().runs).r0).toBe(90);
});

test('a failed expansion keeps the current rows and a retry fetches again',async()=>{
 const network=deferredFetch();
 const ranking=createEpochRankingController(page(),{fetch:network.fetch});
 const warn=console.warn;console.warn=()=>{};
 try{
  const failed=ranking.ensureComplete();
  await flush();
  network.calls[0].resolve(new Response('unavailable',{status:503}));
  expect(await failed).toBe(false);
 }finally{console.warn=warn;}
 expect(ranking.status()).toBe('failed');
 expect(ids(ranking.view().runs)).toEqual(['r0','r1','r2','r3','r4']);
 const retry=ranking.ensureComplete();
 expect(ranking.status()).toBe('loading');
 await flush();
 expect(network.calls).toHaveLength(2);
 network.calls[1].resolve(Response.json(corpus(R1,fullRows)));
 expect(await retry).toBe(true);
 expect(ranking.status()).toBe('idle');
 expect(ranking.view().runs).toHaveLength(8);
});

test('an empty live snapshot does not blank the leaderboard',()=>{
 const ranking=createEpochRankingController(page(),{fetch:deferredFetch().fetch});
 expect(ranking.applyLiveSnapshot({benchmarks:[benchmark],runs:[],modelNames:{}})).toBe(false);
 expect(ids(ranking.view().runs)).toEqual(['r0','r1','r2','r3','r4']);
 expect(ranking.view().revision).toBe(R1);
});

test('collapse, re-expand, or a metric switch during an in-flight expansion is not undone when it settles',()=>{
 const counts=new Map<string,number>([['gpqa',20]]);
 // Still waiting on the same request: a failure shrinks to what can be shown.
 expect(visibleCountAfterExpansion({key:'gpqa',desired:20,loaded:false,available:5,visibleCounts:counts})).toBe(5);
 expect(visibleCountAfterExpansion({key:'gpqa',desired:20,loaded:true,available:8,visibleCounts:counts})).toBeUndefined();
 // Collapsed while loading: nothing is restored on failure or success.
 counts.delete('gpqa');
 expect(visibleCountAfterExpansion({key:'gpqa',desired:20,loaded:false,available:5,visibleCounts:counts})).toBeUndefined();
 expect(visibleCountAfterExpansion({key:'gpqa',desired:20,loaded:true,available:8,visibleCounts:counts})).toBeUndefined();
 // Expanded further while loading: the older request does not shrink the newer choice.
 counts.set('gpqa',50);
 expect(visibleCountAfterExpansion({key:'gpqa',desired:20,loaded:false,available:5,visibleCounts:counts})).toBeUndefined();
 // Switching metric expands a different key; settling gpqa's request does not touch it.
 counts.set('livebench',20);
 expect(visibleCountAfterExpansion({key:'gpqa',desired:50,loaded:false,available:5,visibleCounts:counts})).toBe(5);
 expect(counts.get('livebench')).toBe(20);
});
