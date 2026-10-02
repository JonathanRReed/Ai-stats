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
export function buildExplorerCatalog(aaRows:unknown[],epochRows:unknown[],catalogs:Partial<Record<'openrouter'|'huggingface'|'litellm',unknown[]>>={},inventory:{models?:unknown[];aliases?:unknown[];sources?:unknown[]}={}):ExplorerModel[] {
  const models:ExplorerModel[]=[];
  for(const input of aaRows){
    const raw=record(input);const id=text(raw.id);if(!id)continue;
    const row=normalizeAaEvidence(raw as AaModel);
    const name=text(row.name)??text(row.slug)??id;
    const metadata=record(row.source_metadata);
    const version=metadata.intelligence_index_version;
    models.push({id,name,slug:text(row.slug)??undefined,...modelDisplayFacets(name),provider:text(row.creator_name)??'Unknown',
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
  for(const source of ['openrouter','huggingface','litellm'] as const){
    for(const input of catalogs[source]??[]){
      const row=record(input);const key=text(row.openrouter_id)??text(row.model_id)??text(row.id);if(!key)continue;
      const name=text(row.name)??key;
      const url=source==='openrouter'?'https://openrouter.ai/'+key.split('/').map(encodeURIComponent).join('/'):
        source==='huggingface'?'https://huggingface.co/'+key.split('/').map(encodeURIComponent).join('/'):'https://models.litellm.ai/';
      models.push({id:source+':'+key,name,family:name,provider:text(row.provider)??text(row.author_slug)??text(row.author)??key.split('/')[0],
        reasoning:'unknown',source,sourceModelId:key,current:true,sourceUrl:url,
        fetchedAt:text(row.fetched_at),observedAt:null,
        ...(source==='huggingface'?{}:{priceInput:number(source==='openrouter'?row.prompt_price_1m:row.input_price_1m),
          priceOutput:number(source==='openrouter'?row.completion_price_1m:row.output_price_1m)})});
    }
  }
  // Exact source-native aliases suppress duplicate inventory entries. Never join by name.
  const sourceKeys=new Map((inventory.sources??[]).map(input=>{const row=record(input);return [row.id,row.source_key];}));
  const nativeKeys=new Set(models.map(model=>JSON.stringify([model.source==='aa'?'artificial-analysis':model.source==='epoch'?'epoch-ai':model.source,model.sourceModelId])));
  // AA's registry keys are source slugs; chart selection still preserves each UUID.
  for(const model of models)if(model.source==='aa'&&model.slug)nativeKeys.add(JSON.stringify(['artificial-analysis',model.slug]));
  const represented=new Set((inventory.aliases??[]).filter(input=>{
    const row=record(input);return nativeKeys.has(JSON.stringify([sourceKeys.get(row.intelligence_source_id),row.source_model_key]));
  }).map(input=>record(input).canonical_model_id));
  for(const input of inventory.models??[]){
    const row=record(input);if(represented.has(row.id))continue;
    const key=text(row.canonical_key);if(!key)continue;
    const name=text(row.display_name)??key;
    models.push({id:'catalog:'+key,name,family:text(row.model_family)??name,provider:text(row.provider_name)??'Unknown',
      source:'catalog',sourceModelId:key,reasoning:'unknown',current:null});
  }
  return [...new Map(models.map(model=>[model.id,model])).values()];
}
export function defaultExplorerSelection(models:ExplorerModel[]):string[] {
  const selected:string[]=[];const providers=new Set<string>();
  const eligible=models.filter(model=>model.source==='aa'&&model.current===true&&
    typeof model.intelligence==='number'&&Number.isFinite(model.intelligence)&&
    typeof model.priceBlended==='number'&&Number.isFinite(model.priceBlended)&&model.priceBlended>=0);
  for(const model of eligible){
    const provider=model.provider??model.family;
    if(providers.has(provider))continue;
    providers.add(provider);selected.push(model.id);if(selected.length===6)break;
  }
  return selected;
}
