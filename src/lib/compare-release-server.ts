import {releaseDatasetRevision} from '../../scripts/app-release.mjs';
import {fromEpochRuns} from './compare-evidence';
import {getCompareDelivery} from './compare-delivery-server';
import {getEpochBenchmarksWithRuns,getEpochBenchmarkLabel} from './benchmark-catalog';
import {getActiveRefreshPolicy} from '../../scripts/source-refresh-policy.mjs';
import {RELEASE_SCHEMA,type ReleaseSource} from './compare-release';
const latest=(values:Array<string|null|undefined>)=>{
 const times=values.filter((value):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value))).map(value=>Date.parse(value));
 return times.length?new Date(Math.max(...times)).toISOString():null;
};
export async function getCompareReleaseManifest(){
 const {data,delivery,defaultModelIds,initialModels}=await getCompareDelivery();
 const extra=(sourceKey:string,fetchedAt:string|null,available:boolean):ReleaseSource=>({
 sourceKey,fetchedAt,available,publishedAt:null,observedAt:null,contentHash:null,snapshotId:null,
 status:!available?'unavailable':!fetchedAt||Date.now()-Date.parse(fetchedAt)>getActiveRefreshPolicy(sourceKey).staleAfterHours*3600000?'stale':'healthy'
 });
 const sources:ReleaseSource[]=[
 extra('artificial-analysis',latest(data.aaModels.filter(model=>model.current_source_member===true).map(model=>model.last_seen)),initialModels.length>0),
 extra('epoch-ai',data.epoch.fetchedAt,Boolean(data.epoch.fetchedAt)&&data.epoch.epochModels.length>0),
 ...data.catalogs.availability.map(receipt=>({sourceKey:receipt.sourceKey,fetchedAt:receipt.fetchedAt,publishedAt:receipt.publishedAt,
 observedAt:null,contentHash:receipt.contentHash,snapshotId:receipt.snapshotId,status:receipt.status,available:receipt.available}))
 ];
 const manifest={schemaVersion:RELEASE_SCHEMA,generatedAt:latest(sources.map(source=>source.fetchedAt))??new Date(0).toISOString(),
 models:initialModels,defaultModelIds,delivery,sources,benchmarks:getEpochBenchmarksWithRuns(data.epoch.epochBenchmarks,data.epoch.epochRuns)
 .filter(benchmark=>/^[a-z0-9_-]{1,120}$/.test(benchmark.slug)).map(benchmark=>({slug:benchmark.slug,name:getEpochBenchmarkLabel(benchmark)}))};
 return {...manifest,datasetRevision:releaseDatasetRevision(manifest,fromEpochRuns(data.epoch.epochRuns,data.epoch.fetchedAt))};
}
