/// <reference types="bun" />
import {afterEach,expect,mock,test} from 'bun:test';
import {buildInitialEpochLeaderboardData} from './epoch-leaderboard-initial';
import {buildEpochRankingPayload,createEpochRankingController,epochLiveSnapshotFrom} from './epoch-leaderboard-ranking';
import {fetchLiveSnapshot} from './live-data';
import type {EpochBenchmark,EpochBenchmarkRun} from './supabase';

// Fixtures follow the producers: Epoch rows look like `fetchLiveSnapshot` output (no source_key),
// publisher rows look like `adaptPublisherEvidence` output (source_key + metadata.source_key).
const R1='a'.repeat(64);
const BUILD_FETCHED_AT='2026-10-01T00:00:00.000Z';
const gpqa:EpochBenchmark={id:'gpqa',slug:'gpqa',name:'GPQA',description:null,source:null};
const livebench:EpochBenchmark={id:'publisher_livebench_v1',slug:'publisher_livebench_v1',name:'LiveBench v1',description:null,source:'LiveBench',
 metadata:{source_key:'livebench',source_url:'https://livebench.ai',version:'v1',collection_method:'automatic'}};
const epochRun=(id:string,score:number):EpochBenchmarkRun=>({id,model_version:'m:'+id,benchmark_id:'gpqa',benchmark_slug:'gpqa',benchmark_name:'GPQA',
 score,score_metric:'accuracy',source_name:'Epoch AI',source_link:null,release_date:null,organization:'Org',country:null,stderr:null});
const publisherRun=(id:string,score:number):EpochBenchmarkRun=>({id,model_version:id,benchmark_id:livebench.slug,benchmark_slug:livebench.slug,benchmark_name:'LiveBench v1',
 benchmark_version:'v1',score,score_metric:'global_average',score_unit:'percent',conditions:null,evaluation_date:null,release_date:null,organization:'Lab',country:null,stderr:null,
 source_name:'LiveBench',source_link:'https://livebench.ai',source_key:'livebench',source_fetched_at:BUILD_FETCHED_AT,higher_is_better:true});
const buildEpoch=Array.from({length:8},(_,index)=>epochRun('e'+index,90-index));
const buildPublisher=Array.from({length:7},(_,index)=>publisherRun('p'+index,80-index));
const labels={gpqa:'GPQA',publisher_livebench_v1:'LiveBench v1'};
const buildSource={revision:R1,benchmarks:[gpqa,livebench],runs:[...buildEpoch,...buildPublisher],labels,modelNames:{}};
const initial=buildInitialEpochLeaderboardData(buildSource.benchmarks,buildSource.runs,labels,{});
const EPOCH_KEY='epoch_gpqa',PUBLISHER_KEY='epoch_publisher_livebench_v1';

const ids=(rows:EpochBenchmarkRun[],publisher:boolean)=>rows.filter(row=>Boolean(row.source_key)===publisher).map(row=>row.id).sort();
const page=()=>({revision:R1,benchmarks:initial.benchmarks as unknown as EpochBenchmark[],runs:initial.runs as EpochBenchmarkRun[],modelNames:initial.modelNames,totals:initial.totals,fetchedAt:BUILD_FETCHED_AT});
function buildFetch(){
 const calls:string[]=[];
 return {calls,fetch:async(url:string)=>{calls.push(url);return Response.json(buildEpochRankingPayload(buildSource));}};
}

const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;});
const rawEpochRun=(row:EpochBenchmarkRun)=>({id:row.id,model_version:row.model_version,benchmark_id:row.benchmark_id,score:row.score,score_metric:row.score_metric,source_name:row.source_name});
/** The published Epoch file wins over an older DB receipt, so the producer returns the whole Epoch corpus. */
function servePublishedEpoch(rows:EpochBenchmarkRun[],fetchedAt='2026-10-14T12:00:00.000Z'){
 globalThis.fetch=mock(async(input:RequestInfo|URL)=>{
  const raw=String(input);
  if(raw.startsWith('/'))return Response.json({fetched_at:fetchedAt,models:rows.map(row=>({model_version:row.model_version,display_name:'Live '+row.id})),benchmarks:[{id:'gpqa',slug:'gpqa',name:'GPQA'}],runs:rows.map(rawEpochRun)});
  if(raw.includes('/epoch_data_files'))return Response.json([{fetched_at:'2026-08-01T00:00:00.000Z'}]);
  if(raw.includes('/aa_models'))return Response.json([]);
  throw new Error('Unexpected request '+raw);
 }) as unknown as typeof fetch;
}
/** No published file and a DB that has more rows than the 250-row cap: the producer truncates. */
function serveCappedDatabase(){
 globalThis.fetch=mock(async(input:RequestInfo|URL)=>{
  const raw=String(input);
  if(raw.startsWith('/'))return new Response(null,{status:404});
  const url=new URL(raw);
  if(url.pathname.endsWith('/epoch_data_files'))return Response.json([{fetched_at:'2026-10-14T12:00:00.000Z'}]);
  if(url.pathname.endsWith('/aa_models'))return Response.json([]);
  if(url.pathname.endsWith('/epoch_benchmarks'))return Response.json([{id:'gpqa',slug:'gpqa',name:'GPQA'}]);
  if(url.pathname.endsWith('/epoch_models'))return Response.json([]);
  // Highest scores first, as ordered by the producer; e0 is rescored, the rest is a capped slice.
  return Response.json(Array.from({length:1_000},(_,index)=>rawEpochRun(epochRun(index?'db'+index:'e0',index?50-index/100:99))));
 }) as unknown as typeof fetch;
}
const live=async()=>{
 const snapshot=await fetchLiveSnapshot({supabaseUrl:'https://public-project.supabase.co',supabaseAnonKey:'public-anon-key'});
 expect(snapshot).not.toBeNull();
 return epochLiveSnapshotFrom(snapshot!)!;
};

