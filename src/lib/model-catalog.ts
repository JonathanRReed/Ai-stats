import {EXPLORER_SOURCE_LABELS,type ExplorerModel} from './compare-series';
import {compareRecordHref} from './model-identity';
export function catalogCoverage(records:ExplorerModel[]){
 const ids=new Set<string>();const counts=new Map<ExplorerModel['source'],number>();
 let historical=0;
 for(const model of records){if(ids.has(model.id))continue;ids.add(model.id);
 counts.set(model.source,(counts.get(model.source)??0)+1);if(model.current===false)historical++;}
 return {records:ids.size,historical,sources:[...counts].map(([key,count])=>({key,name:EXPLORER_SOURCE_LABELS[key],count}))};
}
export function catalogIndex(records:ExplorerModel[],pages:Array<{id:string;name:string;provider:string;path:string;indexes:Array<{key:string;value:number|null}>}>){
 const pageById=new Map(pages.map(page=>[page.id,page]));
 return records.map(model=>{
 const page=pageById.get(model.id);
 return {n:model.name,p:(model.provider??'Unknown')+' · '+EXPLORER_SOURCE_LABELS[model.source],
 u:page?.path??compareRecordHref(model.id,model.source==='openrouter'||model.source==='litellm'?'price':undefined,model.current===false),
 i:model.intelligence??null,s:model.source,id:model.id};
 });
}
