import type {ExplorerModel} from './compare-series';

export type CompareFamily={
 key:string;source:ExplorerModel['source'];provider:string;family:string;records:ExplorerModel[];
 selectedIds:string[];suggested:boolean;
};

/** Prefer records that can produce points in the active chart, while retaining explicit choices. */
export function compareCatalogScope(models:ExplorerModel[],chart:string,metricId:string,selectedIds:string[],allCatalog=false):ExplorerModel[]{
 if(allCatalog)return models;
 const selected=new Set(selectedIds);
 const matches=(model:ExplorerModel)=>{
  if(chart==='benchmark')return metricId.startsWith('epoch_')?['epoch','publisher'].includes(model.source):model.source==='aa';
  if(chart==='price')return ['aa','openrouter','litellm'].includes(model.source)&&Boolean(model.hasTokenPrices||[model.priceInput,model.priceOutput].some(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0));
  if(['cost-intelligence','speed-intelligence','task-cost','total-cost'].includes(chart))return model.source==='aa';
  return true;
 };
 const scoped=models.filter(matches),ids=new Set(scoped.map(model=>model.id));
 return [...scoped,...models.filter(model=>selected.has(model.id)&&!ids.has(model.id))];
}

export function compareFamilyKey(model:Pick<ExplorerModel,'source'|'provider'|'family'>):string{
 return JSON.stringify([model.source,model.provider??model.family,model.family]);
}

export function groupCompareFamilies(models:ExplorerModel[],selectedIds:string[],query='',suggestedIds:string[]=[]):CompareFamily[]{
 const selected=new Set(selectedIds),suggested=new Set(suggestedIds),term=query.trim().toLocaleLowerCase('en-US');
 const groups=new Map<string,CompareFamily>();
 for(const model of models){
  const key=compareFamilyKey(model);let group=groups.get(key);
  if(!group){group={key,source:model.source,provider:model.provider??model.family,family:model.family,records:[],selectedIds:[],suggested:false};groups.set(key,group);}
  group.records.push(model);
  if(selected.has(model.id))group.selectedIds.push(model.id);
  if(suggested.has(model.id))group.suggested=true;
 }
 return [...groups.values()].filter(group=>!term||[group.family,group.provider,group.source,...group.records.map(model=>model.name+' '+(model.reasoning??'')+' '+model.sourceModelId)].join(' ').toLocaleLowerCase('en-US').includes(term))
  .sort((a,b)=>Number(b.selectedIds.length>0)-Number(a.selectedIds.length>0)||a.family.localeCompare(b.family,'en',{numeric:true})||a.provider.localeCompare(b.provider,'en')||a.source.localeCompare(b.source));
}

export function toggleCompareFamilySelection(selectedIds:string[],familyIds:string[],checked:boolean,limit=100):string[]{
 const members=new Set(familyIds);
 if(!checked)return selectedIds.filter(id=>!members.has(id));
 const additions=[...new Set(familyIds)].filter(id=>!selectedIds.includes(id));
 if(additions.length>Math.max(0,limit-selectedIds.length))return selectedIds;
 return [...selectedIds,...additions];
}

export function familySelectionState(group:CompareFamily):boolean|'mixed'{
 if(group.selectedIds.length===0)return false;
 return group.selectedIds.length>=group.records.length?true:'mixed';
}
