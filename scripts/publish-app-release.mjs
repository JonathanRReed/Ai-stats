import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readCompareRelease,benchmarkAssetKey} from '../src/lib/compare-release.ts';
import {expandCatalog,measurementBucket} from '../src/lib/compare-delivery.ts';
import {prepareAppRelease} from './app-release.mjs';
export async function readAppReleaseArtifacts(directory='dist',readFileImpl=path=>readFile(path,'utf8')){
 const manifest=readCompareRelease(JSON.parse(await readFileImpl(resolve(directory,'api/compare-manifest.json'))));
 const assets={};
 for(const bucket of new Set(expandCatalog(manifest.delivery.catalog).map(model=>measurementBucket(model.id)))){
 assets['m_'+bucket]=JSON.parse(await readFileImpl(resolve(directory,'api/compare-measurements',manifest.delivery.revision,bucket+'.json')));
 }
 for(const benchmark of manifest.benchmarks){
 assets[benchmarkAssetKey(benchmark.slug)]=JSON.parse(await readFileImpl(resolve(directory,'api/compare-benchmarks',benchmark.slug+'.json')));
 }
 return prepareAppRelease(manifest,assets);
}
export async function publishAppRelease({release,baseUrl,serviceKey,fetchImpl=(url,init)=>fetch(url,init)}){
 let origin;
 try{const url=new URL(baseUrl);if(url.protocol!=='https:'||url.hostname!=='bgbqdzmgxkwstjihgeef.supabase.co'||url.port||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname))throw new Error();origin=url.origin;}
 catch{throw new Error('Invalid app release origin');}
 const prepared=prepareAppRelease(release.manifest,release.assets);
 if(prepared.revision!==release.revision)throw new Error('App release revision mismatch');
 if(typeof serviceKey!=='string'||!serviceKey.trim())throw new Error('Missing server publication identity');
 let response;
 try{response=await fetchImpl(origin+'/rest/v1/rpc/publish_app_release',{method:'POST',redirect:'error',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},
 body:JSON.stringify({p_revision:prepared.revision,p_manifest:prepared.manifest,p_assets:prepared.assets,p_source_receipts:prepared.sourceReceipts})});}
 catch{throw new Error('App release publication request failed');}
 if(!response.ok)throw new Error('App release publication failed ('+response.status+')');
 const receipt=await response.json();if(receipt!==prepared.revision)throw new Error('App release publication receipt mismatch');
 return {revision:receipt,models:prepared.manifest.delivery.catalog.rows.length,assets:Object.keys(prepared.assets).length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let directory='dist',publish=false;
 const args=process.argv.slice(2);
 for(let i=0;i<args.length;i++){
 if(args[i]==='--publish')publish=true;
 else if(args[i]==='--dry-run')publish=false;
 else if(args[i]==='--directory'&&args[i+1])directory=args[++i];
 else throw new Error('Usage: publish-app-release [--directory dist] [--dry-run|--publish]');
 }
 readAppReleaseArtifacts(directory).then(async release=>{
 const result=publish?await publishAppRelease({release,baseUrl:process.env.SUPABASE_URL,serviceKey:process.env.SUPABASE_SERVICE_ROLE_KEY}):
 {revision:release.revision,models:release.manifest.delivery.catalog.rows.length,assets:Object.keys(release.assets).length,dryRun:true};
 console.log(JSON.stringify(result));
 }).catch(error=>{console.error(error instanceof Error?error.message:'App release validation failed');process.exitCode=1;});
}
