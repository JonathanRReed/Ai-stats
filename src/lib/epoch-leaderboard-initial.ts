import {buildBenchmarkCohorts} from './benchmark-leaderboard';
import type {EpochBenchmark,EpochBenchmarkRun} from './supabase';

export const INITIAL_EPOCH_LEADERBOARD_LIMIT=5;
/** Hard ceiling on serialized initial Epoch leaderboard JSON so full corpora cannot quietly return. */
export const INITIAL_EPOCH_LEADERBOARD_BUDGET_BYTES=400_000;

type InitialBenchmark=Pick<EpochBenchmark,'id'|'slug'|'name'>&{
 metadata:Pick<NonNullable<EpochBenchmark['metadata']>,'source_key'|'benchmark'|'superseded_by'>;
};

type InitialRun=Pick<EpochBenchmarkRun,
 |'id'
 |'model_version'
 |'organization'
 |'source_key'
 |'higher_is_better'
 |'benchmark_version'
 |'conditions'
 |'score_unit'
 |'score'
 |'score_metric'
 |'source_name'
 |'source_link'
 |'benchmark_slug'
>;

function compactBenchmark(benchmark:EpochBenchmark):InitialBenchmark{
 return {
  id:benchmark.id,
  slug:benchmark.slug,
  name:benchmark.name,
  metadata:{
   source_key:benchmark.metadata?.source_key??null,
   benchmark:benchmark.metadata?.benchmark??null,
   superseded_by:benchmark.metadata?.superseded_by??null,
  },
 };
}

function compactRun(run:EpochBenchmarkRun):InitialRun{
 return {
  id:run.id,
  model_version:run.model_version,
  organization:run.organization,
  source_key:run.source_key,
  higher_is_better:run.higher_is_better,
  benchmark_version:run.benchmark_version,
  conditions:run.conditions,
  score_unit:run.score_unit,
  score:run.score,
  score_metric:run.score_metric,
  source_name:run.source_name,
  source_link:run.source_link,
  benchmark_slug:run.benchmark_slug,
 };
}

/** Minimal top-five rows per cohort for initial delivery; full ranking loads on demand. */
export function buildInitialEpochLeaderboardData(
 benchmarks:EpochBenchmark[],
 runs:EpochBenchmarkRun[],
 labels:Record<string,string>,
 modelNames:Record<string,string>,
 initialLimit=INITIAL_EPOCH_LEADERBOARD_LIMIT,
){
 const compactBenchmarks=benchmarks.map(compactBenchmark);
 const selected=new Map<string,InitialRun>();
 const totals:Record<string,number>={};
 for(const benchmark of benchmarks){
  for(const cohort of buildBenchmarkCohorts(benchmark,runs)){
   totals[cohort.key]=cohort.runs.length;
   for(const run of cohort.runs.slice(0,initialLimit)){
    selected.set(run.id,compactRun(run));
   }
  }
 }
 const neededNames=Object.fromEntries(
  Object.entries(modelNames).filter(([version])=>[...selected.values()].some(run=>run.model_version===version)),
 );
 return {
  benchmarks:compactBenchmarks,
  runs:[...selected.values()],
  labels,
  modelNames:neededNames,
  totals,
 };
}

export function assertInitialEpochLeaderboardBudget(payload:{runs:unknown[]},budgetBytes=INITIAL_EPOCH_LEADERBOARD_BUDGET_BYTES):number{
 const bytes=new TextEncoder().encode(JSON.stringify(payload)).length;
 if(bytes>budgetBytes){
  throw new Error(`Initial Epoch leaderboard payload is ${bytes} bytes; budget is ${budgetBytes}`);
 }
 return bytes;
}
