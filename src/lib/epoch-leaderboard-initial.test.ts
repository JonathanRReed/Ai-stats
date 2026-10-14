import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {
 assertInitialEpochLeaderboardBudget,
 buildInitialEpochLeaderboardData,
 INITIAL_EPOCH_LEADERBOARD_BUDGET_BYTES,
 INITIAL_EPOCH_LEADERBOARD_LIMIT,
} from './epoch-leaderboard-initial';
import {resolveEpochLeaderboardRunNames} from './epoch-model-display-name';
import type {EpochBenchmark,EpochBenchmarkRun} from './supabase';

const benchmark=(slug:string,sourceKey:string|null='publisher-key'):EpochBenchmark=>({
 id:`benchmark:${slug}`,slug,name:`Name for ${slug}`,description:null,source:null,
 metadata:sourceKey?{source_key:sourceKey,benchmark:'publisher-benchmark',superseded_by:'new-name',unused:'discard me'}:{benchmark:'epoch-benchmark'},
});
const run=(id:string,model:string,score:number,slug='gpqa_diamond',sourceKey:string|undefined='publisher-key'):EpochBenchmarkRun=>({
 id,model_version:model,benchmark_id:`benchmark:${slug}`,benchmark_slug:slug,
 score,score_metric:'accuracy',score_unit:'percent',benchmark_version:'2026',
 higher_is_better:true,conditions:{shots:1},organization:'Provider',source_key:sourceKey,
 source_name:'Publisher',source_link:'https://publisher.example/results',release_date:null,
 country:null,stderr:null,evaluation_date:null,
});

test('serialized Epoch picker inputs retain only the initial top rows and required source fields',()=>{
 const payload=buildInitialEpochLeaderboardData(
  [benchmark('gpqa_diamond')],
  Array.from({length:30},(_,index)=>run(`run:${index}`,`model:${index}`,90-index)),
  {gpqa_diamond:'GPQA Diamond'},
  {'model:0':'Gemini 4 Argon (high)','model:1':'Claude Sonnet 5.5 (max)','model:29':'Tail'},
 );
 const serialized=JSON.stringify(payload);
 const decoded=JSON.parse(serialized);
 expect(decoded.runs).toHaveLength(INITIAL_EPOCH_LEADERBOARD_LIMIT);
 expect(decoded.totals['epoch_gpqa_diamond']).toBe(30);
 expect(decoded.runs.map((row:{model_version:string})=>row.model_version)).toEqual([
  'model:0','model:1','model:2','model:3','model:4',
 ]);
 expect(decoded.benchmarks[0].metadata).toEqual({source_key:'publisher-key',benchmark:'publisher-benchmark',superseded_by:'new-name'});
 expect(decoded.labels.gpqa_diamond).toBe('GPQA Diamond');
 expect(decoded.modelNames).toEqual({'model:0':'Gemini 4 Argon (high)','model:1':'Claude Sonnet 5.5 (max)'});
 expect(assertInitialEpochLeaderboardBudget(payload)).toBeLessThan(INITIAL_EPOCH_LEADERBOARD_BUDGET_BYTES);

 const dashboard=readFileSync('src/components/Dashboard.astro','utf8');
 expect(dashboard).toContain('const initialEpochLeaderboard = buildInitialEpochLeaderboardData(');
 expect(dashboard).toContain('assertInitialEpochLeaderboardBudget(initialEpochLeaderboard)');
 expect(dashboard).toContain('epochBenchmarksWithRuns,\n  epochRuns,\n  epochBenchmarkNames,');
 expect(dashboard).toMatch(/<script is:inline define:vars=\{\{[^}]*initialEpochLeaderboard[^}]*\}\}>/);
 expect(dashboard).toContain('window.__epochInitialBenchmarks = initialEpochLeaderboard.benchmarks');
 expect(dashboard).toContain('window.__epochInitialRuns = initialEpochLeaderboard.runs');
 expect(dashboard).toContain('window.__epochModelNames = initialEpochLeaderboard.modelNames');
 expect(dashboard).toContain('window.__epochLeaderboardTotals = initialEpochLeaderboard.totals');
 expect(dashboard).toContain('leaderboardRunCatalogRecord');
 expect(dashboard).toContain('createEpochRankingController({\n      revision: window.__epochRankingRevision,');
 expect(dashboard).toContain('window.__epochRankingRevision = epochRankingRevision');
 expect(dashboard).toContain('resolveEpochLeaderboardRunNames(cohort.runs, benchmarkModelNameRecord)');
 expect(dashboard).toContain('resolveEpochLeaderboardRunNames(cohort.runs, epochModelNames)');
 expect(dashboard).toContain('name: run.name,');
 expect(dashboard).toContain('Object.fromEntries((snapshot.epochModels ?? []).flatMap');
 expect(dashboard).toContain('window.__epochBenchmarkLabels = initialEpochLeaderboard.labels');
});

