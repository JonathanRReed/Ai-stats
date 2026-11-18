import type {CompareCustomAxis,ExplorerModel} from './compare-series';
import type {BlendWeights} from './compare-view-options';

const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
type Measure={key:keyof BlendWeights;label:string;read:(model:ExplorerModel)=>number|null|undefined};
export const BLEND_MEASURES:Measure[]=[
 {key:'intelligence',label:'Intelligence Index',read:model=>model.intelligence},
 {key:'coding',label:'Coding Index',read:model=>model.coding},
 {key:'speed',label:'Output speed',read:model=>model.outputSpeed},
];

/**
 * A visitor's own weighting. Each weighted measure is rescaled 0 to 100 across the records given
 * (lowest record 0, highest 100), then averaged by weight. A record missing any weighted measure
 * gets no value: nothing is assumed for it. The result is the visitor's, never an AI Stats score.
 */
export function blendAxis(models:readonly ExplorerModel[],weights:BlendWeights):CompareCustomAxis&{used:string[];missing:number}{
 const active=BLEND_MEASURES.filter(measure=>weights[measure.key]>0);
 const total=active.reduce((sum,measure)=>sum+weights[measure.key],0);
 const complete=models.filter(model=>active.every(measure=>finite(measure.read(model))));
 const ranges=new Map(active.map(measure=>{
  const values=complete.map(model=>measure.read(model) as number);
  return [measure.key,{low:Math.min(...values),high:Math.max(...values)}] as const;
 }));
 const values:Record<string,number>={};
 if(total>0)for(const model of complete){
  let score=0;
  for(const measure of active){
   const {low,high}=ranges.get(measure.key)!;
   // One record, or identical values, cannot be ranked against anything: it sits in the middle.
   const scaled=high===low?50:((measure.read(model) as number)-low)/(high-low)*100;
   score+=scaled*weights[measure.key]/total;
  }
  values[model.id]=Number(score.toFixed(2));
 }
 const used=active.map(measure=>`${Math.round(weights[measure.key]/total*100)}% ${measure.label}`);
 return {label:'Your blend ('+used.join(', ')+')',unit:'blend points',values,used,missing:models.length-complete.length};
}

export type ScoreRow={name:string;value:number;line:number};
export type ScoreCsv={rows:ScoreRow[];problems:string[]};
const splitCsvLine=(line:string):string[]=>{
 const cells:string[]=[];let cell='',quoted=false;
 for(let index=0;index<line.length;index++){
  const char=line[index];
  if(quoted){if(char==='"'&&line[index+1]==='"'){cell+='"';index++;}else if(char==='"')quoted=false;else cell+=char;}
  else if(char==='"')quoted=true;
  else if(char===','||char==='\t'||char===';'){cells.push(cell);cell='';}
  else cell+=char;
 }
 cells.push(cell);
 return cells.map(value=>value.trim());
};
/** Two columns: a model name or id, then a number. A header row is skipped; bad rows are reported, not guessed. */
export function parseScoreCsv(text:string,limit=2000):ScoreCsv{
 const rows:ScoreRow[]=[],problems:string[]=[];
 // A byte-order mark at the start of the file is not part of the first model name.
 const lines=(text.charCodeAt(0)===0xFEFF?text.slice(1):text).split(/\r?\n/);
 lines.slice(0,limit+1).forEach((raw,index)=>{
  if(!raw.trim())return;
  let cells=splitCsvLine(raw);
  // Names such as "Opus (Max, Default Fallback)" carry their own commas. Without quotes, the last
  // separator is the one that divides the name from the number.
  if(cells.length>2&&!raw.includes('"')){
   const cut=Math.max(raw.lastIndexOf(','),raw.lastIndexOf('\t'),raw.lastIndexOf(';'));
   cells=[raw.slice(0,cut).trim(),raw.slice(cut+1).trim()];
  }
  const value=Number((cells[1]??'').replace(/%$/,''));
  if(cells.length<2||!cells[0]||cells[1]===''||!Number.isFinite(value)){
   if(index>0||rows.length)problems.push(`Line ${index+1}: expected a model and a number.`);
   return;
  }
  rows.push({name:cells[0],value,line:index+1});
 });
 if(lines.length>limit+1)problems.push(`Only the first ${limit} lines were read.`);
 return {rows,problems};
}

const fold=(value:string)=>value.toLowerCase().replace(/\s+/g,' ').trim();
/**
 * Exact matches only (record id, source slug, or full recorded name, ignoring case and extra spaces).
 * A name shared by several records is ambiguous and stays unmatched rather than being assigned to one.
 */
export function matchScores(rows:readonly ScoreRow[],models:readonly ExplorerModel[],label='Your score'):CompareCustomAxis&{matched:number;unmatched:string[]}{
 const index=new Map<string,string[]>();
 const add=(key:string|undefined,id:string)=>{if(!key)return;const folded=fold(key);const ids=index.get(folded)??[];if(!ids.includes(id))ids.push(id);index.set(folded,ids);};
 for(const model of models){add(model.id,model.id);add(model.slug,model.id);add(model.name,model.id);}
 const values:Record<string,number>={},unmatched:string[]=[];
 for(const row of rows){
  const ids=index.get(fold(row.name));
  if(ids?.length===1)values[ids[0]]=row.value;else unmatched.push(row.name);
 }
 return {label,unit:'your units',values,matched:Object.keys(values).length,unmatched};
}
