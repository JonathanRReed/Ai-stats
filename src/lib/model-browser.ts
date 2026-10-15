import type {AaModel} from './supabase';
import {isCurrentMeasuredModel} from './model-spotlight';
import {compareOptionalMetricValues} from './metric-values';

export function selectBrowserModels(models:AaModel[],now=Date.now()):AaModel[]{
 return models.filter(model=>isCurrentMeasuredModel(model,now)).sort((a,b)=>
  compareOptionalMetricValues(a.aa_intelligence_index,b.aa_intelligence_index)||String(a.name).localeCompare(String(b.name)));
}
export function validateBrowserPayload(payload:unknown):Array<Record<string,unknown>>{
 const value=payload as {schemaVersion?:unknown;models?:unknown};
 if(!value||value.schemaVersion!=='ai-stats-model-browser.v1'||!Array.isArray(value.models))throw new Error('Invalid model browser snapshot');
 const ids=new Set<string>();
 for(const row of value.models){
  if(!row||typeof row!=='object'||typeof row.id!=='string'||!row.id||typeof row.name!=='string'||!row.name||ids.has(row.id))throw new Error('Invalid model browser record');
  ids.add(row.id);
 }
 return value.models;
}

const BROWSER_SORT_KEYS:Record<string,string>={intelligence:'aa_intelligence_index',mmlu:'mmlu_pro',gpqa:'gpqa',hle:'hle',aime:'aime',inputPrice:'price_1m_input_tokens',outputPrice:'price_1m_output_tokens',tps:'median_output_tokens_per_second'};
export function browserPage<T extends Record<string,unknown>>(models:T[],query:string,metric:string,direction:'asc'|'desc',limit:number){
 const needle=query.trim().toLowerCase(),key=BROWSER_SORT_KEYS[metric]??BROWSER_SORT_KEYS.intelligence;
 const matches=models.filter(model=>!needle||String(model.name??'').toLowerCase().includes(needle)||String(model.company_name??model.creator_name??'').toLowerCase().includes(needle));
 matches.sort((a,b)=>compareOptionalMetricValues(a[key],b[key],direction)||String(a.name).localeCompare(String(b.name)));
 return {total:matches.length,rows:matches.slice(0,Math.max(0,limit))};
}
