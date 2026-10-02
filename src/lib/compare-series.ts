import type {CompareState} from './compare-state';
import {epochConditionKey,type EpochObservation} from './epoch-observations';

export type ExplorerModel = {
  id:string; name:string; family:string; provider?:string; reasoning?:string;
  source:'aa'|'epoch'; sourceModelId:string; current:boolean|null;
  intelligence?:number|null; coding?:number|null; priceInput?:number|null; priceOutput?:number|null;
  priceBlended?:number|null; outputSpeed?:number|null; latency?:number|null;
  indexVersion?:string|null; performancePrompt?:string|null; observedAt?:string|null; sourceUrl?:string|null;
  metrics?:Record<string,number|null>;
};
export type ExplorerEvidence = {models:ExplorerModel[]; observations:EpochObservation[]};
export type EvidenceReceipt = {
  source:string; sourceUrl:string|null; observedAt:string|null; fetchedAt:string|null;
  indexVersion:string|null; conditions:Record<string,string|number|boolean>|null; snapshotId:string|null;
};
export type SeriesPoint = {
  id:string; modelId:string; label:string; family:string; reasoning:string; series:string;
  x:number; y:number; unit:string; cohortKey:string|null; receipt:EvidenceReceipt;
};
export type CompareSeries = {
  available:boolean; unavailableReason:string|null; kind:'scatter'|'bars'; points:SeriesPoint[];
  excluded:Array<{modelId:string;reason:string}>; xLabel:string; yLabel:string;
  scale:'linear'|'log'; scaleNotice:string|null; mixedConditions:boolean;
  frontierGroups:Record<string,string[]>; higherXIsBetter:boolean;
};
const finite = (value:unknown):value is number => typeof value==='number'&&Number.isFinite(value);
const nonnegative = (value:unknown):value is number => finite(value)&&value>=0;
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
export function buildCompareSeries(evidence:ExplorerEvidence,state:CompareState):CompareSeries {
  const result:CompareSeries={available:true,unavailableReason:null,kind:state.chart==='cost-intelligence'||state.chart==='speed-intelligence'?'scatter':'bars',
    points:[],excluded:[],xLabel:'Model',yLabel:'Value',scale:state.scale,scaleNotice:null,mixedConditions:false,
    frontierGroups:{},higherXIsBetter:state.chart==='speed-intelligence'};
  if(['task-cost','total-cost','tokens-task','tokens-total'].includes(state.chart)){
    return {...result,available:false,unavailableReason:'Additional benchmark cost and token data is awaiting source permission.'};
  }
  const selected=new Set(state.modelIds);
  const models=evidence.models.filter(model=>{
    if(!selected.has(model.id))return false;
    const source=state.chart==='benchmark'&&state.metricId.startsWith('epoch_')?'epoch':'aa';
    if(model.source!==source)return false;
    let reason:string|null=null;
    if(model.current===false&&!state.includeHistory)reason='Historical observation';
    else if(model.source==='aa'&&state.reasoningEfforts.length&&!state.reasoningEfforts.includes(model.reasoning??'unknown'))reason='Reasoning filter';
    if(reason){result.excluded.push({modelId:model.id,reason});return false;}
    return true;
  });
  const receiptFor=(model:ExplorerModel):EvidenceReceipt=>({source:model.source==='aa'?'Artificial Analysis':'Epoch AI',
    sourceUrl:sourceUrl(model.sourceUrl),observedAt:model.observedAt??null,fetchedAt:null,indexVersion:model.indexVersion??null,
    conditions:model.performancePrompt?{performancePrompt:model.performancePrompt}:null,snapshotId:null});
  const add=(model:ExplorerModel,x:number,y:number,series:string,unit:string,receipt=receiptFor(model),id=model.id,cohortKey:string|null=null)=>{
    result.points.push({id,modelId:model.id,label:model.name,family:model.family,reasoning:model.reasoning??'unknown',
      x,y,series,unit,receipt,cohortKey});
  };
  if(state.chart==='benchmark'&&state.metricId.startsWith('epoch_')){
    const slug=state.metricId.slice(6);
    const versions=new Map(models.filter(model=>model.source==='epoch').map(model=>[model.sourceModelId,model]));
    const rows=evidence.observations.filter(row=>versions.has(row.modelVersion)&&row.benchmarkSlug===slug&&finite(row.value)&&
      (!state.conditionKey||epochConditionKey(row.conditions)===state.conditionKey));
    const units=new Set(rows.map(row=>(row.unit==='fraction'?'percent':row.unit)+':'+(row.metricKey??'unknown')));
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
        {source:'Epoch AI',sourceUrl:sourceUrl(row.sourceUrl),observedAt:row.evaluationDate,fetchedAt:row.fetchedAt,
          indexVersion:null,conditions:row.conditions,snapshotId:row.snapshotId},
        model.id+':'+row.id,row.conditions===null?null:slug+':'+epochConditionKey(row.conditions));
    });
    result.yLabel=rows[0]?.unit==='fraction'||rows[0]?.unit==='percent'?'Score (%)':rows[0]?.metricKey??'Source-native score';
    for(const model of models)if(!result.points.some(point=>point.modelId===model.id)){
      result.excluded.push({modelId:model.id,reason:'No matching Epoch observation'});
    }
  } else {
    result.xLabel=state.chart==='cost-intelligence'?'USD / 1M tokens (3:1 input/output)':state.chart==='speed-intelligence'?'Output tokens / second':'Model';
    result.yLabel=result.kind==='scatter'?'AA Intelligence Index':state.chart==='price'?'USD / 1M tokens':'AA benchmark value';
    models.forEach((model,index)=>{
      const cohort=model.source==='aa'&&model.indexVersion&&(state.chart!=='speed-intelligence'||model.performancePrompt)?model.indexVersion+':'+(model.performancePrompt??'unknown'):null;
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
        const x=state.chart==='cost-intelligence'?model.priceBlended:model.outputSpeed;
        if(nonnegative(x)&&finite(model.intelligence))add(model,x,model.intelligence,'model','AA Index points',receiptFor(model),model.id,cohort);
        else result.excluded.push({modelId:model.id,reason:state.chart==='cost-intelligence'?'Missing price or intelligence':'Missing speed or intelligence'});
      }
    });
  }
  if(state.scale==='log'&&result.points.some(point=>(result.kind==='scatter'?point.x:point.y)<=0)){
    result.scale='linear';result.scaleNotice='A zero or negative value requires a linear scale.';
  }
  if(state.frontier&&result.kind==='scatter')result.frontierGroups=paretoFrontiers(result.points,result.higherXIsBetter?'max':'min');
  return result;
}
