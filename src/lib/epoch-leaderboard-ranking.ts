import {buildBenchmarkCohorts} from './benchmark-leaderboard';
import {buildInitialEpochLeaderboardData} from './epoch-leaderboard-initial';
import type {EpochBenchmark,EpochBenchmarkRun} from './supabase';

/**
 * The full ranking is a build artifact keyed by its own content fingerprint
 * (`epochRankingRevision`, independent of the compare release `datasetRevision`), computed from
 * the same source the page was rendered from. A view only ever adopts rows from its own
 * revision, so a late, cached, or redeployed corpus cannot mix into it.
 */
export const epochRankingUrl=(revision:string)=>`/api/epoch-ranking/${revision}.json`;

type RankedRun=ReturnType<typeof buildInitialEpochLeaderboardData>['runs'][number];
export type EpochRankingPayload={schemaVersion:1;revision:string;runs:RankedRun[];modelNames:Record<string,string>};

export function buildEpochRankingPayload(source:{
 revision:string;
 benchmarks:EpochBenchmark[];
 runs:EpochBenchmarkRun[];
 labels:Record<string,string>;
 modelNames:Record<string,string>;
}):EpochRankingPayload{
 const full=buildInitialEpochLeaderboardData(source.benchmarks,source.runs,source.labels,source.modelNames,Number.POSITIVE_INFINITY);
 return {schemaVersion:1,revision:source.revision,runs:full.runs,modelNames:full.modelNames};
}

const record=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown):value is string=>typeof value==='string'&&value.length>0;

export function parseEpochRankingPayload(value:unknown,revision:string):EpochRankingPayload{
 if(!record(value)||value.schemaVersion!==1||!Array.isArray(value.runs)||!record(value.modelNames))throw new Error('Invalid Epoch ranking payload');
 if(value.revision!==revision)throw new Error('Epoch ranking revision does not match this page');
 const ids=new Set<string>();
 for(const run of value.runs){
  if(!record(run)||!text(run.id)||ids.has(run.id)||!text(run.model_version)||!text(run.benchmark_slug))throw new Error('Invalid Epoch ranking run');
  ids.add(run.id);
 }
 return value as EpochRankingPayload;
}

export type EpochRankingView={
 revision:string;
 benchmarks:EpochBenchmark[];
 runs:EpochBenchmarkRun[];
 modelNames:Record<string,string>;
 totals:Record<string,number>;
 complete:boolean;
};
export type EpochRankingStatus='idle'|'loading'|'failed';
/**
 * A live refresh as produced by `fetchLiveSnapshot`: Epoch-only (no publisher rows) and possibly
 * truncated by the per-table row cap. Only a snapshot that declares itself the complete Epoch
 * corpus may replace Epoch rows; anything else leaves the build corpus in place.
 */
export type EpochLiveSnapshot={
 source:'epoch';
 complete:boolean;
 fetchedAt:string|null;
 benchmarks:EpochBenchmark[];
 runs:EpochBenchmarkRun[];
 modelNames:Record<string,string>;
};
/** Maps a `fetchLiveSnapshot` result to the controller contract without assuming completeness. */
export function epochLiveSnapshotFrom(snapshot:{
 epochSource?:string;epochComplete?:boolean;epochFetchedAt?:string|null;
 epochBenchmarks?:EpochBenchmark[];epochRuns?:EpochBenchmarkRun[];
 epochModels?:Array<{model_version:string;display_name?:string|null;model_name?:string|null}>;
}):EpochLiveSnapshot|null{
 if(snapshot.epochSource!=='epoch')return null;
 return {
  source:'epoch',
  complete:snapshot.epochComplete===true,
  fetchedAt:snapshot.epochFetchedAt??null,
  benchmarks:snapshot.epochBenchmarks??[],
  runs:snapshot.epochRuns??[],
  modelNames:Object.fromEntries((snapshot.epochModels??[]).flatMap(model=>{
   const name=model.display_name?.trim()||model.model_name?.trim();
   return name?[[model.model_version,name] as const]:[];
  })),
 };
}
type FetchLike=(input:string,init?:RequestInit)=>Promise<Response>;
type Initial=Omit<EpochRankingView,'complete'|'totals'>&{totals?:Record<string,number>;fetchedAt?:string|null};

/** Publisher evidence carries a source key; everything else in the ranking is Epoch-scoped. */
const publisherRun=(run:Pick<EpochBenchmarkRun,'source_key'>)=>Boolean(run.source_key);
const publisherBenchmark=(benchmark:EpochBenchmark)=>Boolean(benchmark.metadata?.source_key);
const time=(value:string|null|undefined)=>typeof value==='string'?Date.parse(value):Number.NaN;

