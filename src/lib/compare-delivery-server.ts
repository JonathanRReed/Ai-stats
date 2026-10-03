import {measurementRevision} from '../../scripts/release-json.mjs';
import {getModelCatalogData} from './model-catalog-data';
import {compactCatalog,measurementBucket} from './compare-delivery';
import {defaultExplorerSelection} from './compare-catalog';
import {availableCompareCharts,availableAaMetrics,buildAaBenchmarkSelections,buildComparePresets} from './compare-presets';
let cached:ReturnType<typeof load>|undefined;
async function load(){
 const data=await getModelCatalogData(),records=data.records;
 const revision=measurementRevision(records);
 const defaultModelIds=defaultExplorerSelection(records);
 const chunks=new Map<string,typeof records>();
 for(const model of records){const bucket=measurementBucket(model.id);const rows=chunks.get(bucket)??[];rows.push(model);chunks.set(bucket,rows);}
 const delivery={revision,catalog:compactCatalog(records),presets:buildComparePresets(records),charts:availableCompareCharts(records),aaMetrics:availableAaMetrics(records),aaBenchmarkSelections:buildAaBenchmarkSelections(records)};
 return {data,delivery,defaultModelIds,initialModels:records.filter(model=>defaultModelIds.includes(model.id)),chunks};
}
export const getCompareDelivery=()=>cached??=load().catch(error=>{cached=undefined;throw error;});
