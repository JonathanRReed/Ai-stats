import type {ExplorerModel} from './compare-series';
import {epochScoreKey} from './compare-series';
import {compareFamilyKey} from './compare-families';
export type {FamilyBrowseSort} from './compare-families';
import {rankedBenchmarkModels,benchmarkConditionKey} from './benchmark-suggestions';
import type {EpochObservation} from './epoch-observations';
import {AA_METRIC_LABELS} from './compare-state';

/**
 * Release contract for family browse ranks. A live release without this exact
 * policy cannot replace a page that was rendered with it (see compare-release-client).
 */
export const BROWSE_RANK_POLICY='compare-browse-rank.v2';
/** key -> [AA index version cohort, base-36 catalog row indices joined by "."] */
export type BrowseRanks={policy:typeof BROWSE_RANK_POLICY;ranks:Record<string,[string,string]>};
export type BrowseRanking={keys:string[]|null;basis:string;rankedCount:number};

const SCATTER_CHARTS=['task-cost','cost-intelligence','speed-intelligence','total-cost'] as const;
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const verifiedVersion=(value:unknown):value is string=>typeof value==='string'&&/^\d+(?:\.\d+)*$/.test(value);
const CHART_BASIS:Record<string,string>={
 'task-cost':'AA Intelligence Index, among current records with an AA task cost',
 'cost-intelligence':'AA Intelligence Index, among current records with a blended token price',
 'speed-intelligence':'AA Intelligence Index, among current records with a measured output speed',
 'total-cost':'AA Intelligence Index, among current records with an AA total evaluation cost',
 price:'AA Intelligence Index, among current AA records with token prices',
};
export const browseRankKey=(chart:string,metricId:string)=>chart==='benchmark'?'benchmark:'+metricId:chart;

/** Value used to rank one record for a key; null when the record has no comparable measurement. All AA values are higher-is-better. */
function rankValue(model:ExplorerModel,key:string):number|null{
 if(model.source!=='aa'||model.current!==true||!verifiedVersion(model.indexVersion))return null;
 if(key.startsWith('benchmark:')){
  const metric=key.slice(10);
  const value=metric==='aa_intelligence_index'?model.intelligence:metric==='aa_coding_index'?model.coding:model.metrics?.[metric];
  return finite(value)?value:null;
 }
 if(!finite(model.intelligence))return null;
 if(key==='price')return [model.priceInput,model.priceOutput].some(value=>finite(value)&&value>=0)?model.intelligence:null;
 const x=key==='task-cost'?model.aaTaskCost:key==='total-cost'?model.aaEvaluationCost:key==='cost-intelligence'?model.priceBlended:key==='speed-intelligence'?model.outputSpeed:undefined;
 return finite(x)&&x>=0?model.intelligence:null;
}

const encode=(indices:number[])=>indices.map(index=>index.toString(36)).join('.');
export function decodeRankIndices(value:string):number[]{
 if(value==='')return [];
 if(!/^[0-9a-z]+(?:\.[0-9a-z]+)*$/.test(value))throw new Error('Invalid browse rank encoding');
 return value.split('.').map(part=>parseInt(part,36));
}

/**
 * Server-side, measurement-complete ranks. Each key ranks families by their best current
 * measured value inside ONE AA index-version cohort (the best-covered one), so scores from
 * different index versions are never ordered against each other. Families without a
 * comparable measurement are omitted (the client lists them alphabetically after).
 */
export function buildBrowseRanks(models:ExplorerModel[]):BrowseRanks{
 // Same identity the client derives from the expanded compact catalog (provider defaults to "Unknown").
 const identity=(model:ExplorerModel)=>compareFamilyKey({...model,provider:model.provider??'Unknown'});
 const firstRow=new Map<string,number>();
 models.forEach((model,index)=>{const key=identity(model);if(!firstRow.has(key))firstRow.set(key,index);});
 const keys=[...SCATTER_CHARTS,'price',...Object.keys(AA_METRIC_LABELS).map(metric=>'benchmark:'+metric)];
 const ranks:Record<string,[string,string]>={};
 for(const key of keys){
  const byVersion=new Map<string,Map<string,number>>();
  for(const model of models){
   const value=rankValue(model,key);if(value===null)continue;
   const cohort=byVersion.get(model.indexVersion!)??new Map<string,number>();
   const family=identity(model);
   cohort.set(family,Math.max(cohort.get(family)??Number.NEGATIVE_INFINITY,value));
   byVersion.set(model.indexVersion!,cohort);
  }
  const best=[...byVersion].sort(([a,left],[b,right])=>right.size-left.size||b.localeCompare(a,'en',{numeric:true}))[0];
  if(!best)continue;
  const [version,families]=best;
  const ordered=[...families].sort(([a,left],[b,right])=>right-left||firstRow.get(a)!-firstRow.get(b)!).map(([family])=>firstRow.get(family)!);
  ranks[key]=[version,encode(ordered)];
 }
 return {policy:BROWSE_RANK_POLICY,ranks};
}