test('initial-delivery budget rejects silently inlining a full corpus',()=>{
 const benchmarks=[benchmark('gpqa_diamond'),benchmark('livebench','livebench')];
 const runs=[
  ...Array.from({length:2500},(_,index)=>run(`gpqa:${index}`,`gpqa-model:${index}`,2500-index,'gpqa_diamond')),
  ...Array.from({length:2500},(_,index)=>run(`lb:${index}`,`lb-model:${index}`,2500-index,'livebench','livebench')),
 ];
 const payload=buildInitialEpochLeaderboardData(
  benchmarks,
  runs,
  {gpqa_diamond:'GPQA Diamond',livebench:'LiveBench'},
  Object.fromEntries(runs.map(row=>[row.model_version,row.model_version])),
 );
 expect(payload.runs.length).toBeLessThanOrEqual(benchmarks.length*INITIAL_EPOCH_LEADERBOARD_LIMIT*2);
 expect(payload.runs.length).toBeLessThan(runs.length/10);
 const bytes=assertInitialEpochLeaderboardBudget(payload);
 const fullPayload={
  ...payload,
  runs:runs.map(row=>({
   id:row.id,model_version:row.model_version,organization:row.organization,source_key:row.source_key,
   higher_is_better:row.higher_is_better,benchmark_version:row.benchmark_version,conditions:row.conditions,
   score_unit:row.score_unit,score:row.score,score_metric:row.score_metric,source_name:row.source_name,
   source_link:row.source_link,benchmark_slug:row.benchmark_slug,
  })),
 };
 const fullBytes=new TextEncoder().encode(JSON.stringify(fullPayload)).length;
 expect(bytes).toBeLessThan(fullBytes/5);
 expect(bytes).toBeLessThan(INITIAL_EPOCH_LEADERBOARD_BUDGET_BYTES);
 expect(INITIAL_EPOCH_LEADERBOARD_BUDGET_BYTES).toBe(400_000);
 expect(()=>assertInitialEpochLeaderboardBudget(payload,bytes-1)).toThrow(/budget is \d+ bytes/);
 // Prove an oversized *generated* payload (same shape as production) fails the real 400_000-byte gate.
 expect(fullBytes).toBeGreaterThan(INITIAL_EPOCH_LEADERBOARD_BUDGET_BYTES);
 expect(()=>assertInitialEpochLeaderboardBudget(fullPayload)).toThrow(
  new RegExp(`Initial Epoch leaderboard payload is ${fullBytes} bytes; budget is ${INITIAL_EPOCH_LEADERBOARD_BUDGET_BYTES} bytes`),
 );
});

test('Epoch names stay identical before expansion, after expansion, and after collapse',()=>{
 const runs=Array.from({length:7},(_,index)=>run(`run:${index}`,`model:${index}`,90-index));
 const names={'model:0':'Gemini 4 Argon (high)','model:1':'Claude Sonnet 5.5 (max)'};
 const initial=resolveEpochLeaderboardRunNames(runs.slice(0,5),names);
 const expanded=resolveEpochLeaderboardRunNames(runs,names);
 const collapsed=resolveEpochLeaderboardRunNames(runs.slice(0,5),names);
 expect(expanded.slice(0,5).map(row=>row.name)).toEqual(initial.map(row=>row.name));
 expect(collapsed.map(row=>row.name)).toEqual(initial.map(row=>row.name));
 expect(expanded[0]).toMatchObject({model_version:'model:0',name:'Gemini 4 Argon (high)'});
 expect(expanded[1]).toMatchObject({model_version:'model:1',name:'Claude Sonnet 5.5 (max)'});
 expect(expanded[2]).toMatchObject({model_version:'model:2',name:'model:2'});
});
