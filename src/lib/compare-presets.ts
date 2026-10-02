import {AA_METRIC_LABELS,type CompareChart} from './compare-state';
import type {ExplorerModel} from './compare-series';
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const nonnegative=(value:unknown):value is number=>finite(value)&&value>=0;
export const COMPARE_VIEW_LABELS:Array<{id:CompareChart;label:string}>=[
 {id:'cost-intelligence',label:'Price vs intelligence'},{id:'speed-intelligence',label:'Speed vs intelligence'},
 {id:'price',label:'Token prices'},{id:'benchmark',label:'Benchmarks'},
 {id:'task-cost',label:'Cost per task'},{id:'total-cost',label:'Evaluation cost'},
];
export function availableCompareCharts(models:ExplorerModel[]){
 return COMPARE_VIEW_LABELS.filter(view=>view.id!=='task-cost'&&view.id!=='total-cost'||models.some(model=>
 model.source==='aa'&&finite(model.intelligence)&&nonnegative(view.id==='task-cost'?model.aaTaskCost:model.aaEvaluationCost)));
}
export function availableAaMetrics(models:ExplorerModel[]){
 return Object.entries(AA_METRIC_LABELS).filter(([key])=>models.some(model=>model.source==='aa'&&finite(
 key==='aa_intelligence_index'?model.intelligence:key==='aa_coding_index'?model.coding:model.metrics?.[key])));
}
export function nextCatalogSource(models:ExplorerModel[],source:string,includeHistory:boolean):string{
 return source==='all'||models.some(model=>model.source===source&&(includeHistory||model.current!==false))?source:'all';
}
export type ComparePreset={id:string;label:string;description:string;modelIds:string[];chart:CompareChart;metricId:string};
const diverse=(models:ExplorerModel[])=>{
 const providers=new Set<string>();return models.filter(model=>{const key=model.provider??model.id;
 if(providers.has(key)||providers.size>=6)return false;providers.add(key);return true;}).map(model=>model.id);
};
/** Presets use explicit measured criteria; they do not infer licenses or benchmark missing records. */
export function buildComparePresets(models:ExplorerModel[]):ComparePreset[]{
 const current=models.filter(model=>model.source==='aa'&&model.current===true&&model.indexVersion);
 const versions=[...new Set(current.map(model=>model.indexVersion!))].filter(version=>/^\d+(?:\.\d+)*$/.test(version));
 const orderedVersions=versions.sort((a,b)=>{
 const left=a.split('.').map(Number),right=b.split('.').map(Number);
 for(let i=0;i<Math.max(left.length,right.length);i++){const difference=(right[i]??0)-(left[i]??0);if(difference)return difference;}return 0;
 });
 const eligibleCohort=(eligible:(model:ExplorerModel)=>boolean)=>{
 const candidates=current.filter(eligible);
 const version=orderedVersions.find(value=>candidates.some(model=>model.indexVersion===value));
 return {version,models:candidates.filter(model=>model.indexVersion===version)};
 };
 const coding=eligibleCohort(model=>finite(model.coding));
 const budget=eligibleCohort(model=>finite(model.intelligence)&&finite(model.priceBlended)&&model.priceBlended>0&&model.priceBlended<=1);
 const byId=(a:ExplorerModel,b:ExplorerModel)=>a.id.localeCompare(b.id);
 const presets:ComparePreset[]=[
 {id:'coding',label:'Coding',description:'Highest recorded AA Coding scores · index '+coding.version+' · one per provider, up to six',
 chart:'benchmark',metricId:'aa_coding_index',modelIds:diverse(coding.models.sort((a,b)=>b.coding!-a.coding!||byId(a,b)))},
 {id:'budget',label:'Under $1 / 1M',description:'AA 3:1 blended price above $0 and up to $1 per million tokens · highest Intelligence scores · index '+budget.version+' · one per provider',
 chart:'cost-intelligence',metricId:'aa_intelligence_index',modelIds:diverse(budget.models.sort((a,b)=>b.intelligence!-a.intelligence!||byId(a,b)))},
 {id:'free',label:'Free text routes',description:'OpenRouter :free text routes with $0 input and output token prices · one per provider, alphabetically · provider rate limits apply',
 chart:'price',metricId:'aa_intelligence_index',modelIds:diverse(models.filter(model=>model.source==='openrouter'&&model.current===true&&
 model.sourceModelId.endsWith(':free')&&model.priceInput===0&&model.priceOutput===0&&model.inputModalities?.includes('text')&&model.outputModalities?.includes('text')).sort(byId))},
 ];return presets.filter(preset=>preset.modelIds.length);
}
