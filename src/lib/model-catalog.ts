import {EXPLORER_SOURCE_LABELS,type ExplorerModel} from './compare-series';
import {compareRecordHref} from './model-identity';
export function catalogCoverage(records:ExplorerModel[],unavailableSources:string[]=[]){
 const ids=new Set<string>();const counts=new Map<ExplorerModel['source'],number>();
 let historical=0,membershipUnverified=0;
 for(const model of records){if(ids.has(model.id))continue;ids.add(model.id);
 counts.set(model.source,(counts.get(model.source)??0)+1);if(model.current===false)historical++;if(model.source==='aa'&&model.current===null)membershipUnverified++;}
 return {records:ids.size,historical,membershipUnverified,complete:unavailableSources.length===0,unavailableSources,sources:Object.entries(EXPLORER_SOURCE_LABELS).map(([key,name])=>({key,name,count:unavailableSources.includes(name)?null:counts.get(key as ExplorerModel['source'])??0,available:!unavailableSources.includes(name)}))};
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
