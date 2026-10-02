import {prepareSourceSnapshot} from './source-snapshots.mjs';
import {retryDelayMs} from './source-refresh-policy.mjs';
export const USAGE_SOURCE_URL='https://openrouter.ai/rankings';
export const USAGE_LICENSE_URL='https://creativecommons.org/licenses/by/4.0/';
const DAY=86400000;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:null;
const date=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Invalid usage date');
 const milliseconds=Date.parse(value+'T00:00:00.000Z');
 if(!Number.isFinite(milliseconds)||new Date(milliseconds).toISOString().slice(0,10)!==value)throw new Error('Invalid usage date');
 return value;
};
const timestamp=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value)||!Number.isFinite(Date.parse(value)))throw new Error('Invalid usage timestamp');
 return new Date(value).toISOString();
};
/** Only exact, unfiltered, completed UTC days are admitted in this adapter. */
export function normalizeUsageSnapshot(payload,{now=new Date().toISOString()}={}) {
 const meta=object(payload?.meta),clock=timestamp(now);
 if(!meta||meta.version!=='v1'||!Array.isArray(payload?.data)||!payload.data.length||payload.data.length>46665)throw new Error('Invalid usage dataset');
 const asOf=timestamp(meta.as_of),startDate=date(meta.start_date),endDate=date(meta.end_date);
 if(startDate<'2025-01-01'||startDate>endDate||endDate>=clock.slice(0,10)||endDate>=asOf.slice(0,10)||
 Date.parse(asOf)>Date.parse(clock)+300000)throw new Error('Usage window includes incomplete or invalid days');
 const span=(Date.parse(endDate)-Date.parse(startDate))/DAY+1;
 if(span>915)throw new Error('Usage window exceeds supported history');
 if((meta.period!==undefined&&meta.period!=='day')||(meta.estimated!==undefined&&meta.estimated!==false)||
 ['category','language_type','modality','context_bucket'].some(key=>meta[key]!=null)||
 (meta.filters!==undefined&&(!object(meta.filters)||Object.keys(meta.filters).length)))throw new Error('Only unfiltered exact daily usage is supported');
 const keys=new Set(),counts=new Map(),present=new Set();
 const rows=payload.data.map(value=>{
  const row=object(value);if(!row)throw new Error('Invalid usage row');
  const day=date(row.date),model=row.model_permaslug,tokens=row.total_tokens;
  if(day<startDate||day>endDate||typeof model!=='string'||!model.trim()||model.length>512||
   typeof tokens!=='string'||!/^(0|[1-9][0-9]{0,77})$/.test(tokens))throw new Error('Invalid usage row');
  const key=day+'|'+model;if(keys.has(key))throw new Error('Duplicate usage bucket');
  keys.add(key);present.add(day);counts.set(day,(counts.get(day)??0)+1);
  if(counts.get(day)>51)throw new Error('Too many usage rows for a day');
  return {date:day,modelPermaslug:model,totalTokens:tokens};
 }).sort((a,b)=>a.date.localeCompare(b.date)||a.modelPermaslug.localeCompare(b.modelPermaslug));
 const missingDays=[];
 for(let day=Date.parse(startDate);day<=Date.parse(endDate);day+=DAY){
  const value=new Date(day).toISOString().slice(0,10);if(!present.has(value))missingDays.push(value);
 }
 return {schemaVersion:1,asOf,startDate,endDate,period:'day',filters:{},estimated:false,rows,missingDays,
  sourceUrl:USAGE_SOURCE_URL,licenseUrl:USAGE_LICENSE_URL};
}
/** Server-only request. The caller owns scheduling, storage and lease admission. */
export async function fetchUsageSnapshot({apiKey,now:fixedNow,fetchImpl=(url,init)=>globalThis.fetch(url,init)}) {
 if(typeof apiKey!=='string'||!apiKey.trim())throw new Error('OpenRouter usage authentication is not configured');
 const clock=()=>fixedNow??new Date().toISOString();
 const today=timestamp(clock()).slice(0,10);
 const end=new Date(Date.parse(today)-DAY).toISOString().slice(0,10);
 const start=new Date(Math.max(Date.parse('2025-01-01'),Date.parse(end)-89*DAY)).toISOString().slice(0,10);
 const url=new URL('https://openrouter.ai/api/v1/datasets/rankings-daily');
 url.searchParams.set('period','day');url.searchParams.set('start_date',start);url.searchParams.set('end_date',end);
 let response;
 try {response=await fetchImpl(url,{headers:{Authorization:'Bearer '+apiKey,Accept:'application/json'},
  redirect:'error',signal:AbortSignal.timeout(30000)});}catch{throw new Error('OpenRouter usage request failed');}
 if(!response.ok){
  const error=new Error('OpenRouter usage request failed ('+response.status+')');
  const retryAt=Date.parse(clock())+retryDelayMs(response.headers.get('Retry-After'),0,Date.parse(clock()));
  Object.assign(error,{status:response.status,retryAt:Number.isFinite(retryAt)&&retryAt<=8640000000000000?new Date(retryAt).toISOString():'infinity'});
  throw error;
 }
 let payload;try{payload=await response.json();}catch{throw new Error('OpenRouter usage returned invalid JSON');}
 return normalizeUsageSnapshot(payload,{now:clock()});
}

