import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {
 createEpochLeaderboardRankingLoader,
 mergeEpochLeaderboardRuns,
 parseEpochSnapshotPayload,
 rankingCorpusRevision,
} from './epoch-leaderboard-ranking';
import type {EpochBenchmarkRun} from './supabase';

const run=(id:string,version:string):EpochBenchmarkRun=>({
 id,model_version:version,benchmark_id:'b',benchmark_slug:'b',score:1,score_metric:'accuracy',
 score_unit:'percent',benchmark_version:'1',higher_is_better:true,conditions:null,organization:'Org',
 source_key:undefined,source_name:'Epoch',source_link:null,release_date:null,country:null,stderr:null,evaluation_date:null,
});

test('ranking loader deduplicates concurrent fetches and preserves revision consistency',async()=>{
 let calls=0;
 const epochSnapshot=JSON.parse(readFileSync('public/data/epoch-benchmark-snapshot.json','utf8'));
 const livebench=JSON.parse(readFileSync('public/data/publisher-benchmarks/livebench.json','utf8'));
 const fetchImpl=async(input:RequestInfo|URL)=>{
  calls+=1;
  const url=String(input);
  if(url.includes('epoch-benchmark-snapshot'))return Response.json(epochSnapshot);
  if(url.includes('livebench'))return Response.json(livebench);
  // Minimal valid publisher snapshots for other keys
  const sourceKey=url.split('/').at(-1)!.replace(/\.json$/,'');
  return Response.json({
   schemaVersion:1,sourceKey,fetchedAt:'2026-10-14T00:00:00.000Z',observedAt:null,
   benchmarkVersion:'1.0.0',sourceUrl:'https://example.com/',records:[{
    systemId:`${sourceKey}:row`,modelId:'model',label:'Label',benchmarkSlug:sourceKey,benchmarkVersion:'1.0.0',
    metric:'score',unit:'points',score:1,higherIsBetter:true,conditions:{},evaluatedAt:null,sourceUrl:'https://example.com/',
   }],
  });
 };
 const loader=createEpochLeaderboardRankingLoader({fetch:fetchImpl,publisherKeys:['livebench']});
 const [first,second]=await Promise.all([loader.loadFull(),loader.loadFull()]);
 expect(first.revision).toBe(second.revision);
 expect(first.runs.length).toBeGreaterThan(0);
 expect(first.benchmarks.some(benchmark=>benchmark.metadata?.source_key==='livebench')).toBe(true);
 expect(calls).toBeLessThanOrEqual(2); // one epoch + one publisher thanks to in-flight dedupe
 const again=await loader.loadFull();
 expect(again).toBe(first);
 expect(calls).toBeLessThanOrEqual(2);
});

test('failed ranking fetch leaves the current top-five choice intact',()=>{
 const current=[run('a','a'),run('b','b'),run('c','c'),run('d','d'),run('e','e')];
 expect(mergeEpochLeaderboardRuns(current,[])).toEqual(current);
 expect(mergeEpochLeaderboardRuns(current,[run('f','f')]).map(row=>row.id)).toEqual(['a','b','c','d','e','f']);
});

test('epoch snapshot parsing keeps readable model names without requiring the full measurement join',()=>{
 const parsed=parseEpochSnapshotPayload({
  fetched_at:'2026-10-14T12:00:00.000Z',
  benchmarks:[{slug:'gpqa_diamond',name:'GPQA Diamond'}],
  models:[{model_version:'model:0',display_name:'Gemini 4 Argon (high)'}],
  runs:[{id:'run:0',model_version:'model:0',benchmark_slug:'gpqa_diamond',score:90,score_metric:'accuracy',score_unit:'percent'}],
 });
 expect(parsed.modelNames['model:0']).toBe('Gemini 4 Argon (high)');
 expect(parsed.runs[0]).toMatchObject({model_version:'model:0',benchmark_slug:'gpqa_diamond',score:90});
 expect(rankingCorpusRevision([parsed.fetchedAt,'2026-10-14T13:00:00.000Z'])).toContain('2026-10-14T12:00:00.000Z');
});
