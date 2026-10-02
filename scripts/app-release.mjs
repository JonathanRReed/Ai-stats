import {canonical,measurementRevision} from './release-json.mjs';
import {validateBenchmarkAsset} from '../src/lib/compare-benchmark-asset.ts';
import {createHash} from 'node:crypto';
import {readCompareRelease,benchmarkAssetKey} from '../src/lib/compare-release.ts';
import {compactCatalog,expandCatalog,measurementBucket,validateMeasurementChunk} from '../src/lib/compare-delivery.ts';
import {availableCompareCharts,availableAaMetrics,buildComparePresets} from '../src/lib/compare-presets.ts';
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export function prepareAppRelease(input,assetInput){
 const manifest=readCompareRelease(JSON.parse(JSON.stringify(input)));
 if(manifest.sources.some(source=>!source.available))throw new Error('Cannot publish an incomplete source catalog');
 if(!assetInput||typeof assetInput!=='object'||Array.isArray(assetInput))throw new Error('Missing release assets');
 const catalog=expandCatalog(manifest.delivery.catalog),allRows=[],allObservations=[],expected=new Set();
 for(const bucket of new Set(catalog.map(model=>measurementBucket(model.id)))){
 const key='m_'+bucket;expected.add(key);
 allRows.push(...validateMeasurementChunk(assetInput[key],manifest.delivery.revision,bucket,catalog));
 }
 for(const benchmark of manifest.benchmarks){
 const key=benchmarkAssetKey(benchmark.slug),asset=assetInput[key];expected.add(key);
 validateBenchmarkAsset(asset,benchmark.slug);
 allObservations.push(...asset.observations);
 }
 if(Object.keys(assetInput).some(key=>!expected.has(key)))throw new Error('Unexpected release asset');
 const byId=new Map(allRows.map(model=>[model.id,model])),ordered=catalog.map(model=>byId.get(model.id));
 if(measurementRevision(ordered)!==manifest.delivery.revision)throw new Error('Measurement fingerprint mismatch');
 if(!equal(manifest.models,ordered.filter(model=>manifest.defaultModelIds.includes(model.id))))throw new Error('Default measurements differ from release assets');
 if(!equal(compactCatalog(ordered),manifest.delivery.catalog)||!equal(availableCompareCharts(ordered),manifest.delivery.charts)||
 !equal(availableAaMetrics(ordered),manifest.delivery.aaMetrics)||!equal(buildComparePresets(ordered),manifest.delivery.presets))throw new Error('Manifest does not match measurements');
 if(releaseDatasetRevision(manifest,allObservations)!==manifest.datasetRevision)throw new Error('Dataset fingerprint mismatch');
 const normalized=canonical({manifest:input,assets:assetInput,sourceReceipts:manifest.sources});
 const serialized=JSON.stringify(normalized);if(Buffer.byteLength(serialized)>20*1024*1024)throw new Error('Release exceeds cache budget');
 return {revision:createHash('sha256').update(serialized).digest('hex'),...normalized};
}

export function releaseDatasetRevision(manifest,observations){
 const data={delivery:manifest.delivery,benchmarks:manifest.benchmarks,sources:manifest.sources,
 observations:[...observations].sort((a,b)=>a.benchmarkSlug.localeCompare(b.benchmarkSlug)||a.id.localeCompare(b.id))};
 return createHash('sha256').update(JSON.stringify(canonical(data))).digest('hex');
}