/** @param {{apiKey:string,store:Record<string,Function>,now?:string,fetchImpl?:(input:string|URL|Request,init?:RequestInit)=>Promise<Response>}} options */
export async function prepareUsageRefresh({apiKey,store,now:fixedNow,fetchImpl}) {
 const sourceKey='openrouter-usage',clock=()=>fixedNow??new Date().toISOString();
 if(typeof apiKey!=='string'||!apiKey.trim())return {sourceKey,status:'blocked',reason:'authentication'};
 const lease=await store.claim(sourceKey);
 if(!lease.claimed)return {sourceKey,status:'skipped',reason:lease.reason};
 try{
  const snapshot=await fetchUsageSnapshot({apiKey,now:fixedNow,fetchImpl});
  return {sourceKey,status:'prepared',leaseId:lease.leaseId,input:{sourceKey,observedAt:snapshot.asOf,
   fetchedAt:clock(),records:[{id:'daily-usage',snapshot}]}};
 }catch(error){
  const value=error&&typeof error==='object'?error:{};
  const delay=retryDelayMs(null,lease.attempts??0,Date.parse(clock()));
  const notBefore=typeof value.retryAt==='string'?value.retryAt:new Date(Date.parse(clock())+delay).toISOString();
  await store.fail({sourceKey,leaseId:lease.leaseId,notBefore,message:'Official daily usage refresh failed; last good snapshot retained.'});
  return {sourceKey,status:'failed'};
 }
}

/** Accept one immutable, sanitized usage snapshot with a matching content receipt. */
export function parseUsageCache(row,{now=new Date().toISOString()}={}) {
 try {
  if(row?.source_key!=='openrouter-usage'||!row.payload||row.payload.schemaVersion!==1||
   row.payload.sourceKey!=='openrouter-usage'||row.record_count!==1||row.payload.records?.length!==1||
   row.payload.records[0].id!=='daily-usage'||!/^[1-9][0-9]*$/.test(String(row.snapshot_id)))return null;
  const fetchedAt=timestamp(row.fetched_at),publishedAt=timestamp(row.published_at),saved=row.payload.records[0].snapshot;
  const checked=prepareSourceSnapshot({sourceKey:'openrouter-usage',observedAt:row.payload.observedAt,fetchedAt,records:row.payload.records});
  if(checked.contentHash!==row.content_hash||!saved||saved.period!=='day'||saved.estimated!==false||!object(saved.filters))return null;
  const snapshot=normalizeUsageSnapshot({meta:{version:'v1',as_of:saved.asOf,start_date:saved.startDate,end_date:saved.endDate,
   period:saved.period,estimated:saved.estimated,filters:saved.filters},
   data:saved.rows.map(item=>({date:item.date,model_permaslug:item.modelPermaslug,total_tokens:item.totalTokens}))},{now});
  if(snapshot.asOf!==row.payload.observedAt)return null;
  const ageHours=Math.max(0,(Date.parse(now)-Date.parse(fetchedAt))/3600000);
  return {snapshot,receipt:{snapshotId:String(row.snapshot_id),contentHash:row.content_hash,fetchedAt,publishedAt,
   status:row.refresh_status==='failed'?'failed':ageHours>12?'stale':'healthy'}};
 }catch{return null;}
}