test('the producer declares a published Epoch file complete and a row-capped database read incomplete',async()=>{
 servePublishedEpoch(buildEpoch);
 const published=await live();
 expect(published).toMatchObject({source:'epoch',complete:true,fetchedAt:'2026-10-14T12:00:00.000Z'});
 expect(published.runs.every(row=>!row.source_key)).toBe(true);
 serveCappedDatabase();
 const capped=await live();
 expect(capped.runs).toHaveLength(250);
 expect(capped.complete).toBe(false);
});

test('an Epoch-only complete refresh keeps publisher rows, makes Epoch withdrawals stick, and recounts totals',async()=>{
 // Live Epoch corpus: e0 rescored, e1 and e2 withdrawn by Epoch.
 servePublishedEpoch([epochRun('e0',99),...buildEpoch.slice(3)]);
 const network=buildFetch();
 const ranking=createEpochRankingController(page(),{fetch:network.fetch});
 expect(ranking.view().totals).toEqual({[EPOCH_KEY]:8,[PUBLISHER_KEY]:7});
 expect(ranking.applyLiveSnapshot(await live())).toBe(true);
 let view=ranking.view();
 expect(ids(view.runs,false)).toEqual(['e0','e3','e4','e5','e6','e7']);
 expect(view.runs.find(row=>row.id==='e0')?.score).toBe(99);
 expect(view.modelNames['m:e0']).toBe('Live e0');
 // Publisher rows from the build are not part of an Epoch refresh and survive it.
 expect(ids(view.runs,true)).toEqual(['p0','p1','p2','p3','p4']);
 expect(view.benchmarks.map(benchmark=>benchmark.slug)).toEqual(['gpqa','publisher_livebench_v1']);
 expect(view.totals).toEqual({[EPOCH_KEY]:6,[PUBLISHER_KEY]:7});
 // Publisher cohorts still need the build ranking: the refresh did not mark the view complete.
 expect(view.complete).toBe(false);
 expect(await ranking.ensureComplete()).toBe(true);
 expect(network.calls).toEqual([`/api/epoch-ranking/${R1}.json`]);
 view=ranking.view();
 expect(ids(view.runs,true)).toEqual(['p0','p1','p2','p3','p4','p5','p6']);
 // The full build ranking does not resurrect withdrawn Epoch rows or the old e0 score.
 expect(ids(view.runs,false)).toEqual(['e0','e3','e4','e5','e6','e7']);
 expect(view.runs.find(row=>row.id==='e0')?.score).toBe(99);
 expect(view.totals).toEqual({[EPOCH_KEY]:6,[PUBLISHER_KEY]:7});
});

test('a truncated database refresh is refused: the build corpus stays and full expansion still loads',async()=>{
 serveCappedDatabase();
 const network=buildFetch();
 const ranking=createEpochRankingController(page(),{fetch:network.fetch});
 const before=ranking.view();
 expect(ranking.applyLiveSnapshot(await live())).toBe(false);
 expect(ranking.view()).toBe(before);
 expect(ranking.view().complete).toBe(false);
 expect(ranking.view().totals).toEqual({[EPOCH_KEY]:8,[PUBLISHER_KEY]:7});
 expect(await ranking.ensureComplete()).toBe(true);
 expect(network.calls).toHaveLength(1);
 expect(ids(ranking.view().runs,false)).toEqual(buildEpoch.map(row=>row.id).sort());
 expect(ids(ranking.view().runs,true)).toEqual(buildPublisher.map(row=>row.id).sort());
});

test('a complete Epoch refresh older than the build corpus, or without a timestamp or source, is refused',async()=>{
 const ranking=createEpochRankingController(page(),{fetch:buildFetch().fetch});
 servePublishedEpoch(buildEpoch.slice(1),'2026-09-01T00:00:00.000Z');
 expect(ranking.applyLiveSnapshot(await live())).toBe(false);
 servePublishedEpoch(buildEpoch.slice(1));
 const current=await live();
 expect(ranking.applyLiveSnapshot({...current,fetchedAt:null})).toBe(false);
 expect(epochLiveSnapshotFrom({epochRuns:current.runs,epochComplete:true})).toBeNull();
 expect(ids(ranking.view().runs,false)).toEqual(['e0','e1','e2','e3','e4']);
 // A newer complete refresh applies, and a later, older one cannot roll it back.
 expect(ranking.applyLiveSnapshot(current)).toBe(true);
 servePublishedEpoch(buildEpoch,'2026-10-02T00:00:00.000Z');
 expect(ranking.applyLiveSnapshot(await live())).toBe(false);
 expect(ids(ranking.view().runs,false)).toEqual(['e1','e2','e3','e4','e5','e6','e7']);
});
