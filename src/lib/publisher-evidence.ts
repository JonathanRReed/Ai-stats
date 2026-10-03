import {readFile} from 'node:fs/promises';
import path from 'node:path';
import type {ExplorerModel} from './compare-series';
import type {EpochBenchmark,EpochBenchmarkRun} from './supabase';

export const PUBLISHER_NAMES:Record<string,string>={livebench:'LiveBench',weirdml:'WeirdML',posttrainbench:'PostTrainBench','terminal-bench':'Terminal-Bench'};
export type PublisherRecord={systemId:string;modelId:string;label:string;provider?:string;benchmarkSlug:string;benchmarkVersion:string;metric:string;unit:'percent'|'fraction'|'points';score:number;higherIsBetter:boolean;conditions:Record<string,unknown>;evaluatedAt:string|null;sourceUrl:string};
export type PublisherSnapshot={schemaVersion:1;sourceKey:string;fetchedAt:string;observedAt:string|null;benchmarkVersion:string;sourceUrl:string;refreshMode?:string;records:PublisherRecord[]};
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<4096;
const date=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const url=(value:unknown)=>{if(!text(value))return false;try{const parsed=new URL(value);return parsed.protocol==='https:'&&!parsed.username&&!parsed.password;}catch{return false;}};
export function validatePublisherSnapshot(value:unknown,sourceKey:string):PublisherSnapshot{
 if(!object(value)||!Object.hasOwn(PUBLISHER_NAMES,sourceKey)||value.schemaVersion!==1||value.sourceKey!==sourceKey||
 !date(value.fetchedAt)||!(value.observedAt===null||date(value.observedAt))||!text(value.benchmarkVersion)||!url(value.sourceUrl)||
 !Array.isArray(value.records)||!value.records.length||value.records.length>5000)throw new Error('Invalid publisher snapshot');
 const ids=new Set<string>();
 for(const row of value.records){
  if(!object(row)||!text(row.systemId)||ids.has(row.systemId)||!text(row.modelId)||!text(row.label)||!text(row.benchmarkSlug)||
  row.benchmarkVersion!==value.benchmarkVersion||!text(row.metric)||!['percent','fraction','points'].includes(row.unit as string)||
  typeof row.score!=='number'||!Number.isFinite(row.score)||row.score<0||(row.unit==='fraction'?row.score>1:row.score>100)||
  typeof row.higherIsBetter!=='boolean'||!object(row.conditions)||!(row.evaluatedAt===null||date(row.evaluatedAt))||!url(row.sourceUrl))throw new Error('Invalid publisher observation');
  ids.add(row.systemId);
 }
 return value as PublisherSnapshot;
}
export function adaptPublisherEvidence(input:PublisherSnapshot[]){
 const models:ExplorerModel[]=[],benchmarks:EpochBenchmark[]=[],runs:EpochBenchmarkRun[]=[];
 for(const raw of input){
  const snapshot=validatePublisherSnapshot(raw,raw.sourceKey),sourceName=PUBLISHER_NAMES[snapshot.sourceKey];
  const slug='publisher_'+snapshot.sourceKey.replaceAll('-','_')+'_'+snapshot.benchmarkVersion.replace(/[^a-zA-Z0-9]+/g,'_').toLowerCase();
  benchmarks.push({id:slug,slug,name:sourceName+' '+snapshot.benchmarkVersion,description:null,source:sourceName,
   metadata:{source_key:snapshot.sourceKey,source_url:snapshot.sourceUrl,version:snapshot.benchmarkVersion,collection_method:snapshot.refreshMode??'automatic'}});
  for(const row of snapshot.records){
   const conditions=Object.fromEntries(Object.entries(row.conditions).filter(([,value])=>typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))) as Record<string,string|number|boolean>;
   const effort=typeof conditions.reasoningEffort==='string'?conditions.reasoningEffort:null;
   const details=[typeof conditions.agent==='string'?conditions.agent:null,effort&&!row.label.toLowerCase().includes(effort.toLowerCase())?effort:null].filter(Boolean).join(' · ');
   models.push({id:'publisher:'+row.systemId,source:'publisher',sourceModelId:row.systemId,name:row.label+(details?' · '+details:''),family:row.label,
    provider:row.provider??(row.modelId.includes('/')?row.modelId.split('/')[0]:'Unknown'),reasoning:effort??'unknown',current:true,
    observedAt:row.evaluatedAt,fetchedAt:snapshot.fetchedAt,sourceUrl:row.sourceUrl});
   runs.push({id:row.systemId,model_version:row.systemId,benchmark_id:slug,benchmark_slug:slug,benchmark_name:sourceName+' '+snapshot.benchmarkVersion,
    benchmark_version:snapshot.benchmarkVersion,score:row.score,score_metric:row.metric,score_unit:row.unit==='points'?'native':row.unit,
    conditions:Object.keys(conditions).length?conditions:null,evaluation_date:row.evaluatedAt,release_date:null,organization:row.provider??null,country:null,stderr:null,
    source_name:sourceName,source_link:row.sourceUrl,source_key:snapshot.sourceKey,source_fetched_at:snapshot.fetchedAt,higher_is_better:row.higherIsBetter});
  }
 }
 return {models,benchmarks,runs,snapshots:input};
}
let cached:ReturnType<typeof load>|undefined;
async function load(){
 const snapshots:PublisherSnapshot[]=[];
 for(const source of Object.keys(PUBLISHER_NAMES)){
  try{snapshots.push(validatePublisherSnapshot(JSON.parse(await readFile(path.join(process.cwd(),'public/data/publisher-benchmarks',source+'.json'),'utf8')),source));}
  catch(error){if(!(error&&typeof error==='object'&&'code' in error&&error.code==='ENOENT'))console.warn('Publisher snapshot unavailable:',source);}
 }
 return adaptPublisherEvidence(snapshots);
}
export const getPublisherEvidence=()=>cached??=load().catch(error=>{cached=undefined;throw error;});
