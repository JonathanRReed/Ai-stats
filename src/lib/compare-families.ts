import type {ExplorerModel} from './compare-series';

export type CompareFamily={
 key:string;source:ExplorerModel['source'];provider:string;family:string;records:ExplorerModel[];
 selectedIds:string[];suggested:boolean;
};

/** Prefer records that can produce points in the active chart, while retaining explicit choices. */
export function compareCatalogScope(models:ExplorerModel[],chart:string,metricId:string,selectedIds:string[],allCatalog=false):ExplorerModel[]{
 if(allCatalog)return models;
 const selected=new Set(selectedIds);
 const matches=(model:ExplorerModel)=>{
  if(chart==='benchmark')return metricId.startsWith('epoch_')?['epoch','publisher'].includes(model.source):model.source==='aa';
  if(chart==='price')return ['aa','openrouter','litellm'].includes(model.source)&&Boolean(model.hasTokenPrices||[model.priceInput,model.priceOutput].some(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0));
  if(['cost-intelligence','speed-intelligence','task-cost','total-cost'].includes(chart))return model.source==='aa';
  return true;
 };
 const scoped=models.filter(matches),ids=new Set(scoped.map(model=>model.id));
 return [...scoped,...models.filter(model=>selected.has(model.id)&&!ids.has(model.id))];
}

export function compareFamilyKey(model:Pick<ExplorerModel,'source'|'provider'|'family'>):string{
 return JSON.stringify([model.source,model.provider??model.family,model.family]);
}


export type FamilyBrowseSort='recommend'|'alpha';

/** Higher is stronger for the active comparable chart; -Infinity means unmeasured in compact/full data. */
export function familyComparableStrength(records:ExplorerModel[],chart:string,metricId='aa_intelligence_index'):number{
 const current=records.filter(model=>model.current!==false);
 const pool=current.length?current:records;
 const strengths:number[]=[];
 for(const model of pool){
  if(chart==='task-cost'||chart==='total-cost'||chart==='cost-intelligence'||chart==='speed-intelligence'){
   const x=chart==='task-cost'?model.aaTaskCost:chart==='total-cost'?model.aaEvaluationCost:chart==='cost-intelligence'?model.priceBlended:model.outputSpeed;
   if(typeof model.intelligence==='number'&&Number.isFinite(model.intelligence)&&typeof x==='number'&&Number.isFinite(x)&&x>=0)strengths.push(model.intelligence);
   continue;
  }
  if(chart==='price'){
   const priced=Boolean(model.hasTokenPrices)||[model.priceInput,model.priceOutput].some(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0);
   if(!priced)continue;
   strengths.push(typeof model.intelligence==='number'&&Number.isFinite(model.intelligence)?model.intelligence:0);
   continue;
  }
  if(chart==='benchmark'){
   if(metricId.startsWith('epoch_')){
    if(model.source==='epoch'||model.source==='publisher')strengths.push(model.current===false?0:1);
    continue;
   }
   const value=metricId==='aa_intelligence_index'?model.intelligence:metricId==='aa_coding_index'?model.coding:model.metrics?.[metricId];
   if(typeof value==='number'&&Number.isFinite(value))strengths.push(value);
  }
 }
 return strengths.length?Math.max(...strengths):Number.NEGATIVE_INFINITY;
}

/** Current measured families outrank historical-only and unmeasured ones. */
export function familyRecommendRank(records:ExplorerModel[],chart:string,metricId='aa_intelligence_index'):{tier:number;strength:number}{
 const current=records.filter(model=>model.current!==false);
 const currentStrength=familyComparableStrength(current,chart,metricId);
 if(Number.isFinite(currentStrength))return {tier:2,strength:currentStrength};
 const anyStrength=familyComparableStrength(records,chart,metricId);
 if(Number.isFinite(anyStrength))return {tier:1,strength:anyStrength};
 return {tier:0,strength:Number.NEGATIVE_INFINITY};
}

export type BrowseFamilyOrder={familyKeys:string[];ranks:Record<string,number[]>};

/** Compact revision-consistent browse ranks: familyKeys once, per-chart index permutations only when they beat alpha. */
export function buildBrowseFamilyOrder(models:ExplorerModel[],charts:string[]=['task-cost','cost-intelligence','speed-intelligence','total-cost','price','benchmark']):BrowseFamilyOrder{
 const byKey=new Map<string,ExplorerModel[]>();
 for(const model of models){
  const key=compareFamilyKey(model);
  const group=byKey.get(key)??[];group.push(model);byKey.set(key,group);
 }
 const familyKeys=[...byKey.keys()].sort((left,right)=>{
  const a=byKey.get(left)![0],b=byKey.get(right)![0];
  return a.family.localeCompare(b.family,'en',{numeric:true})||(a.provider??a.family).localeCompare(b.provider??b.family,'en')||left.localeCompare(right);
 });
 const ranks:Record<string,number[]>={};
 for(const chart of charts){
  const indexed=familyKeys.map((_,index)=>index);
  const recommend=[...indexed].sort((left,right)=>{
   const a=familyRecommendRank(byKey.get(familyKeys[left])!,chart);
   const b=familyRecommendRank(byKey.get(familyKeys[right])!,chart);
   if(a.tier!==b.tier)return b.tier-a.tier;
   if(a.strength!==b.strength)return b.strength-a.strength;
   return left-right;
  });
  if(recommend.some(index=>familyRecommendRank(byKey.get(familyKeys[index])!,chart).tier>0)&&recommend.some((index,position)=>index!==indexed[position])){
   ranks[chart]=recommend;
  }
 }
 return {familyKeys,ranks};
}

