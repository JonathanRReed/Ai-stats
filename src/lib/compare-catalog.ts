import type {ExplorerModel} from './compare-series';
import {normalizeAaEvidence,AA_EVALUATION_KEYS} from './aa-evidence';
import type {AaModel} from './supabase';
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const text=(value:unknown):string|null=>typeof value==='string'&&value.trim()?value.trim():null;
const number=(value:unknown):number|null=>{
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value==='string'&&value.trim()&&/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())){
    const parsed=Number(value);return Number.isFinite(parsed)?parsed:null;
  }
  return null;
};
/** Display facets preserve the recorded name. They never establish an evaluation-condition join. */
export function modelDisplayFacets(name:string):{family:string;reasoning:string} {
  const suffix=name.match(/\(([^)]*)\)\s*$/)?.[1]??'';
  const qualifier=/\b(reasoning|xhigh|high|medium|low|max)\b/i.test(suffix);
  const effort=suffix.match(/\b(xhigh|high|medium|low|max)\b/i)?.[1]?.toLowerCase();
  return {family:qualifier?name.replace(/\s*\([^)]*\)\s*$/,'').trim():name,
    reasoning:/non-reasoning/i.test(suffix)?'none':effort??'unknown'};
}
export function buildExplorerCatalog(aaRows:unknown[],epochRows:unknown[]):ExplorerModel[] {
  const models:ExplorerModel[]=[];
  for(const input of aaRows){
    const raw=record(input);const id=text(raw.id);if(!id)continue;
    const row=normalizeAaEvidence(raw as AaModel);
    const name=text(row.name)??text(row.slug)??id;
    const metadata=record(row.source_metadata);
    const version=metadata.intelligence_index_version;
    models.push({id,name,...modelDisplayFacets(name),provider:text(row.creator_name)??'Unknown',
      source:'aa',sourceModelId:id,current:typeof row.current_source_member==='boolean'?row.current_source_member:null,
      intelligence:number(row.aa_intelligence_index),coding:number(row.aa_coding_index),
      priceInput:number(row.price_1m_input_tokens),priceOutput:number(row.price_1m_output_tokens),
      priceBlended:number(row.price_1m_blended_3_to_1),outputSpeed:number(row.median_output_tokens_per_second),
      latency:number(row.median_time_to_first_answer_token),indexVersion:typeof version==='string'||typeof version==='number'?String(version):null,
      performancePrompt:text(metadata.performance_prompt),observedAt:text(row.last_seen),
      sourceUrl:row.slug?'https://artificialanalysis.ai/models/'+encodeURIComponent(row.slug):'https://artificialanalysis.ai/',
      metrics:Object.fromEntries(Object.keys(AA_EVALUATION_KEYS).map(key=>[key,number(record(row)[key])])),
    });
  }
  for(const input of epochRows){
    const row=record(input);const version=text(row.model_version);if(!version)continue;
    const name=text(row.display_name)??text(row.model_name)??version;
    models.push({id:'epoch:'+version,name,family:name,provider:text(row.organization)??'Unknown',
      reasoning:'unknown',source:'epoch',sourceModelId:version,current:true,
      sourceUrl:'https://epoch.ai/benchmarks',observedAt:null});
  }
  return models;
}
export function defaultExplorerSelection(models:ExplorerModel[]):string[] {
  const selected:string[]=[];const providers=new Set<string>();
  const eligible=models.filter(model=>model.source==='aa'&&model.current!==false&&
    typeof model.intelligence==='number'&&Number.isFinite(model.intelligence)&&
    typeof model.priceBlended==='number'&&Number.isFinite(model.priceBlended)&&model.priceBlended>=0);
  for(const model of eligible){
    const provider=model.provider??model.family;
    if(providers.has(provider))continue;
    providers.add(provider);selected.push(model.id);if(selected.length===6)break;
  }
  return selected;
}
