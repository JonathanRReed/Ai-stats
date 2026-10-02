import type {EpochObservation} from './epoch-observations';
const plain=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown)=>typeof value==='string'&&value.length>0;
const nullableText=(value:unknown)=>value===null||typeof value==='string';
const date=(value:unknown)=>value===null||typeof value==='string'&&Number.isFinite(Date.parse(value));
const url=(value:unknown)=>{if(value===null)return true;if(typeof value!=='string')return false;try{const parsed=new URL(value);return ['https:','http:'].includes(parsed.protocol)&&!parsed.username&&!parsed.password;}catch{return false;}};
export function validateBenchmarkAsset(payload:unknown,slug:string):EpochObservation[]{
 if(!plain(payload)||payload.schemaVersion!==1||payload.slug!==slug||!text(payload.name)||!date(payload.fetchedAt)||!Array.isArray(payload.observations)||!payload.observations.length)throw new Error('Invalid benchmark asset');
 const ids=new Set<string>();
 for(const row of payload.observations){
 if(!plain(row)||!text(row.id)||ids.has(row.id as string)||!text(row.modelVersion)||row.benchmarkSlug!==slug||
 !nullableText(row.metricKey)||!['native','percent','fraction'].includes(row.unit as string)||
 !(row.value===null||typeof row.value==='number'&&Number.isFinite(row.value))||
 !(row.conditions===null||plain(row.conditions)&&Object.entries(row.conditions).every(([key,value])=>key.length>0&&(typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))))||
 !date(row.evaluationDate)||!url(row.sourceUrl)||!date(row.fetchedAt)||row.fetchedAt!==payload.fetchedAt||!nullableText(row.snapshotId))throw new Error('Invalid benchmark observation');
 ids.add(row.id as string);
 }
 return payload.observations as EpochObservation[];
}
