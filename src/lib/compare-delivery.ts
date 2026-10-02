import type {ExplorerModel} from './compare-series';
import type {CompareChart} from './compare-state';
import type {ComparePreset} from './compare-presets';
const SOURCES:ExplorerModel['source'][]=['aa','epoch','openrouter','huggingface','litellm','catalog'];
type CompactRow=[string,string,number,number,boolean|null,string|null,string|null,string|null,string|null,number];
export type CompactCatalog={providers:string[];rows:CompactRow[]};
export type CompareDelivery={assetBase?:string;benchmarkBase?:string;catalog:CompactCatalog;revision:string;presets:ComparePreset[];charts:Array<{id:CompareChart;label:string}>;aaMetrics:Array<[string,string]>};
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const metricKeys=['intelligence','coding','priceInput','priceOutput','priceBlended','outputSpeed','latency','aaTaskCost','aaEvaluationCost'] as const;
export function compactCatalog(models:ExplorerModel[]):CompactCatalog{
 const providers=[...new Set(models.map(model=>model.provider??'Unknown'))];
 return {providers,rows:models.map(model=>{
 const native=model.source==='aa'?model.id:model.id.slice(model.source.length+1);
 const prices=finite(model.priceInput)||finite(model.priceOutput);
 const detail=metricKeys.some(key=>finite(model[key]))||Object.values(model.metrics??{}).some(finite);
 return [model.id,model.name,providers.indexOf(model.provider??'Unknown'),SOURCES.indexOf(model.source),model.current,
 model.family===model.name?null:model.family,model.reasoning&&model.reasoning!=='unknown'?model.reasoning:null,model.slug??null,
 native===model.sourceModelId?null:model.sourceModelId,(prices?1:0)|(detail?2:0)];})};
}
export function expandCatalog(catalog:CompactCatalog):ExplorerModel[]{
 return catalog.rows.map(([id,name,provider,sourceIndex,current,family,reasoning,slug,native,flags])=>{
 const source=SOURCES[sourceIndex];return {id,name,provider:catalog.providers[provider],source,current,family:family??name,reasoning:reasoning??'unknown',
 ...(slug?{slug}:{}),sourceModelId:native??(source==='aa'?id:id.slice(source.length+1)),hasTokenPrices:Boolean(flags&1),detailAvailable:Boolean(flags&2)};});
}
export function measurementBucket(id:string):string{
 let hash=2166136261;for(let i=0;i<id.length;i++){hash^=id.charCodeAt(i);hash=Math.imul(hash,16777619);}
 return ((hash>>>0)%64).toString(16).padStart(2,'0');
}
export function validateMeasurementChunk(payload:unknown,revision:string,bucket:string,catalog:ExplorerModel[]):ExplorerModel[]{
 if(!payload||typeof payload!=='object')throw new Error('Invalid measurement response');
 const data=payload as Record<string,unknown>;
 if(data.schemaVersion!==1||data.revision!==revision||data.bucket!==bucket||!Array.isArray(data.records))throw new Error('Measurement snapshot changed');
 const expected=new Map(catalog.filter(model=>measurementBucket(model.id)===bucket).map(model=>[model.id,model]));
 const seen=new Set<string>();
 for(const value of data.records){
 if(!value||typeof value!=='object')throw new Error('Invalid measurement record');
 const row=value as ExplorerModel,known=expected.get(row.id);
 if(!known||seen.has(row.id)||row.source!==known.source||row.sourceModelId!==known.sourceModelId||row.current!==known.current||row.name!==known.name)throw new Error('Measurement identity mismatch');
 if(row.family!==known.family||(row.provider??'Unknown')!==known.provider||(row.reasoning??'unknown')!==known.reasoning||row.slug!==known.slug)throw new Error('Measurement display mismatch');
 if(['indexVersion','performancePrompt','observedAt','fetchedAt','sourceUrl'].some(key=>{
 const value=(row as unknown as Record<string,unknown>)[key];return value!==null&&value!==undefined&&typeof value!=='string';
 }))throw new Error('Invalid measurement metadata');
 if(['inputModalities','outputModalities'].some(key=>{const value=(row as unknown as Record<string,unknown>)[key];
 return value!==undefined&&(!Array.isArray(value)||value.some(item=>typeof item!=='string'));}))throw new Error('Invalid modality metadata');
 if(metricKeys.some(key=>row[key]!==null&&row[key]!==undefined&&!finite(row[key])))throw new Error('Invalid measurement value');
 if(row.metrics!==null&&row.metrics!==undefined&&(typeof row.metrics!=='object'||Array.isArray(row.metrics)||Object.values(row.metrics).some(value=>value!==null&&!finite(value))))throw new Error('Invalid benchmark value');
 seen.add(row.id);
 }
 if(seen.size!==expected.size)throw new Error('Incomplete measurement chunk');
 return data.records as ExplorerModel[];
}

/** Same-origin immutable files only. Pending calls coalesce; failures are evicted for explicit retry. */
export function createMeasurementLoader(revision:string,catalog:ExplorerModel[],fetchImpl:(url:string)=>Promise<Response>=fetch,assetBase?:string){
 if(assetBase&&!/^\/api\/releases\/[a-f0-9]{64}\/measurements$/.test(assetBase))throw new Error('Invalid measurement base');
 const known=new Set(catalog.map(model=>model.id)),cache=new Map<string,Promise<ExplorerModel[]>>();
 let active=0;const waiting:Array<()=>void>=[];
 const read=async(bucket:string)=>{
 if(active>=4)await new Promise<void>(resolve=>waiting.push(resolve));else active++;
 try{
 const response=await fetchImpl((assetBase??('/api/compare-measurements/'+encodeURIComponent(revision)))+'/'+bucket+'.json');
 if(!response.ok)throw new Error('Measurements unavailable');
 return validateMeasurementChunk(await response.json(),revision,bucket,catalog);
 }finally{const next=waiting.shift();if(next)next();else active--;}
 };
 const chunk=(bucket:string)=>{
 let pending=cache.get(bucket);if(!pending){pending=read(bucket).catch(error=>{cache.delete(bucket);throw error;});cache.set(bucket,pending);}return pending;
 };
 const loadPartial=async(ids:string[])=>{
 const selected=new Set(ids.filter(id=>known.has(id)));
 const buckets=[...new Set([...selected].map(measurementBucket))];
 const results=await Promise.allSettled(buckets.map(chunk));
 const records:ExplorerModel[]=[],failedBuckets=new Set<string>();
 results.forEach((result,index)=>{if(result.status==='fulfilled')records.push(...result.value);else failedBuckets.add(buckets[index]);});
 return {records,failedIds:[...selected].filter(id=>failedBuckets.has(measurementBucket(id)))};
 };
 return {loadPartial,load:async(ids:string[])=>{const result=await loadPartial(ids);if(result.failedIds.length)throw new Error('Measurements unavailable');return result.records.filter(model=>ids.includes(model.id));}};

}
