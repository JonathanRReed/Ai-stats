import {createHash} from 'node:crypto';
import {readCompareRelease,benchmarkAssetKey} from '../src/lib/compare-release.ts';
import {compactCatalog,expandCatalog,measurementBucket,validateMeasurementChunk} from '../src/lib/compare-delivery.ts';
import {availableCompareCharts,availableAaMetrics,buildComparePresets} from '../src/lib/compare-presets.ts';
const PRIVATE_KEYS=/^(raw(?:[_-]?(?:response|body|fetch))?|api[_-]?key|service[_-]?role[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization|password|secret)$/i;
function canonical(value,depth=0){
 if(depth>32)throw new Error('Release nesting exceeds limit');
 if(value===null||typeof value==='boolean')return value;
 if(typeof value==='string'){
  if(/^https?:\/\//.test(value)){const url=new URL(value);if(url.username||url.password||[...url.searchParams.keys()].some(key=>/^(token|key|api_key|access_token|signature|password)$/i.test(key)))throw new Error('Private URL in release');}
  return value;
 }
 if(typeof value==='number'&&Number.isFinite(value))return value;
 if(Array.isArray(value))return value.map(item=>canonical(item,depth+1));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>{
 if(PRIVATE_KEYS.test(key))throw new Error('Private field in release');return [key,canonical(item,depth+1)];
 }));
 throw new Error('Release must contain finite JSON data');
}
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export function prepareAppRelease(input,assetInput){
 const manifest=readCompareRelease(JSON.parse(JSON.stringify(input)));
 if(manifest.sources.some(source=>!source.available))throw new Error('Cannot publish an incomplete source catalog');
 if(!assetInput||typeof assetInput!=='object'||Array.isArray(assetInput))throw new Error('Missing release assets');
 const catalog=expandCatalog(manifest.delivery.catalog),allRows=[],expected=new Set();
 for(const bucket of new Set(catalog.map(model=>measurementBucket(model.id)))){
 const key='m_'+bucket;expected.add(key);
 allRows.push(...validateMeasurementChunk(assetInput[key],manifest.delivery.revision,bucket,catalog));
 }
 for(const benchmark of manifest.benchmarks){
 const key=benchmarkAssetKey(benchmark.slug),asset=assetInput[key];expected.add(key);
 if(!asset||asset.schemaVersion!==1||asset.slug!==benchmark.slug||!Array.isArray(asset.observations)||!asset.observations.length||
 asset.observations.some(row=>!row||typeof row.id!=='string'||typeof row.modelVersion!=='string'||row.benchmarkSlug!==benchmark.slug||
 !(row.value===null||typeof row.value==='number'&&Number.isFinite(row.value))))throw new Error('Invalid benchmark asset');
 }
 if(Object.keys(assetInput).some(key=>!expected.has(key)))throw new Error('Unexpected release asset');
 const byId=new Map(allRows.map(model=>[model.id,model])),ordered=catalog.map(model=>byId.get(model.id));
 if(!equal(compactCatalog(ordered),manifest.delivery.catalog)||!equal(availableCompareCharts(ordered),manifest.delivery.charts)||
 !equal(availableAaMetrics(ordered),manifest.delivery.aaMetrics)||!equal(buildComparePresets(ordered),manifest.delivery.presets))throw new Error('Manifest does not match measurements');
 const normalized=canonical({manifest:input,assets:assetInput,sourceReceipts:manifest.sources});
 const serialized=JSON.stringify(normalized);if(Buffer.byteLength(serialized)>20*1024*1024)throw new Error('Release exceeds cache budget');
 return {revision:createHash('sha256').update(serialized).digest('hex'),...normalized};
}
