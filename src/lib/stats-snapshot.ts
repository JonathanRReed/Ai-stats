import type {AaModel,EpochModel,EpochBenchmark,EpochBenchmarkRun,PublicCatalogModels} from './supabase';
import type {DataFreshness} from './data-freshness';
import type {catalogCoverage} from './model-catalog';
import type {PublicPoliBenchSnapshot} from './polibench-snapshot';
import type {UsageSnapshot} from './openrouter-usage';
import {buildUsageSeries} from './openrouter-usage';

export const STATS_SCHEMA='ai-stats-stats.v1';
export const MAX_STATS_BYTES=6*1024*1024;
type Wire<T>=T extends Date?string:T extends Array<infer U>?Wire<U>[]:T extends object?{[K in keyof T]:Wire<T[K]>}:T;
export type StatsSnapshot={
 schemaVersion:typeof STATS_SCHEMA;generatedAt:string;aaModels:AaModel[];
 epochModels:EpochModel[];epochBenchmarks:EpochBenchmark[];epochRuns:EpochBenchmarkRun[];epochFetchedAt:string|null;
 publicCatalogs:Omit<PublicCatalogModels,'huggingFaceModels'|'liteLlmModels'>;
 freshness:Wire<DataFreshness>;coverage:ReturnType<typeof catalogCoverage>;
 polibench:PublicPoliBenchSnapshot|null;
 usage:{snapshot:UsageSnapshot;receipt:{fetchedAt:string;publishedAt:string;status:string}}|null;
};
const plain=(v:unknown):v is Record<string,unknown>=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=2048;
const date=(v:unknown)=>v===null||typeof v==='string'&&Number.isFinite(Date.parse(v));
const number=(v:unknown)=>v===null||typeof v==='number'&&Number.isFinite(v);
const count=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const PRIVATE=/^(raw(?:[_-]?(?:response|body|fetch))?|api[_-]?key|service[_-]?role[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization|password|secret|__proto__|constructor|prototype)$/i;
function stable(value:unknown,depth=0):unknown{
 if(depth>32)throw new Error('Stats nesting exceeds limit');
 if(value===null||typeof value==='boolean')return value;
 if(typeof value==='number'&&Number.isFinite(value))return value;
 if(typeof value==='string'){
  if(/^https?:\/\//i.test(value)){const url=new URL(value);if(url.username||url.password||[...url.searchParams.keys()].some(key=>/^(token|key|api_key|access_token|signature|password)$/i.test(key)))throw new Error('Private URL in Stats');}
  return value;
 }
 if(Array.isArray(value))return value.map(item=>stable(item,depth+1));
 if(plain(value))return Object.fromEntries(Object.keys(value).sort().map(key=>{
  if(PRIVATE.test(key))throw new Error('Private field in Stats');
  return [key,stable(value[key],depth+1)];
 }));
 throw new Error('Stats must contain finite JSON data');
}
export function statsSnapshotText(value:unknown):string{
 const result=JSON.stringify(stable(value));
 if(new TextEncoder().encode(result).byteLength>MAX_STATS_BYTES)throw new Error('Stats asset exceeds size budget');
 return result;
}
const uniqueRows=(value:unknown,key:string,maximum:number):value is Record<string,unknown>[]=>{
 if(!Array.isArray(value)||value.length>maximum)return false;
 const ids=new Set<string>();
 return value.every(row=>{
  if(!plain(row)||!text(row[key])||ids.has(row[key]))return false;
  ids.add(row[key]);return true;
 });
};
const requiredArrays=['openRouterModels','openRouterUsageRankings','openRouterProviders','openRouterEmbeddingModels','openRouterEndpointSummaries'];
const statuses=['healthy','stale','partial','failed','unavailable'];
export function readStatsSnapshot(input:unknown,expected:{aaIds?:string[]}={}):StatsSnapshot{
 const value:unknown=JSON.parse(statsSnapshotText(input));
 if(!plain(value)||value.schemaVersion!==STATS_SCHEMA||!text(value.generatedAt)||!date(value.generatedAt)||
 !uniqueRows(value.aaModels,'id',30000)||!value.aaModels.length)throw new Error('Invalid Stats snapshot');
 for(const row of value.aaModels){
  if(row.current_source_member===false||!text(row.first_seen)||!date(row.first_seen)||!text(row.last_seen)||!date(row.last_seen)||
    !(row.name===null||text(row.name)))throw new Error('Invalid current AA identity');
  for(const [key,metric] of Object.entries(row)){
   if(/^(aa_.*_index|price_1m_.*|median_.*|mmlu_pro|gpqa|hle|aime|livecodebench|scicode|math_500|context_window|max_output_tokens)$/.test(key)&&!number(metric))throw new Error('Invalid AA measurement');
   if(key.startsWith('price_1m_')&&typeof metric==='number'&&metric<0)throw new Error('Invalid AA price');
  }
 }
 if(expected.aaIds){
  const ids=new Set(value.aaModels.map(row=>row.id));
  if(ids.size!==expected.aaIds.length||!expected.aaIds.every(id=>ids.has(id)))throw new Error('Stats current AA catalog mismatch');
 }
 if(!uniqueRows(value.epochModels,'id',30000)||!value.epochModels.every(row=>text(row.model_version))||
 !uniqueRows(value.epochBenchmarks,'slug',2000)||!value.epochBenchmarks.every(row=>text(row.id)&&text(row.name))||
 !uniqueRows(value.epochRuns,'id',50000)||!date(value.epochFetchedAt))throw new Error('Invalid Stats Epoch data');
 const slugs=new Set(value.epochBenchmarks.map(row=>row.slug));
 for(const run of value.epochRuns){
  if(!text(run.model_version)||!slugs.has(run.benchmark_slug)||!number(run.score)||
    !['native','percent','fraction'].includes(String(run.score_unit))||
    !date(run.evaluation_date??null))throw new Error('Invalid Stats Epoch observation');
  if(run.score_unit==='fraction'&&typeof run.score==='number'&&(run.score<0||run.score>1))throw new Error('Invalid fraction score');
  if(run.score_unit==='percent'&&typeof run.score==='number'&&(run.score<0||run.score>100))throw new Error('Invalid percent score');
  if(run.conditions!==undefined&&run.conditions!==null&&(!plain(run.conditions)||!Object.values(run.conditions).every(item=>typeof item==='string'||typeof item==='boolean'||typeof item==='number'&&Number.isFinite(item))))throw new Error('Invalid observation conditions');
 }
 if(!plain(value.publicCatalogs)||!requiredArrays.every(key=>Array.isArray(value.publicCatalogs[key])&&(value.publicCatalogs[key] as unknown[]).length<=30000))throw new Error('Invalid Stats public catalogs');
 const freshness=value.freshness;
 if(!plain(freshness)||![freshness.updatedAt,freshness.aaLastSeen,freshness.epochFetchedAt].every(date)||
 !uniqueRows(freshness.sources,'sourceKey',30)||!freshness.sources.every(source=>text(source.displayName)&&statuses.includes(String(source.status))&&
 [source.lastObservedAt,source.lastSuccessfulRunAt,source.fetchedAt??null,source.publishedAt??null].every(date))||
 !plain(freshness.fallback)||typeof freshness.fallback.fallback!=='boolean'||!['live-view','static-snapshot'].includes(String(freshness.fallback.mode)))throw new Error('Invalid Stats freshness');
 const coverage=value.coverage;
 if(!plain(coverage)||![coverage.records,coverage.historical,coverage.membershipUnverified].every(count)||typeof coverage.complete!=='boolean'||
 !Array.isArray(coverage.unavailableSources)||!coverage.unavailableSources.every(text)||!uniqueRows(coverage.sources,'key',30)||
 !coverage.sources.every(source=>text(source.name)&&typeof source.available==='boolean'&&(source.count===null||count(source.count))))throw new Error('Invalid Stats coverage');
 if(value.polibench!==null){
  const pb=value.polibench;
  if(!plain(pb)||pb.schemaVersion!=='1.0'||!plain(pb.counts)||!count(pb.counts.models)||!count(pb.counts.runs)||
   !uniqueRows(pb.models,'modelSlug',10000)||!uniqueRows(pb.runs,'runId',30000)||pb.models.length!==pb.counts.models||
   !pb.models.every(model=>text(model.label)&&text(model.provider)&&Array.isArray(model.axisScores)&&model.axisScores.every(axis=>plain(axis)&&text(axis.axis)&&typeof axis.score==='number'&&Math.abs(axis.score)<=100&&count(axis.answeredItems))))throw new Error('Invalid Stats PoliBench snapshot');
 }
 if(value.usage!==null){
  const usage=value.usage;
  if(!plain(usage)||!plain(usage.snapshot)||!plain(usage.receipt)||!date(usage.receipt.fetchedAt)||!date(usage.receipt.publishedAt)||
   !Array.isArray(usage.snapshot.rows)||usage.snapshot.rows.length>10000||
   !usage.snapshot.rows.every(row=>plain(row)&&text(row.date)&&text(row.modelPermaslug)&&typeof row.totalTokens==='string'&&/^\d+$/.test(row.totalTokens)))throw new Error('Invalid Stats usage snapshot');
  buildUsageSeries(usage.snapshot as unknown as UsageSnapshot,30,[],'share');
 }
 return value as unknown as StatsSnapshot;
}
