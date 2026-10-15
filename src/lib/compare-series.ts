import type {CompareState} from './compare-state';
import {epochConditionKey,type EpochObservation} from './epoch-observations';

export type ExplorerModel = {
  id:string; name:string; slug?:string; family:string; provider?:string; reasoning?:string;
  source:'aa'|'epoch'|'openrouter'|'huggingface'|'litellm'|'catalog'|'publisher'; sourceModelId:string; current:boolean|null;
  intelligence?:number|null; coding?:number|null; priceInput?:number|null; priceOutput?:number|null;
  aaTaskCost?:number|null; aaEvaluationCost?:number|null; inputModalities?:string[]; outputModalities?:string[];
  priceBlended?:number|null; outputSpeed?:number|null; latency?:number|null;
  indexVersion?:string|null; performancePrompt?:string|null; observedAt?:string|null; fetchedAt?:string|null; sourceUrl?:string|null;
  metrics?:Record<string,number|null>; hasTokenPrices?:boolean; detailAvailable?:boolean;
};
export const EXPLORER_SOURCE_LABELS:Record<ExplorerModel['source'],string>={aa:'Artificial Analysis',epoch:'Epoch AI',openrouter:'OpenRouter',huggingface:'Hugging Face',litellm:'LiteLLM',catalog:'Database inventory',publisher:'Original publishers'};
export function compatibleVariantLines(points:SeriesPoint[]):SeriesPoint[][] {
  const groups=new Map<string,SeriesPoint[]>();
  for(const point of points){
    if(!point.cohortKey||point.reasoning==='unknown')continue;
    const key=JSON.stringify([point.source,point.provider??point.family,point.family,point.cohortKey]);
    const group=groups.get(key)??[];group.push(point);groups.set(key,group);
  }
  return [...groups.values()].filter(group=>new Set(group.map(point=>point.reasoning)).size>1);
}
export type ExplorerEvidence = {models:ExplorerModel[]; observations:EpochObservation[]};
export type EvidenceReceipt = {
  source:string; sourceUrl:string|null; observedAt:string|null; fetchedAt:string|null;
  indexVersion:string|null; conditions:Record<string,string|number|boolean>|null; snapshotId:string|null;
};
export type SeriesPoint = {
  id:string; modelId:string; label:string; family:string; reasoning:string; series:string;
  source:ExplorerModel['source']; provider?:string; x:number; y:number; unit:string; cohortKey:string|null; receipt:EvidenceReceipt;
};
export type BarCategoryLabel={x:number;label:string;title:string;ariaLabel:string};
/** Short, unique category labels for bar charts; point values and positions are untouched. */
export function barCategoryLabels(points:SeriesPoint[]):BarCategoryLabel[]{
 const categories=[...new Map(points.map(point=>[point.x,point])).values()];
 const familyCounts=new Map<string,number>();
 categories.forEach(point=>familyCounts.set(point.family,(familyCounts.get(point.family)??0)+1));
 const reasoningLabel=(value:string)=>value==='none'?'No reasoning':value==='unknown'?'':value==='xhigh'?'Xhigh':value.charAt(0).toUpperCase()+value.slice(1);
 const base=categories.map(point=>{
  const compactFamily=point.family.replace(/^Claude\s+/i,'');
  const family=compactFamily.length>16?compactFamily.slice(0,14)+'…':compactFamily;
  const effort=reasoningLabel(point.reasoning);
  return familyCounts.get(point.family)!>1&&effort?`${family} · ${effort}`:family;
 });
 const counts=(values:string[])=>values.reduce((map,value)=>map.set(value,(map.get(value)??0)+1),new Map<string,number>());
 const baseCounts=counts(base);
 const candidates=categories.map((point,index)=>baseCounts.get(base[index])!>1?`${base[index]} · ${point.provider??point.source}`:base[index]);
 const candidateCounts=counts(candidates);
 const named=candidates.map((candidate,index)=>candidateCounts.get(candidate)!>1?`${candidate} · ${categories[index].label}`:candidate);
 const namedCounts=counts(named);
 return categories.map((point,index)=>{
  const label=namedCounts.get(named[index])!>1?`${named[index]} · ${point.modelId.slice(-5)}`:named[index];
  const full=[point.label,point.provider,EXPLORER_SOURCE_LABELS[point.source]].filter(Boolean).join(' · ');
  return {x:point.x,label,title:full,ariaLabel:full};
 });
}
export type CompareSeries = {
  available:boolean; unavailableReason:string|null; kind:'scatter'|'bars'; points:SeriesPoint[];
  excluded:Array<{modelId:string;reason:string}>; xLabel:string; yLabel:string;
  scale:'linear'|'log'; scaleNotice:string|null; omittedFromLog:SeriesPoint[]; mixedConditions:boolean;
  frontierGroups:Record<string,string[]>; higherXIsBetter:boolean;
};
/** Axis value used for log eligibility (scatter X, bar Y). */
export const seriesLogCoordinate=(point:Pick<SeriesPoint,'x'|'y'>,kind:'scatter'|'bars')=>kind==='scatter'?point.x:point.y;
/** Points that may reach log geometry; nonpositive values stay in series.points for CSV/details. */
export function plottableSeriesPoints(series:Pick<CompareSeries,'points'|'kind'|'scale'|'omittedFromLog'>):SeriesPoint[]{
  if(series.scale!=='log')return series.points;
  const omitted=new Set((series.omittedFromLog??[]).map(point=>point.id));
  return series.points.filter(point=>!omitted.has(point.id)&&seriesLogCoordinate(point,series.kind)>0);
}
function logScaleNotice(omitted:SeriesPoint[],kind:'scatter'|'bars',xLabel:string,yLabel:string):string{
  const n=omitted.length;
  const axis=kind==='scatter'?xLabel:yLabel;
  const values=omitted.map(point=>seriesLogCoordinate(point,kind));
  const zeros=values.filter(value=>value===0).length;
  const negatives=values.filter(value=>value<0).length;
  const noun=n===1?'observation':'observations';
  let detail:string;
  if(zeros&&!negatives)detail=`${n===1?'a zero':'zero'} ${axis.toLowerCase().includes('usd')||/cost|price|token/i.test(axis)?'cost':'value'}`;
  else if(negatives&&!zeros)detail=`${n===1?'a negative':'negative'} value`;
  else detail='a zero or negative value';
  if(n===1&&zeros&&!negatives){
    const costish=/cost|price|token|usd/i.test(axis);
    return `1 selected observation has a zero ${costish?'cost':'value'} and is not plotted on Log. Show all on Linear`;
  }
  return `${n} selected ${noun} ${n===1?'has':'have'} ${detail} and ${n===1?'is':'are'} not plotted on Log. Show all on Linear`;
}
export function chartLabelCandidates(points:SeriesPoint[],frontierGroups:Record<string,string[]>,limit=12):string[]{
 const priorities:string[]=[];
 for(const ids of Object.values(frontierGroups))priorities.push(...ids);
 const families=new Map<string,SeriesPoint[]>();
 for(const point of points){const group=families.get(point.family)??[];group.push(point);families.set(point.family,group);}
 for(const group of families.values()){
  const ordered=[...group].sort((a,b)=>a.x-b.x||a.y-b.y||a.id.localeCompare(b.id));
  if(ordered.length)priorities.push(ordered[0].id,ordered[ordered.length-1].id);
 }
 return [...new Set(priorities)].slice(0,Math.max(0,limit));
}
export function collisionFreeChartLabels(points:Array<SeriesPoint&{cx:number;cy:number}>,frontierGroups:Record<string,string[]>,width:number,limit=12):string[]{
 const byId=new Map(points.map(point=>[point.id,point]));
 const placed:Array<{left:number;right:number;top:number;bottom:number}>=[];
 const result:string[]=[];
 for(const id of chartLabelCandidates(points,frontierGroups,limit)){
  const point=byId.get(id);if(!point)continue;
  const textWidth=Math.max(24,point.label.length*5.8);
  const leftAligned=point.cx>width-150;
  const left=leftAligned?point.cx-8-textWidth:point.cx+8;
  const box={left,right:left+textWidth,top:point.cy-21,bottom:point.cy-7};
  if(box.left<4||box.right>width-4)continue;
  if(placed.some(other=>box.left<other.right+4&&box.right+4>other.left&&box.top<other.bottom+3&&box.bottom+3>other.top))continue;
  placed.push(box);result.push(id);
 }
 return result;
}
const finite = (value:unknown):value is number => typeof value==='number'&&Number.isFinite(value);
const nonnegative = (value:unknown):value is number => finite(value)&&value>=0;
const verifiedIndexVersion = (value:string|null|undefined):value is string => typeof value==='string'&&/^\d+(?:\.\d+)*$/.test(value);
const sourceUrl = (value:string|null|undefined):string|null => {
  try {const url=new URL(value??'');return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}
  catch{return null;}
};
export function paretoFrontiers<T extends {id:string;x:number;y:number;cohortKey:string|null}>(
  points:T[],direction:'min'|'max',
):Record<string,string[]> {
  const groups=new Map<string,T[]>();
  for(const point of points){
    if(!point.cohortKey||!finite(point.x)||!finite(point.y))continue;
    const group=groups.get(point.cohortKey)??[];group.push(point);groups.set(point.cohortKey,group);
  }
  return Object.fromEntries([...groups].sort(([a],[b])=>a.localeCompare(b)).map(([key,group])=>[key,group.filter(point=>
    !group.some(other=>other.id!==point.id&&(direction==='min'?other.x<=point.x:other.x>=point.x)&&other.y>=point.y&&
      (other.x!==point.x||other.y!==point.y))).sort((a,b)=>a.x-b.x||a.id.localeCompare(b.id)).map(point=>point.id)]));
}
export const epochScoreKey=(row:Pick<EpochObservation,'metricKey'|'unit'|'benchmarkVersion'>)=>JSON.stringify([row.metricKey??'Unknown metric',row.unit==='fraction'?'percent':row.unit,...(row.benchmarkVersion?[row.benchmarkVersion]:[])]);
export function buildCompareSeries(evidence:ExplorerEvidence,state:CompareState):CompareSeries {
  const result:CompareSeries={available:true,unavailableReason:null,kind:['cost-intelligence','speed-intelligence','task-cost','total-cost'].includes(state.chart)?'scatter':'bars',
    points:[],excluded:[],xLabel:'Model',yLabel:'Value',scale:state.scale,scaleNotice:null,omittedFromLog:[],mixedConditions:false,
    frontierGroups:{},higherXIsBetter:state.chart==='speed-intelligence'};
  const selected=new Set(state.modelIds);
  const models=evidence.models.filter(model=>{
    if(!selected.has(model.id))return false;
    const source=state.chart==='benchmark'&&state.metricId.startsWith('epoch_')?'epoch':'aa';
    if(state.chart!=='price'&&model.source!==source&&!(source==='epoch'&&model.source==='publisher')){result.excluded.push({modelId:model.id,reason:source==='epoch'?'Choose a measured source record for this benchmark':'No AA measurements for this source record'});return false;}
    let reason:string|null=null;
    if(model.current===false&&!state.includeHistory)reason='Historical observation';
    else if(model.source==='aa'&&state.reasoningEfforts.length&&!state.reasoningEfforts.includes(model.reasoning??'unknown'))reason='Reasoning filter';
    if(reason){result.excluded.push({modelId:model.id,reason});return false;}
    return true;
  });
  const receiptFor=(model:ExplorerModel):EvidenceReceipt=>({source:EXPLORER_SOURCE_LABELS[model.source],
    sourceUrl:sourceUrl(model.sourceUrl),observedAt:model.observedAt??null,fetchedAt:model.fetchedAt??null,indexVersion:model.indexVersion??null,
    conditions:model.performancePrompt?{performancePrompt:model.performancePrompt}:null,snapshotId:null});
  const add=(model:ExplorerModel,x:number,y:number,series:string,unit:string,receipt=receiptFor(model),id=model.id,cohortKey:string|null=null)=>{
    result.points.push({id,modelId:model.id,label:model.name,family:model.family,reasoning:model.reasoning??'unknown',
      source:model.source,provider:model.provider??model.family,x,y,series,unit,receipt,cohortKey});
  };
  if(state.chart==='benchmark'&&state.metricId.startsWith('epoch_')){
    const slug=state.metricId.slice(6);
    const versions=new Map(models.filter(model=>(model.source==='epoch'||model.source==='publisher')).map(model=>[model.sourceModelId,model]));
    const rows=evidence.observations.filter(row=>versions.has(row.modelVersion)&&row.benchmarkSlug===slug&&finite(row.value)&&
      (!state.conditionKey||epochConditionKey(row.conditions)===state.conditionKey)&&
      (!state.scoreMetricKey||epochScoreKey(row)===state.scoreMetricKey));
    const units=new Set(rows.map(epochScoreKey));
    if(units.size>1){
      for(const model of versions.values())result.excluded.push({modelId:model.id,reason:'Incompatible benchmark metrics or units'});
      result.yLabel='Choose a compatible benchmark metric';return result;
    }
    const conditions=new Set(rows.map(row=>epochConditionKey(row.conditions)));
    result.mixedConditions=conditions.size>1;
    rows.sort((a,b)=>a.modelVersion.localeCompare(b.modelVersion)||a.id.localeCompare(b.id)).forEach((row,index)=>{
      const model=versions.get(row.modelVersion)!;
      const unit=row.unit==='fraction'||row.unit==='percent'?'percent':row.metricKey??'Source-native score';
      add(model,index,row.value!*(row.unit==='fraction'?100:1),'observation',unit,
        {source:row.sourceName??'Epoch AI',sourceUrl:sourceUrl(row.sourceUrl),observedAt:row.evaluationDate,fetchedAt:row.fetchedAt,
          indexVersion:row.benchmarkVersion??null,conditions:row.conditions,snapshotId:row.snapshotId},
        model.id+':'+row.id,row.conditions===null||!row.benchmarkVersion?null:slug+':'+row.benchmarkVersion+':'+epochScoreKey(row)+':'+epochConditionKey(row.conditions));
    });
    result.yLabel=rows[0]?.unit==='fraction'||rows[0]?.unit==='percent'?'Score (%)':rows[0]?.metricKey??'Source-native score';
    if(slug==='btf3_external')result.yLabel+=' (lower is better)';
    for(const model of models)if(!result.points.some(point=>point.modelId===model.id)){
      result.excluded.push({modelId:model.id,reason:'No matching benchmark observation'});
    }
  } else {
    result.xLabel=state.chart==='cost-intelligence'?'USD / 1M tokens (3:1 input/output)':state.chart==='speed-intelligence'?'Output tokens / second':state.chart==='task-cost'?'USD / AA Index task':state.chart==='total-cost'?'USD / complete AA evaluation':'Model';
    result.yLabel=result.kind==='scatter'?'AA Intelligence Index':state.chart==='price'?'USD / 1M tokens':'AA benchmark value';
    models.forEach((model,index)=>{
      const cohort=model.source==='aa'&&verifiedIndexVersion(model.indexVersion)&&(state.chart!=='speed-intelligence'||model.performancePrompt)?model.indexVersion+':'+(model.performancePrompt??'unknown'):null;
      if(state.chart==='price'){
        let count=0;
        if(nonnegative(model.priceInput)){add(model,index,model.priceInput,'input','USD / 1M tokens',receiptFor(model),model.id+':input',cohort);count++;}
        if(nonnegative(model.priceOutput)){add(model,index,model.priceOutput,'output','USD / 1M tokens',receiptFor(model),model.id+':output',cohort);count++;}
        if(!count)result.excluded.push({modelId:model.id,reason:'Missing token prices'});
      }else if(state.chart==='benchmark'){
        const value=state.metricId==='aa_intelligence_index'?model.intelligence:state.metricId==='aa_coding_index'?model.coding:model.metrics?.[state.metricId];
        if(finite(value))add(model,index,value,'benchmark',state.metricId.endsWith('_index')?'Index points':'Source-native score',receiptFor(model),model.id,cohort);
        else result.excluded.push({modelId:model.id,reason:'Missing benchmark measurement'});
      }else{
        const x=state.chart==='cost-intelligence'?model.priceBlended:state.chart==='task-cost'?model.aaTaskCost:state.chart==='total-cost'?model.aaEvaluationCost:model.outputSpeed;
        if(nonnegative(x)&&finite(model.intelligence))add(model,x,model.intelligence,'model','AA Index points',receiptFor(model),model.id,cohort);
        else result.excluded.push({modelId:model.id,reason:state.chart==='cost-intelligence'?'Missing price or intelligence':state.chart==='task-cost'||state.chart==='total-cost'?'Missing evaluation cost or intelligence':'Missing speed or intelligence'});
      }
    });
  }
  if(state.scale==='log'){
    const omitted=result.points.filter(point=>!(seriesLogCoordinate(point,result.kind)>0));
    if(omitted.length){
      result.omittedFromLog=omitted;
      result.scaleNotice=logScaleNotice(omitted,result.kind,result.xLabel,result.yLabel);
      // Keep scale='log' so positive measurements stay on a logarithmic axis.
    }
  }
  if(state.frontier&&result.kind==='scatter'){
    const frontierPoints=state.scale==='log'?plottableSeriesPoints(result):result.points;
    result.frontierGroups=paretoFrontiers(frontierPoints,result.higherXIsBetter?'max':'min');
  }
  return result;
}