/** Expand compact ranks into family-key arrays for the active chart. */
export function browseOrderKeys(order:BrowseFamilyOrder|Record<string,string[]>|undefined,chart:string):string[]|undefined{
 if(!order)return undefined;
 if(Array.isArray((order as BrowseFamilyOrder).familyKeys)){
  const compact=order as BrowseFamilyOrder;
  const ranked=compact.ranks[chart];
  if(!ranked)return undefined;
  return ranked.map(index=>compact.familyKeys[index]).filter(Boolean);
 }
 const legacy=(order as Record<string,string[]>)[chart];
 return legacy;
}

export function groupCompareFamilies(models:ExplorerModel[],selectedIds:string[],query='',suggestedIds:string[]=[],options:{sort?:FamilyBrowseSort;browseOrder?:readonly string[];chart?:string;metricId?:string}={}):CompareFamily[]{
 const selected=new Set(selectedIds),suggested=new Set(suggestedIds),term=query.trim().toLocaleLowerCase('en-US');
 const groups=new Map<string,CompareFamily>();
 for(const model of models){
  const key=compareFamilyKey(model);let group=groups.get(key);
  if(!group){group={key,source:model.source,provider:model.provider??model.family,family:model.family,records:[],selectedIds:[],suggested:false};groups.set(key,group);}
  group.records.push(model);
  if(selected.has(model.id))group.selectedIds.push(model.id);
  if(suggested.has(model.id))group.suggested=true;
 }
 const rank=new Map((options.browseOrder??[]).map((key,index)=>[key,index]));
 const alpha=(a:CompareFamily,b:CompareFamily)=>a.family.localeCompare(b.family,'en',{numeric:true})||a.provider.localeCompare(b.provider,'en')||a.source.localeCompare(b.source);
 const searchBoost=(group:CompareFamily)=>{
  if(!term)return 0;
  if(group.family.toLocaleLowerCase('en-US')===term||group.records.some(model=>model.name.toLocaleLowerCase('en-US')===term))return 3;
  if(group.family.toLocaleLowerCase('en-US').startsWith(term)||group.records.some(model=>model.name.toLocaleLowerCase('en-US').startsWith(term)))return 2;
  return 0;
 };
 const recommend=(a:CompareFamily,b:CompareFamily)=>{
  const boost=searchBoost(b)-searchBoost(a);if(boost)return boost;
  if(options.sort==='alpha')return alpha(a,b);
  const aPos=rank.has(a.key)?rank.get(a.key)!:Number.POSITIVE_INFINITY;
  const bPos=rank.has(b.key)?rank.get(b.key)!:Number.POSITIVE_INFINITY;
  if(aPos!==bPos)return aPos-bPos;
  // Fallback when browseOrder missing: live strength from whatever measurements are present, then alpha.
  const chart=options.chart??'task-cost',metric=options.metricId??'aa_intelligence_index';
  const aLive=familyRecommendRank(a.records,chart,metric),bLive=familyRecommendRank(b.records,chart,metric);
  if(aLive.tier!==bLive.tier)return bLive.tier-aLive.tier;
  if(aLive.strength!==bLive.strength)return bLive.strength-aLive.strength;
  return alpha(a,b);
 };
 return [...groups.values()].filter(group=>!term||[group.family,group.provider,group.source,...group.records.map(model=>model.name+' '+(model.reasoning??'')+' '+model.sourceModelId)].join(' ').toLocaleLowerCase('en-US').includes(term))
  .sort((a,b)=>Number(b.selectedIds.length>0)-Number(a.selectedIds.length>0)||recommend(a,b));
}

export function toggleCompareFamilySelection(selectedIds:string[],familyIds:string[],checked:boolean,limit=100):string[]{
 const members=new Set(familyIds);
 if(!checked)return selectedIds.filter(id=>!members.has(id));
 const additions=[...new Set(familyIds)].filter(id=>!selectedIds.includes(id));
 if(additions.length>Math.max(0,limit-selectedIds.length))return selectedIds;
 return [...selectedIds,...additions];
}

export function familySelectionState(group:CompareFamily):boolean|'mixed'{
 if(group.selectedIds.length===0)return false;
 return group.selectedIds.length>=group.records.length?true:'mixed';
}
