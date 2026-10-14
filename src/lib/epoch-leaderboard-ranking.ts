import {buildInitialEpochLeaderboardData} from './epoch-leaderboard-initial';
import type {EpochBenchmark,EpochBenchmarkRun} from './supabase';

/**
 * The full ranking is a build artifact keyed by the compare release `datasetRevision`, the
 * fingerprint of the same catalog the page was rendered from. A view only ever adopts rows
 * from its own revision, so a late, cached, or redeployed corpus cannot mix into it.
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
 complete:boolean;
};
export type EpochRankingStatus='idle'|'loading'|'failed';
type FetchLike=(input:string,init?:RequestInit)=>Promise<Response>;

export function createEpochRankingController(initial:Omit<EpochRankingView,'complete'>,options:{fetch?:FetchLike}={}){
 const fetchImpl=options.fetch??((input,init)=>fetch(input,init));
 let view:EpochRankingView={...initial,complete:false};
 let status:EpochRankingStatus='idle';
 let pending:{revision:string;promise:Promise<EpochRankingPayload>}|null=null;
 let liveSnapshots=0;

 const load=(revision:string,signal?:AbortSignal)=>{
  if(pending?.revision===revision)return pending.promise;
  const promise=(async()=>{
   const response=await fetchImpl(epochRankingUrl(revision),{cache:'force-cache',signal});
   if(!response.ok)throw new Error(`Epoch ranking failed with ${response.status}`);
   return parseEpochRankingPayload(await response.json(),revision);
  })();
  const entry={revision,promise};
  pending=entry;
  void promise.catch(()=>undefined).finally(()=>{if(pending===entry)pending=null;});
  return promise;
 };

 return {
  view:()=>view,
  status:()=>status,
  /** Resolves true once the current view holds its full ranking. Never blanks rows on failure. */
  async ensureComplete(signal?:AbortSignal):Promise<boolean>{
   if(view.complete)return true;
   const revision=view.revision;
   status='loading';
   try{
    const payload=await load(revision,signal);
    if(view.revision===revision&&!view.complete){
     view={...view,runs:payload.runs as EpochBenchmarkRun[],modelNames:{...view.modelNames,...payload.modelNames},complete:true};
    }
   }catch(error){
    if(view.revision===revision&&!view.complete){
     status='failed';
     console.warn('Failed to load Epoch leaderboard ranking',error);
    }
   }
   if(view.complete)status='idle';
   return view.complete;
  },
  /** A live snapshot is a complete, newer corpus: it replaces rows (so withdrawals stick) and retires the page revision. */
  applyLiveSnapshot(snapshot:{benchmarks:EpochBenchmark[];runs:EpochBenchmarkRun[];modelNames:Record<string,string>}):boolean{
   if(!snapshot.runs.length)return false;
   liveSnapshots+=1;
   view={revision:`live:${liveSnapshots}`,benchmarks:snapshot.benchmarks,runs:snapshot.runs,modelNames:{...view.modelNames,...snapshot.modelNames},complete:true};
   status='idle';
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
