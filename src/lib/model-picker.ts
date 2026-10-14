import type {ExplorerModel} from './compare-series';

export const MODEL_PICKER_PAGE_SIZE=12;
export type ModelPickerPage={records:ExplorerModel[];total:number;page:number;pages:number};

/** Search stable catalog identity and paginate before rendering picker rows. */
export function modelPickerPage(models:ExplorerModel[],query:string,source:string,includeHistory:boolean,page=0,pageSize=MODEL_PICKER_PAGE_SIZE):ModelPickerPage{
 const terms=query.trim().toLocaleLowerCase('en-US').split(/\s+/).filter(Boolean);
 const matches=models.filter(model=>{
  if(source!=='all'&&model.source!==source)return false;
  if(!includeHistory&&model.current===false)return false;
  const identity=[model.name,model.id,model.family,model.provider??'',model.source,model.sourceModelId??''].join(' ').toLocaleLowerCase('en-US');
  return terms.every(term=>identity.includes(term));
 });
 if(terms.length)matches.sort((a,b)=>{
  const rank=(model:ExplorerModel)=>terms.length?Math.min(...terms.map(term=>{
   const name=model.name.toLocaleLowerCase('en-US');
   return name===term?0:name.startsWith(term)?1:name.includes(term)?2:3;
  })):0;
  return rank(a)-rank(b)||a.name.localeCompare(b.name,'en',{numeric:true})||a.source.localeCompare(b.source)||a.id.localeCompare(b.id);
 });
 const size=Number.isFinite(pageSize)?Math.max(1,Math.floor(pageSize)):MODEL_PICKER_PAGE_SIZE;
 const pages=Math.max(1,Math.ceil(matches.length/size));
 const safePage=Number.isFinite(page)?Math.min(Math.max(0,Math.floor(page)),pages-1):0;
 return {records:matches.slice(safePage*size,(safePage+1)*size),total:matches.length,page:safePage,pages};
}
