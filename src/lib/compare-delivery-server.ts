import {measurementRevision} from '../../scripts/release-json.mjs';
import {getModelCatalogData} from './model-catalog-data';
import {compactCatalog,measurementBucket} from './compare-delivery';
import {defaultExplorerSelection} from './compare-catalog';
import {availableCompareCharts,availableAaMetrics,buildAaBenchmarkSelections,buildComparePresets} from './compare-presets';
import {suggestedModels} from './suggested-models';
let cached:ReturnType<typeof load>|undefined;
async function load(){
 const data=await getModelCatalogData(),records=data.records;
 const revision=measurementRevision(records);
 const scatter=(x:(model:typeof records[number])=>number|undefined|null,direction:'min'|'max'='min')=>suggestedModels(records.filter(model=>model.source==='aa'&&model.current===true&&typeof x(model)==='number'&&Number.isFinite(x(model))&&typeof model.intelligence==='number'&&Number.isFinite(model.intelligence)&&Boolean(model.indexVersion&&/^\d+(?:\.\d+)*$/.test(model.indexVersion))).map(model=>({id:model.id,modelId:model.id,x:x(model)!,y:model.intelligence!,provider:model.provider,family:model.family,indexVersion:model.indexVersion!,cohortKey:model.indexVersion+':'+(model.performancePrompt??'unknown')})),direction,8);
 const suggestedModelIds={ 'task-cost':scatter(model=>model.aaTaskCost), 'cost-intelligence':scatter(model=>model.priceBlended), 'speed-intelligence':scatter(model=>model.outputSpeed,'max'), 'total-cost':scatter(model=>model.aaEvaluationCost),
  price:records.filter(model=>typeof model.priceInput==='number'&&Number.isFinite(model.priceInput)&&model.priceInput>=0&&typeof model.priceOutput==='number'&&Number.isFinite(model.priceOutput)&&model.priceOutput>=0)
    .sort((a,b)=>(a.priceInput!+a.priceOutput!)-(b.priceInput!+b.priceOutput!)||a.id.localeCompare(b.id)).slice(0,8).map(model=>model.id) };
 const defaultModelIds=suggestedModelIds['task-cost'].length?suggestedModelIds['task-cost']:defaultExplorerSelection(records);
 const chunks=new Map<string,typeof records>();
 for(const model of records){const bucket=measurementBucket(model.id);const rows=chunks.get(bucket)??[];rows.push(model);chunks.set(bucket,rows);}
 const delivery={revision,catalog:compactCatalog(records),presets:buildComparePresets(records),charts:availableCompareCharts(records),aaMetrics:availableAaMetrics(records),aaBenchmarkSelections:buildAaBenchmarkSelections(records),suggestedModelIds};
 return {data,delivery,defaultModelIds,initialModels:records.filter(model=>defaultModelIds.includes(model.id)),chunks};
}
export const getCompareDelivery=()=>cached??=load().catch(error=>{cached=undefined;throw error;});
