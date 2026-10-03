import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepareAppRelease} from './app-release.mjs';
import {fromEpochRuns} from '../src/lib/compare-evidence.ts';
import {benchmarkAssetKey} from '../src/lib/compare-release.ts';
export function assembleAppRelease(manifest,{delivery,chunks,data}){
 const assets={};
 const evidence=data.benchmarks??data.epoch;
 for(const [bucket,records] of chunks)assets['m_'+bucket]={schemaVersion:1,revision:delivery.revision,bucket,records};
 for(const benchmark of manifest.benchmarks){
 const runs=evidence.epochRuns.filter(run=>run.benchmark_slug===benchmark.slug);
 const fetchedAt=runs[0]?.source_fetched_at??data.epoch.fetchedAt;
 assets[benchmarkAssetKey(benchmark.slug)]={schemaVersion:1,slug:benchmark.slug,name:benchmark.name,fetchedAt,
 observations:fromEpochRuns(runs,fetchedAt)};
 }
 return prepareAppRelease(manifest,assets);
}
export async function writeAppReleaseArtifacts(release,directory){
 const verified=prepareAppRelease(release.manifest,release.assets);
 const files=[['api/compare-manifest.json',verified.manifest]];
 for(const [key,value] of Object.entries(verified.assets)){
 if(key.startsWith('m_'))files.push(['api/compare-measurements/'+verified.manifest.delivery.revision+'/'+key.slice(2)+'.json',value]);
 }
 for(const benchmark of verified.manifest.benchmarks)files.push(['api/compare-benchmarks/'+benchmark.slug+'.json',verified.assets[benchmarkAssetKey(benchmark.slug)]]);
 for(const [path,value] of files){const target=resolve(directory,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,JSON.stringify(value)+'\n');}
 return {revision:verified.revision,models:verified.manifest.delivery.catalog.rows.length,assets:Object.keys(verified.assets).length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2);let directory='.tmp/app-release';
 if(args.length){if(args.length!==2||args[0]!=='--directory')throw new Error('Usage: build-app-release [--directory output]');directory=args[1];}
 const run=async()=>{
 const {getCompareReleaseManifest}=await import('../src/lib/compare-release-server.ts');
 const {getCompareDelivery}=await import('../src/lib/compare-delivery-server.ts');
 const manifest=await getCompareReleaseManifest(),data=await getCompareDelivery();
 console.log(JSON.stringify(await writeAppReleaseArtifacts(assembleAppRelease(manifest,data),directory)));
 };
 run().catch(error=>{console.error(error instanceof Error?error.message:'App data compilation failed');process.exitCode=1;});
}
