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
