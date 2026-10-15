import {measurementRevision} from '../../scripts/release-json.mjs';
import {getModelCatalogData} from './model-catalog-data';
import {compactCatalog,measurementBucket} from './compare-delivery';
import {defaultExplorerSelection} from './compare-catalog';
import {availableCompareCharts,availableAaMetrics,buildAaBenchmarkSelections,buildComparePresets,selectTokenPriceModels} from './compare-presets';
import {automaticFrontier,AUTOMATIC_SELECTION_POLICY} from './automatic-selection';
let cached:ReturnType<typeof load>|undefined;
async function load(){
 const data=await getModelCatalogData(),records=data.records;
 const revision=measurementRevision(records);
 const frontier=(x:(model:typeof records[number])=>number|undefined|null,direction:'min'|'max'='min')=>automaticFrontier(records,x,direction);
 const taskCost=frontier(model=>model.aaTaskCost),costIntelligence=frontier(model=>model.priceBlended),speedIntelligence=frontier(model=>model.outputSpeed,'max'),totalCost=frontier(model=>model.aaEvaluationCost);
 const suggestedModelIds={ 'task-cost':taskCost.modelIds, 'cost-intelligence':costIntelligence.modelIds, 'speed-intelligence':speedIntelligence.modelIds, 'total-cost':totalCost.modelIds,
  price:selectTokenPriceModels(records) };
 const defaultModelIds=suggestedModelIds['task-cost'].length?suggestedModelIds['task-cost']:defaultExplorerSelection(records);
 const chunks=new Map<string,typeof records>();
 for(const model of records){const bucket=measurementBucket(model.id);const rows=chunks.get(bucket)??[];rows.push(model);chunks.set(bucket,rows);}
 const suggestionFrontierCounts={'task-cost':taskCost,'cost-intelligence':costIntelligence,'speed-intelligence':speedIntelligence,'total-cost':totalCost};
 const delivery={automaticSelectionPolicy:AUTOMATIC_SELECTION_POLICY,frontierPolicy:'compatible-cohort-frontier.v1' as const,revision,catalog:compactCatalog(records),presets:buildComparePresets(records),charts:availableCompareCharts(records),aaMetrics:availableAaMetrics(records),aaBenchmarkSelections:buildAaBenchmarkSelections(records),suggestedModelIds,suggestionFrontierCounts:Object.fromEntries(Object.entries(suggestionFrontierCounts).map(([key,value])=>[key,{total:value.totalFrontierModels,truncated:value.truncated}]))};
 return {data,delivery,defaultModelIds,initialModels:records.filter(model=>defaultModelIds.includes(model.id)),chunks};
}
export const getCompareDelivery=()=>cached??=load().catch(error=>{cached=undefined;throw error;});