/** Strict contract check: known keys, verified cohort, unique in-range family representatives. */
export function validateBrowseRanks(value:unknown,catalog:Pick<ExplorerModel,'source'|'provider'|'family'>[]):BrowseRanks{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid browse ranks');
 const data=value as Record<string,unknown>;
 if(data.policy!==BROWSE_RANK_POLICY||!data.ranks||typeof data.ranks!=='object'||Array.isArray(data.ranks))throw new Error('Invalid browse rank policy');
 const allowed=new Set([...SCATTER_CHARTS,'price',...Object.keys(AA_METRIC_LABELS).map(metric=>'benchmark:'+metric)]);
 const firstRow=new Map<string,number>();
 catalog.forEach((model,index)=>{const key=compareFamilyKey(model);if(!firstRow.has(key))firstRow.set(key,index);});
 for(const [key,entry] of Object.entries(data.ranks as Record<string,unknown>)){
  if(!allowed.has(key)||!Array.isArray(entry)||entry.length!==2||!verifiedVersion(entry[0])||typeof entry[1]!=='string')throw new Error('Invalid browse rank entry');
  const indices=decodeRankIndices(entry[1]),seen=new Set<number>();
  for(const index of indices){
   if(!Number.isInteger(index)||index<0||index>=catalog.length||seen.has(index)||firstRow.get(compareFamilyKey(catalog[index]))!==index)throw new Error('Invalid browse rank identity');
   seen.add(index);
  }
 }
 return value as BrowseRanks;
}

export const hasBrowseRankContract=(catalog:{browseRanks?:unknown})=>Boolean(catalog.browseRanks&&typeof catalog.browseRanks==='object'&&(catalog.browseRanks as BrowseRanks).policy===BROWSE_RANK_POLICY);

type RankingInput={models:ExplorerModel[];ranks?:BrowseRanks|null;chart:string;metricId:string;
 observations?:EpochObservation[]|null;scoreMetricKey?:string|null;conditionKey?:string|null;benchmarkName?:string};
const familyKeysFor=(models:ExplorerModel[],ids:string[])=>{const byId=new Map(models.map(model=>[model.id,model]));return [...new Set(ids.map(id=>byId.get(id)).filter((model):model is ExplorerModel=>Boolean(model)).map(compareFamilyKey))];};

/** Resolve the recommended family order for the active view, or an honest reason it is unavailable. */
export function browseRankingFor(input:RankingInput):BrowseRanking{
 const {models,chart,metricId}=input;
 const alphabetical=(reason:string):BrowseRanking=>({keys:null,basis:reason+' Families are listed alphabetically.',rankedCount:0});
 if(chart==='benchmark'&&metricId.startsWith('epoch_')){
  const slug=metricId.slice(6),name=input.benchmarkName??slug;
  if(!input.observations)return alphabetical(`A ${name} ranking appears when its results load.`);
  const scored=input.observations.filter(row=>row.benchmarkSlug===slug&&finite(row.value));
  const scoreKeys=[...new Set(scored.map(epochScoreKey))];
  const scoreKey=input.scoreMetricKey??(scoreKeys.length===1?scoreKeys[0]:null);
  if(!scoreKey)return alphabetical(scoreKeys.length?`${name} records use different score metrics; choose one to rank like-for-like.`:`${name} has no measured scores to rank.`);
  const byScore=scored.filter(row=>epochScoreKey(row)===scoreKey);
  const conditionKeys=[...new Set(byScore.map(benchmarkConditionKey))];
  const conditionKey=input.conditionKey??(conditionKeys.length===1?conditionKeys[0]:null);
  if(!conditionKey)return alphabetical(byScore.length?`${name} runs use different test settings; choose conditions to rank like-for-like.`:`${name} has no measured scores for this metric.`);
  const rows=byScore.filter(row=>benchmarkConditionKey(row)===conditionKey);
  const higherIsBetter=slug!=='btf3_external';
  const catalog=models.filter(model=>model.source==='epoch'||model.source==='publisher');
  const keys=familyKeysFor(models,rankedBenchmarkModels(catalog,rows,catalog.length,higherIsBetter));
  if(!keys.length)return alphabetical(`No current records have ${name} scores for these settings.`);
  const metricLabel=(JSON.parse(scoreKey) as string[]).join(' · ');
  return {keys,rankedCount:keys.length,basis:`Ranked by ${name} (${metricLabel}; ${higherIsBetter?'higher':'lower'} is better) for the selected test settings, current records only. Other families follow alphabetically.`};
 }
 const key=browseRankKey(chart,metricId),entry=input.ranks?.policy===BROWSE_RANK_POLICY?input.ranks.ranks[key]:undefined;
 const label=chart==='benchmark'?(AA_METRIC_LABELS[metricId]?`AA ${AA_METRIC_LABELS[metricId]}`:null):CHART_BASIS[chart]??null;
 if(!label)return alphabetical('No measured ranking exists for this view.');
 if(!input.ranks||input.ranks.policy!==BROWSE_RANK_POLICY)return alphabetical('Ranking metadata is unavailable for this data release.');
 if(!entry)return alphabetical(`No current records have comparable ${label.split(',')[0]} measurements.`);
 const indices=decodeRankIndices(entry[1]);
 const keys=[...new Set(indices.map(index=>models[index]).filter((model):model is ExplorerModel=>Boolean(model)).map(compareFamilyKey))];
 return {keys,rankedCount:keys.length,basis:`Ranked by ${label} (index version ${entry[0]}; higher is better). Other families follow alphabetically.`};
}
