export type UsageRow={date:string;modelPermaslug:string;totalTokens:string};
export type UsageSnapshot={schemaVersion:number;asOf:string;startDate:string;endDate:string;period:string;
 filters:Record<string,unknown>;estimated:boolean;rows:UsageRow[];missingDays:string[];sourceUrl:string;licenseUrl:string};
export type UsagePart={key:string;tokens:string|null;value:number|null};
export type UsageDay={date:string;available:boolean;totalTokens:string|null;parts:UsagePart[]};
const DAY=86400000;
const share=(tokens:bigint,total:bigint)=>total===0n?null:Number(tokens*100000000n/total)/1000000;
export function usageModels(snapshot:UsageSnapshot){
 const totals=new Map<string,bigint>();
 for(const row of snapshot.rows)if(row.modelPermaslug!=='other')totals.set(row.modelPermaslug,(totals.get(row.modelPermaslug)??0n)+BigInt(row.totalTokens));
 return [...totals].sort((a,b)=>a[1]===b[1]?a[0].localeCompare(b[0]):a[1]>b[1]?-1:1).map(([key])=>key);
}
export function buildUsageSeries(snapshot:UsageSnapshot,windowDays:number,selectedModels:string[],mode:string){
 if(![7,30,90].includes(windowDays)||!['share','volume'].includes(mode))throw new Error('Unsupported usage view');
 const end=Date.parse(snapshot.endDate+'T00:00:00Z');
 const start=Math.max(Date.parse(snapshot.startDate+'T00:00:00Z'),end-(windowDays-1)*DAY);
 if(!Number.isFinite(start)||!Number.isFinite(end)||start>end)throw new Error('Invalid usage window');
 const known=new Set(usageModels(snapshot));
 const selected=[...new Set(selectedModels)].filter(key=>known.has(key)).slice(0,8);
 const byDay=new Map<string,Map<string,bigint>>();
 for(const row of snapshot.rows){
  const day=byDay.get(row.date)??new Map<string,bigint>();
  if(day.has(row.modelPermaslug))throw new Error('Duplicate usage bucket');
  day.set(row.modelPermaslug,BigInt(row.totalTokens));byDay.set(row.date,day);
 }
 const days:UsageDay[]=[];
 for(let value=start;value<=end;value+=DAY){
  const date=new Date(value).toISOString().slice(0,10),rows=byDay.get(date);
  if(!rows){days.push({date,available:false,totalTokens:null,parts:[]});continue;}
  const total=[...rows.values()].reduce((sum,tokens)=>sum+tokens,0n);
  const part=(key:string,tokens:bigint|null):UsagePart=>({key,tokens:tokens===null?null:tokens.toString(),
   value:tokens===null?null:mode==='share'?share(tokens,total):Number(tokens)});
  const parts=selected.map(key=>part(key,rows.get(key)??null));
  const unselected=[...rows].reduce((sum,[key,tokens])=>key!=='other'&&!selected.includes(key)?sum+tokens:sum,0n);
  parts.push(part('unselected',unselected),part('other',rows.get('other')??0n));
  days.push({date,available:true,totalTokens:total.toString(),parts});
 }
 return {days,selectedModels:selected,requestedDays:windowDays,availableDays:days.filter(day=>day.available).length,
  mode,denominator:'All reported OpenRouter traffic',asOf:snapshot.asOf,sourceUrl:snapshot.sourceUrl,licenseUrl:snapshot.licenseUrl,
  startDate:days[0]?.date??snapshot.startDate,endDate:snapshot.endDate};
}

export function usageKeyboardIndex(key:string,index:number,count:number):number|null{
 if(count<=0)return null;
 if(key==='Enter'||key===' ')return index;
 if(key==='Home')return 0;
 if(key==='End')return count-1;
 if(key==='ArrowLeft')return Math.max(0,index-1);
 if(key==='ArrowRight')return Math.min(count-1,index+1);
 return null;
}
