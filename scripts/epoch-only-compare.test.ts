import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {buildCompareEvidence,buildEpochScoreIndex,fromEpochRuns} from '../src/lib/compare-evidence';
test('Epoch-only compatibility response retains native benchmark evidence without AA bindings',async()=>{
 const source=readFileSync('src/pages/api/compare-initial.json.ts','utf8').replace(/import[\s\S]*?from ['"][^'"]+['"];?/g,'').replace('export const GET','const GET');
 const get=runInNewContext(new Bun.Transpiler({loader:'ts'}).transformSync(source)+';GET;',{
 Response,buildCompareEvidence,buildEpochScoreIndex,fromEpochRuns,
 getModels:async()=>[],getPublicCatalogModels:async()=>({}),getVerifiedCatalogBindings:async()=>({}),enrichModelsWithPublicCatalogData:(m:unknown[])=>m,
 getEpochEvidence:async()=>({fetchedAt:'2026-10-02',epochBenchmarks:[{id:'b',slug:'bench',name:'Benchmark'}],
 epochModels:[{id:'v',model_version:'native-v',display_name:'Native model',organization:'Lab'}],
 epochRuns:[{id:'run',model_version:'native-v',benchmark_id:'b',benchmark_slug:'bench',score:0.5,score_metric:'Score',score_unit:'native',conditions:null}]}),
 getEpochBenchmarksWithRuns:(rows:unknown[])=>rows,getEpochBenchmarkLabel:()=> 'Benchmark',
 VALUABLE_FREE_BENCHMARK_SLUGS:[],selectBenchmarkSnapshotModels:()=>[],hasFiniteMetricValue:Number.isFinite,compareOptionalMetricValues:()=>0
 });
 const body=await (await get()).json();
 expect(body.epochDemoModels).toHaveLength(1);
 expect(body.epochScoresByModel['native v']?.bench).toBe(0.5);
 expect(body.epochDemoModels[0].priceEvidence).toBe('unavailable');
});
