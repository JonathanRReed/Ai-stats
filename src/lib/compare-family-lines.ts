import {compareFamilyKey} from './compare-families';
import type {ExplorerModel} from './compare-series';

type CatalogRecord=Pick<ExplorerModel,'id'|'source'|'provider'|'family'|'current'|'reasoning'|'detailAvailable'>;

const REASONING_ORDER=['none','minimal','low','medium','high','xhigh','max'];
/** Reasoning levels in ascending effort; unrecorded levels sort last. */
export const reasoningRank=(reasoning:string|undefined)=>{
 const index=REASONING_ORDER.indexOf(reasoning??'unknown');
 return index<0?REASONING_ORDER.length:index;
};

const REASONING_LABELS:Record<string,string>={none:'None',minimal:'Minimal',low:'Low',medium:'Medium',high:'High',xhigh:'Extra high',max:'Max',unknown:'Not recorded'};
/** One spelling of each reasoning level for every page: sources write it "xhigh", "Xhigh" and "X-High". */
export const reasoningLabel=(reasoning:string|undefined):string=>REASONING_LABELS[reasoning??'unknown']??(reasoning??'Not recorded');

/**
 * Automatic scatter selections start from the Pareto frontier. A frontier point alone hides how the
 * rest of that model's reasoning levels trade cost for score, so the default view adds every current
 * sibling record of each frontier family. Frontier records always survive the selection limit.
 */
export function expandSelectionToFamilies(catalog:readonly CatalogRecord[],ids:readonly string[],limit=100):string[]{
 const byId=new Map(catalog.map(model=>[model.id,model]));
 const chosen=new Set(ids.filter(id=>byId.has(id)).slice(0,limit));
 const result=[...chosen];
 const families=new Map<string,CatalogRecord[]>();
 for(const model of catalog){
  if(model.source!=='aa'||model.current!==true||model.detailAvailable===false)continue;
  const key=compareFamilyKey(model);const group=families.get(key)??[];group.push(model);families.set(key,group);
 }
 const seenFamilies=new Set<string>();
 for(const id of ids){
  const model=byId.get(id);if(!model||!chosen.has(id))continue;
  const key=compareFamilyKey(model);if(seenFamilies.has(key))continue;seenFamilies.add(key);
  const siblings=(families.get(key)??[]).filter(sibling=>!chosen.has(sibling.id))
   .sort((a,b)=>reasoningRank(a.reasoning)-reasoningRank(b.reasoning)||a.id.localeCompare(b.id));
  // A family joins whole or not at all, so a line is never cut off by the limit.
  if(result.length+siblings.length>limit)continue;
  for(const sibling of siblings){chosen.add(sibling.id);result.push(sibling.id);}
 }
 return result;
}