export function createEpochRankingController(initial:Initial,options:{fetch?:FetchLike}={}){
 const fetchImpl=options.fetch??((input,init)=>fetch(input,init));
 const revision=initial.revision;
 // The build corpus for this page revision: top rows until the full ranking loads.
 let base={benchmarks:initial.benchmarks,runs:initial.runs,modelNames:initial.modelNames,totals:{...(initial.totals??{})},complete:false};
 // The latest complete, authoritative Epoch replacement, if any. It owns every Epoch-scoped row.
 let epoch:{benchmarks:EpochBenchmark[];runs:EpochBenchmarkRun[];modelNames:Record<string,string>}|null=null;
 let view:EpochRankingView;
 let status:EpochRankingStatus='idle';
 let pending:Promise<EpochRankingPayload>|null=null;

 const compose=()=>{
  if(!epoch){view={revision,...base};return;}
  const live=new Map(epoch.benchmarks.map(benchmark=>[benchmark.slug,benchmark]));
  const benchmarks=base.benchmarks.flatMap(benchmark=>{
   if(publisherBenchmark(benchmark))return [benchmark];
   const next=live.get(benchmark.slug);live.delete(benchmark.slug);
   return next?[{...benchmark,...next,metadata:next.metadata??benchmark.metadata}]:[];
  }).concat([...live.values()]);
  const epochBenchmarks=benchmarks.filter(benchmark=>!publisherBenchmark(benchmark));
  // Publisher rows and totals are not part of an Epoch refresh, so they stay from the build.
  const publisherKeys=new Set(base.benchmarks.filter(publisherBenchmark).flatMap(benchmark=>buildBenchmarkCohorts(benchmark,base.runs).map(cohort=>cohort.key)));
  const totals=Object.fromEntries(Object.entries(base.totals).filter(([key])=>publisherKeys.has(key)));
  for(const benchmark of epochBenchmarks)for(const cohort of buildBenchmarkCohorts(benchmark,epoch.runs))totals[cohort.key]=cohort.runs.length;
  view={revision,benchmarks,runs:[...base.runs.filter(publisherRun),...epoch.runs],modelNames:{...base.modelNames,...epoch.modelNames},totals,complete:base.complete};
 };
 compose();
 let newest=time(initial.fetchedAt);

 const load=(signal?:AbortSignal)=>{
  if(pending)return pending;
  const promise=(async()=>{
   const response=await fetchImpl(epochRankingUrl(revision),{cache:'force-cache',signal});
   if(!response.ok)throw new Error(`Epoch ranking failed with ${response.status}`);
   return parseEpochRankingPayload(await response.json(),revision);
  })();
  pending=promise;
  void promise.catch(()=>undefined).finally(()=>{if(pending===promise)pending=null;});
  return promise;
 };

 return {
  view:()=>view,
  status:()=>status,
  /**
   * Resolves true once the view holds the full build ranking. Never blanks rows on failure.
   * Epoch rows from an applied live replacement stay authoritative, so a late build response
   * only fills in publisher rows and cannot resurrect withdrawn Epoch rows.
   */
  async ensureComplete(signal?:AbortSignal):Promise<boolean>{
   if(base.complete)return true;
   status='loading';
   try{
    const payload=await load(signal);
    if(!base.complete){
     base={...base,runs:payload.runs as EpochBenchmarkRun[],modelNames:{...base.modelNames,...payload.modelNames},complete:true};
     compose();
    }
   }catch(error){
    if(!base.complete){
     status='failed';
     console.warn('Failed to load Epoch leaderboard ranking',error);
    }
   }
   if(base.complete)status='idle';
   return base.complete;
  },
  /**
   * Applies only a complete Epoch corpus that is not older than what the view holds. It replaces
   * Epoch-scoped rows (withdrawals stick, totals are recounted) and keeps publisher rows. A
   * truncated or partial refresh is refused, so the build corpus and full expansion remain.
   */
  applyLiveSnapshot(snapshot:EpochLiveSnapshot):boolean{
   if(snapshot.source!=='epoch'||snapshot.complete!==true||!snapshot.runs.length)return false;
   const fetchedAt=time(snapshot.fetchedAt);
   if(!Number.isFinite(fetchedAt)||fetchedAt<newest)return false;
   newest=fetchedAt;
   epoch={benchmarks:snapshot.benchmarks,runs:snapshot.runs.filter(run=>!publisherRun(run)),modelNames:snapshot.modelNames};
   compose();
   return true;
  },
 };
}

/** After an expansion settles, shrink a failed request only if the user still wants that exact count. */
export function visibleCountAfterExpansion(input:{
 key:string;
 desired:number;
 loaded:boolean;
 available:number;
 visibleCounts:Map<string,number>;
}):number|undefined{
 if(input.loaded||input.visibleCounts.get(input.key)!==input.desired)return undefined;
 return Math.min(input.desired,Math.max(5,input.available));
}
