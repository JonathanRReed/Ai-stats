import {adaptPublisherEvidence,PUBLISHER_NAMES,type PublisherSnapshot} from './publisher-evidence';
import type {EpochBenchmark,EpochBenchmarkRun} from './supabase';

export type EpochLeaderboardRankingCorpus={
 benchmarks:EpochBenchmark[];
 runs:EpochBenchmarkRun[];
 modelNames:Record<string,string>;
 revision:string;
};

type FetchLike=(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>;

const toStringOrEmpty=(value:unknown):string=>{
 if(value===null||value===undefined)return '';
 return String(value);
};
const toStringOrNull=(value:unknown):string|null=>{
 if(value===null||value===undefined)return null;
 const text=String(value).trim();
 return text.length?text:null;
};
const toNumberOrNull=(value:unknown):number|null=>{
 if(value===null||value===undefined)return null;
 const number=Number(value);
 return Number.isFinite(number)?number:null;
};

function normalizeEpochBenchmark(row:Record<string,unknown>):EpochBenchmark{
 return {
  id:toStringOrEmpty(row.id||row.slug),
  slug:toStringOrEmpty(row.slug),
  name:toStringOrEmpty(row.name||row.slug),
  description:toStringOrNull(row.description),
  source:toStringOrNull(row.source),
  metadata:row.metadata&&typeof row.metadata==='object'&&!Array.isArray(row.metadata)
   ?row.metadata as Record<string,string|null>
   :null,
 };
}

function normalizeEpochRun(row:Record<string,unknown>,benchmarkMap:Map<string,EpochBenchmark>):EpochBenchmarkRun{
 const benchmarkSlug=toStringOrEmpty(row.benchmark_slug||row.benchmark_id);
 const benchmark=benchmarkMap.get(benchmarkSlug);
 return {
  id:toStringOrEmpty(row.id),
  model_version:toStringOrEmpty(row.model_version),
  benchmark_id:benchmark?.id??benchmarkSlug,
  score:toNumberOrNull(row.score),
  release_date:toStringOrNull(row.release_date),
  organization:toStringOrNull(row.organization),
  country:toStringOrNull(row.country),
  stderr:toNumberOrNull(row.stderr),
  score_metric:toStringOrNull(row.score_metric),
  source_name:toStringOrNull(row.source_name),
  source_link:toStringOrNull(row.source_link),
  conditions:row.conditions&&typeof row.conditions==='object'&&!Array.isArray(row.conditions)
   ?row.conditions as Record<string,string|number|boolean>
   :null,
  evaluation_date:toStringOrNull(row.evaluation_date),
  score_unit:(()=>{const unit=toStringOrNull(row.score_unit);return unit==='percent'||unit==='fraction'||unit==='native'?unit:'native';})(),
  benchmark_version:toStringOrNull(row.benchmark_version),
  benchmark_name:benchmark?.name??toStringOrNull(row.benchmark_name)??undefined,
  benchmark_slug:benchmark?.slug??benchmarkSlug,
  source_key:toStringOrNull(row.source_key)??undefined,
  higher_is_better:typeof row.higher_is_better==='boolean'?row.higher_is_better:undefined,
 };
}

export function parseEpochSnapshotPayload(snapshot:Record<string,unknown>):Omit<EpochLeaderboardRankingCorpus,'revision'>&{fetchedAt:string|null}{
 const epochBenchmarks=(Array.isArray(snapshot.benchmarks)?snapshot.benchmarks:[]).map(row=>normalizeEpochBenchmark(row as Record<string,unknown>));
 const benchmarkMap=new Map(epochBenchmarks.map(benchmark=>[benchmark.slug,benchmark]));
 const epochRuns=(Array.isArray(snapshot.runs)?snapshot.runs:[]).map(row=>normalizeEpochRun(row as Record<string,unknown>,benchmarkMap));
 const modelNames=Object.fromEntries((Array.isArray(snapshot.models)?snapshot.models:[]).flatMap(row=>{
  const record=row as Record<string,unknown>;
  const version=toStringOrEmpty(record.model_version);
  const name=toStringOrNull(record.display_name)||toStringOrNull(record.model_name);
  return version&&name?[[version,name] as const]:[];
 }));
 const fetchedAt=typeof snapshot.fetched_at==='string'&&Number.isFinite(Date.parse(snapshot.fetched_at))?snapshot.fetched_at:null;
 return {benchmarks:epochBenchmarks,runs:epochRuns,modelNames,fetchedAt};
}

export function rankingCorpusRevision(parts:Array<string|null|undefined>):string{
 return parts.filter(Boolean).join('|')||'unknown';
}

export function createEpochLeaderboardRankingLoader(options:{
 fetch?:FetchLike;
 epochSnapshotUrl?:string;
 publisherKeys?:string[];
 publisherUrl?:(sourceKey:string)=>string;
}={}){
 const fetchImpl=options.fetch??fetch;
 const epochSnapshotUrl=options.epochSnapshotUrl??'/data/epoch-benchmark-snapshot.json';
 const publisherKeys=options.publisherKeys??Object.keys(PUBLISHER_NAMES);
 const publisherUrl=options.publisherUrl??((sourceKey:string)=>`/data/publisher-benchmarks/${sourceKey}.json`);
 let inFlight:Promise<EpochLeaderboardRankingCorpus>|null=null;
 let cached:EpochLeaderboardRankingCorpus|null=null;

 const loadFull=async(signal?:AbortSignal):Promise<EpochLeaderboardRankingCorpus>=>{
  if(cached)return cached;
  if(inFlight)return inFlight;
  inFlight=(async()=>{
   const epochResponse=await fetchImpl(epochSnapshotUrl,{cache:'force-cache',signal});
   if(!epochResponse.ok)throw new Error(`Epoch ranking snapshot failed with ${epochResponse.status}`);
   const epochParsed=parseEpochSnapshotPayload(await epochResponse.json() as Record<string,unknown>);
   const publisherSnapshots:PublisherSnapshot[]=[];
   for(const sourceKey of publisherKeys){
    const response=await fetchImpl(publisherUrl(sourceKey),{cache:'force-cache',signal});
    if(!response.ok)throw new Error(`Publisher ranking snapshot ${sourceKey} failed with ${response.status}`);
    publisherSnapshots.push(await response.json() as PublisherSnapshot);
   }
   const publishers=adaptPublisherEvidence(publisherSnapshots);
   const corpus:EpochLeaderboardRankingCorpus={
    benchmarks:[...epochParsed.benchmarks,...publishers.benchmarks],
    runs:[...epochParsed.runs,...publishers.runs],
    modelNames:{
     ...epochParsed.modelNames,
     ...Object.fromEntries(publishers.models.map(model=>[model.sourceModelId,model.family])),
    },
    revision:rankingCorpusRevision([
     epochParsed.fetchedAt,
     ...publisherSnapshots.map(snapshot=>snapshot.fetchedAt),
    ]),
   };
   cached=corpus;
   return corpus;
  })();
  try{
   return await inFlight;
  }finally{
   inFlight=null;
  }
 };

 return {
  loadFull,
  getCached:()=>cached,
  clear:()=>{cached=null;inFlight=null;},
 };
}

/** Prefer the larger ranked list without dropping a newer in-memory choice on failed refresh. */
export function mergeEpochLeaderboardRuns(current:EpochBenchmarkRun[],incoming:EpochBenchmarkRun[]):EpochBenchmarkRun[]{
 if(!incoming.length)return current;
 if(!current.length)return incoming;
 const byId=new Map(current.map(run=>[run.id,run]));
 for(const run of incoming)byId.set(run.id,run);
 return [...byId.values()];
}
