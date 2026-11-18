/** Pure maths behind the optional chart overlays. Nothing here changes where a measured point sits. */
type XY={x:number;y:number};
type Ranked=XY&{id:string;cohortKey:string|null};

const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
/** Rounds to the nearest 1, 2 or 5 times a power of ten, so a guide line carries a readable number. */
export function niceValue(value:number):number{
 if(!finite(value)||value<=0)return 0;
 const power=10**Math.floor(Math.log10(value)),ratio=value/power;
 return Number(((ratio<1.5?1:ratio<3.5?2:ratio<7.5?5:10)*power).toPrecision(12));
}

/**
 * Levels of "score points per dollar" that run through the plotted records: the lower, middle and
 * upper part of the data, each rounded to a readable number. Zero-cost records have no finite ratio.
 */
export function isoValueLevels(points:readonly XY[]):number[]{
 const ratios=points.filter(point=>finite(point.x)&&finite(point.y)&&point.x>0&&point.y>0).map(point=>Math.log10(point.y/point.x)).sort((a,b)=>a-b);
 if(ratios.length<2)return [];
 const at=(share:number)=>ratios[Math.min(ratios.length-1,Math.max(0,Math.round(share*(ratios.length-1))))];
 return [...new Set([.1,.5,.9].map(share=>niceValue(10**at(share))).filter(level=>level>0))].sort((a,b)=>a-b);
}

/** The highest-scoring record at or under a budget; ties go to the cheaper record. */
export function bestUnderBudget<T extends XY&{id:string}>(points:readonly T[],budget:number):T|null{
 let best:T|null=null;
 for(const point of points){
  if(!finite(point.x)||!finite(point.y)||point.x>budget)continue;
  if(!best||point.y>best.y||(point.y===best.y&&(point.x<best.x||(point.x===best.x&&point.id<best.id))))best=point;
 }
 return best;
}

/**
 * Records that beat `target` on both axes: at least as good on each and strictly better on one.
 * Only records in the same comparable cohort count, which is the rule the Pareto line uses.
 */
export function dominators<T extends Ranked>(target:T,points:readonly T[],higherXIsBetter=false):T[]{
 if(!target.cohortKey)return [];
 const betterX=(other:T)=>higherXIsBetter?other.x>=target.x:other.x<=target.x;
 return points.filter(other=>other.id!==target.id&&other.cohortKey===target.cohortKey&&finite(other.x)&&finite(other.y)&&
  betterX(other)&&other.y>=target.y&&(other.x!==target.x||other.y!==target.y))
  .sort((a,b)=>b.y-a.y||(higherXIsBetter?b.x-a.x:a.x-b.x)||a.id.localeCompare(b.id));
}

/** Area-true radius: a value four times larger draws a circle with four times the area. */
export function sizeScale(values:readonly number[],minRadius=3.5,maxRadius=11):(value:number|undefined)=>number|null{
 const usable=values.filter(value=>finite(value)&&value>0);
 if(!usable.length)return()=>null;
 const low=Math.sqrt(Math.min(...usable)),high=Math.sqrt(Math.max(...usable));
 return value=>!finite(value)||value<=0?null:high===low?(minRadius+maxRadius)/2:minRadius+(Math.sqrt(value)-low)/(high-low)*(maxRadius-minRadius);
}

const day=86400000;
const time=(value:string|null|undefined)=>{const parsed=value?Date.parse(value):NaN;return Number.isFinite(parsed)?parsed:null;};
/** 0 fresh, 1 not observed for over two weeks, 2 not observed for over two months, measured against the newest record shown. */
export function stalenessTier(observedAt:string|null|undefined,newest:string|null|undefined):0|1|2{
 const seen=time(observedAt),latest=time(newest);
 if(seen===null||latest===null)return 0;
 const age=(latest-seen)/day;
 return age>60?2:age>14?1:0;
}
export function isRecentRelease(releasedAt:string|null|undefined,asOf:string|null|undefined,days=30):boolean{
 const released=time(releasedAt),now=time(asOf);
 return released!==null&&now!==null&&released<=now&&(now-released)/day<=days;
}
/** The newest observation among the records shown: the honest "today" for a static build. */
export function newestDate(values:ReadonlyArray<string|null|undefined>):string|null{
 const times=values.map(time).filter((value):value is number=>value!==null);
 return times.length?new Date(Math.max(...times)).toISOString():null;
}

/** First day of each month from the earliest release to the latest, as YYYY-MM-DD. */
export function releaseMonths(dates:ReadonlyArray<string|null|undefined>):string[]{
 const times=dates.map(time).filter((value):value is number=>value!==null).sort((a,b)=>a-b);
 if(!times.length)return [];
 const start=new Date(times[0]),end=new Date(times[times.length-1]);
 const months:string[]=[];
 for(let year=start.getUTCFullYear(),month=start.getUTCMonth();year<end.getUTCFullYear()||(year===end.getUTCFullYear()&&month<=end.getUTCMonth());month++){
  if(month>11){month=0;year++;}
  months.push(new Date(Date.UTC(year,month,1)).toISOString().slice(0,10));
  if(months.length>600)break;
 }
 return months;
}
/** True when a record was already released at the end of the given month. */
export function releasedBy(releasedAt:string|null|undefined,month:string):boolean{
 const released=time(releasedAt),start=time(month);
 if(released===null||start===null)return false;
 const date=new Date(start);
 return released<Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1);
}
