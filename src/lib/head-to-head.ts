/**
 * Head-to-head matchup pages: two model FAMILIES (every reasoning level of one model) compared
 * on the measurements both of them have. Everything here is pure so the pages, the /matchups
 * index, the palette data and the tests share one definition. Loading lives in
 * head-to-head-data.ts.
 *
 * Nothing here ranks one family over the other. Differences are stated in plain terms
 * ("4.2 points higher", "62% of the price") and only when both sides have a value.
 */
import {compareFamilyKey} from './compare-families';
import {reasoningRank} from './compare-family-lines';
import type {ExplorerModel} from './compare-series';
import {AA_METRIC_LABELS,serializeCompareState,type CompareChart} from './compare-state';
import {slugify} from './model-pages';
import {familySlug,matchupPath} from './site-routes';

export type H2HFamily={
 /** compareFamilyKey of the records, unique per source/provider/family. */
 key:string;
 /** URL slug, unique across all current AA families (see assignFamilySlugs). */
 slug:string;
 name:string;
 provider:string;
 /** Current AA records, lowest reasoning effort first. */
 records:ExplorerModel[];
 /** Highest AA Intelligence Index on the ranking index version, or null. */
 topIndex:number|null;
 /** 1-based position by topIndex among ranked families; null when unranked. */
 rank:number|null;
};

export type MatchupSide={slug:string;name:string;provider:string};
export type MatchupReason='top'|'lab'|'top-and-lab';
export type Matchup={
 /** /compare/{a}-vs-{b}; a and b are in slug order, so the order implies nothing. */
 path:string;
 a:MatchupSide;
 b:MatchupSide;
 reason:MatchupReason;
};

/** Every pair among this many highest-Index families gets a page. */
export const MATCHUP_TOP_FAMILIES=24;
/** Same-lab pairs are added among this many highest-Index families. */
export const MATCHUP_LAB_POOL=48;

const finite=(value:number|null|undefined):value is number=>typeof value==='number'&&Number.isFinite(value);

const versionCompare=(left:string,right:string)=>{
 const a=left.split('.').map(Number),b=right.split('.').map(Number);
 for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]??0)-(b[i]??0);if(d)return d;}
 return left.localeCompare(right);
};

/** The newest AA Intelligence Index version among records that carry a score. */
export function latestIndexVersion(records:readonly ExplorerModel[]):string|null{
 const versions=[...new Set(records.filter(model=>finite(model.intelligence)&&model.indexVersion).map(model=>model.indexVersion!))];
 return versions.sort(versionCompare).at(-1)??null;
}

/**
 * Slugs start from familySlug(family). When several families share that slug:
 *  1. if they come from different labs, each gets "-{lab slug}" appended;
 *  2. if still shared (same lab, e.g. "Command A" and "Command A+"), a "+" in the family
 *     name is spelled out as "plus" ("command-a-plus");
 *  3. anything still shared gets "-2", "-3", ... in (family name, provider, key) order.
 * The rules only look at the colliding names, so a slug changes only when a new family
 * collides with it.
 */
export function assignFamilySlugs(families:ReadonlyArray<{key:string;name:string;provider:string}>):Map<string,string>{
 const result=new Map<string,string>();
 const byBase=new Map<string,typeof families[number][]>();
 for(const family of families){const base=familySlug(family.name);(byBase.get(base)??byBase.set(base,[]).get(base)!).push(family);}
 for(const [base,group] of byBase){
  if(group.length===1){result.set(group[0].key,base);continue;}
  const multiLab=new Set(group.map(family=>family.provider)).size>1;
  const first=group.map(family=>({family,slug:multiLab?`${base}-${slugify(family.provider)||'lab'}`:base}));
  const counts=(rows:{slug:string}[])=>rows.reduce((map,row)=>map.set(row.slug,(map.get(row.slug)??0)+1),new Map<string,number>());
  const firstCounts=counts(first);
  const second=first.map(row=>firstCounts.get(row.slug)!>1&&row.family.name.includes('+')
   ?{...row,slug:(multiLab?`${familySlug(row.family.name.replace(/\+/g,' plus '))}-${slugify(row.family.provider)||'lab'}`:familySlug(row.family.name.replace(/\+/g,' plus ')))}:row);
  const order=[...second].sort((x,y)=>x.family.name.localeCompare(y.family.name,'en')||x.family.provider.localeCompare(y.family.provider,'en')||x.family.key.localeCompare(y.family.key));
  const seen=new Map<string,number>();
  for(const row of order){
   const n=(seen.get(row.slug)??0)+1;seen.set(row.slug,n);
   result.set(row.family.key,n===1?row.slug:`${row.slug}-${n}`);
  }
 }
 // A suffixed slug could, in principle, equal another family's bare slug; settle that too.
 const taken=new Map<string,string>();
 for(const family of [...families].sort((x,y)=>x.key.localeCompare(y.key))){
  let slug=result.get(family.key)!;const original=slug;let n=1;
  while(taken.has(slug)&&taken.get(slug)!==family.key)slug=`${original}-${++n}`;
  taken.set(slug,family.key);result.set(family.key,slug);
 }
 return result;
}

/** Current AA families, ranked by their highest AA Intelligence Index on the newest index version. */
export function buildH2HFamilies(records:readonly ExplorerModel[]):H2HFamily[]{
 const current=records.filter(model=>model.source==='aa'&&model.current===true);
 const version=latestIndexVersion(current);
 const groups=new Map<string,ExplorerModel[]>();
 for(const model of current){const key=compareFamilyKey(model);(groups.get(key)??groups.set(key,[]).get(key)!).push(model);}
 const base=[...groups.entries()].map(([key,group])=>{
  const scored=group.filter(model=>finite(model.intelligence)&&model.indexVersion===version).map(model=>model.intelligence!);
  return {key,name:group[0].family,provider:group[0].provider??group[0].family,
   records:[...group].sort((a,b)=>reasoningRank(a.reasoning)-reasoningRank(b.reasoning)||a.name.localeCompare(b.name)||a.id.localeCompare(b.id)),
   topIndex:scored.length?Math.max(...scored):null};
 });
 const slugs=assignFamilySlugs(base);
 const ranked=base.filter(family=>family.topIndex!==null).sort(rankOrder);
 const ranks=new Map(ranked.map((family,index)=>[family.key,index+1]));
 return base.map(family=>({...family,slug:slugs.get(family.key)!,rank:ranks.get(family.key)??null}))
  .sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity)||a.name.localeCompare(b.name,'en')||a.key.localeCompare(b.key));
}
function rankOrder(a:{topIndex:number|null;name:string;key:string},b:{topIndex:number|null;name:string;key:string}){
 return (b.topIndex??-Infinity)-(a.topIndex??-Infinity)||a.name.localeCompare(b.name,'en')||a.key.localeCompare(b.key);
}

export const matchupKey=(slugA:string,slugB:string)=>[slugA,slugB].sort((a,b)=>a.localeCompare(b)).join('\u0000');
const side=(family:H2HFamily):MatchupSide=>({slug:family.slug,name:family.name,provider:family.provider});

/**
 * The bounded page set: every pair among the MATCHUP_TOP_FAMILIES highest-Index families,
 * plus every same-lab pair among the MATCHUP_LAB_POOL highest. Families without an Index on
 * the newest version are never in a matchup. Ordered by the better-ranked family's rank, then
 * the other's, so lists read from the top of the index down.
 */
export function selectMatchups(families:readonly H2HFamily[],top=MATCHUP_TOP_FAMILIES,labPool=MATCHUP_LAB_POOL):Matchup[]{
 const ranked=families.filter(family=>family.rank!==null).sort((a,b)=>a.rank!-b.rank!);
 const pool=ranked.slice(0,Math.max(top,labPool));
 const pairs=new Map<string,{x:H2HFamily;y:H2HFamily;reason:MatchupReason}>();
 for(let i=0;i<pool.length;i++)for(let j=i+1;j<pool.length;j++){
  const x=pool[i],y=pool[j];
  const isTop=i<top&&j<top,isLab=i<labPool&&j<labPool&&x.provider===y.provider;
  if(!isTop&&!isLab)continue;
  pairs.set(matchupKey(x.slug,y.slug),{x,y,reason:isTop&&isLab?'top-and-lab':isTop?'top':'lab'});
 }
 return [...pairs.values()].map(({x,y,reason})=>{
  const [a,b]=[x,y].sort((m,n)=>m.slug.localeCompare(n.slug));
  return {path:matchupPath(a.slug,b.slug),a:side(a),b:side(b),reason};
 });
}

/** O(1) membership test over a matchup list, independent of argument order. */
export function createMatchupLookup(matchups:readonly Matchup[]){
 const keys=new Map(matchups.map(matchup=>[matchupKey(matchup.a.slug,matchup.b.slug),matchup]));
 return {
  has:(slugA:string,slugB:string)=>slugA!==slugB&&keys.has(matchupKey(slugA,slugB)),
  get:(slugA:string,slugB:string)=>slugA===slugB?undefined:keys.get(matchupKey(slugA,slugB)),
 };
}

/** The route param for a matchup path ("/compare/a-vs-b" gives "a-vs-b"). */
export const matchupParam=(matchup:Pick<Matchup,'path'>)=>matchup.path.replace(/^\/compare\//,'');

/** Other matchups for one family, best-ranked opponent first. */
export function matchupsFor(slug:string,matchups:readonly Matchup[],families:readonly H2HFamily[],exclude?:string):Array<{path:string;opponent:MatchupSide}>{
 const rank=new Map(families.map(family=>[family.slug,family.rank??Infinity]));
 return matchups.filter(matchup=>(matchup.a.slug===slug||matchup.b.slug===slug)&&matchup.path!==exclude)
  .map(matchup=>({path:matchup.path,opponent:matchup.a.slug===slug?matchup.b:matchup.a}))
  .sort((x,y)=>(rank.get(x.opponent.slug)??Infinity)-(rank.get(y.opponent.slug)??Infinity)||x.opponent.name.localeCompare(y.opponent.name));
}

/* ------------------------------------------------------------------------------------------ */
/* Level matching                                                                               */

export type LevelRow={level:string;a:ExplorerModel;b:ExplorerModel};
export type UnmatchedRecord={record:ExplorerModel;why:'level-not-recorded'|'level-only-here'|'extra-variant'};
export type LevelMatch={shared:LevelRow[];onlyA:UnmatchedRecord[];onlyB:UnmatchedRecord[]};

/** One record per level: prefer a scored record, then the plainest name, then id. */
const primaryOrder=(a:ExplorerModel,b:ExplorerModel)=>
 Number(finite(b.intelligence))-Number(finite(a.intelligence))||a.name.length-b.name.length||a.id.localeCompare(b.id);

function byLevel(records:readonly ExplorerModel[]){
 const levels=new Map<string,ExplorerModel[]>();const unknown:ExplorerModel[]=[];
 for(const record of records){
  const level=record.reasoning??'unknown';
  if(level==='unknown'){unknown.push(record);continue;}
  (levels.get(level)??levels.set(level,[]).get(level)!).push(record);
 }
 return {levels:new Map([...levels].map(([level,group])=>[level,[...group].sort(primaryOrder)])),unknown};
}

/**
 * Pairs records that share a recorded reasoning level. A record with no recorded level is
 * never matched (an unrecorded level is not evidence of equal settings). Nothing is dropped:
 * every record that is not in a shared row is returned with the reason.
 */
export function matchLevels(a:readonly ExplorerModel[],b:readonly ExplorerModel[]):LevelMatch{
 const left=byLevel(a),right=byLevel(b);
 const shared:LevelRow[]=[];const onlyA:UnmatchedRecord[]=[];const onlyB:UnmatchedRecord[]=[];
 const levels=[...new Set([...left.levels.keys(),...right.levels.keys()])].sort((x,y)=>reasoningRank(x)-reasoningRank(y)||x.localeCompare(y));
 for(const level of levels){
  const l=left.levels.get(level)??[],r=right.levels.get(level)??[];
  if(l.length&&r.length){
   shared.push({level,a:l[0],b:r[0]});
   onlyA.push(...l.slice(1).map(record=>({record,why:'extra-variant' as const})));
   onlyB.push(...r.slice(1).map(record=>({record,why:'extra-variant' as const})));
  }else{
   onlyA.push(...l.map(record=>({record,why:'level-only-here' as const})));
   onlyB.push(...r.map(record=>({record,why:'level-only-here' as const})));
  }
 }
 onlyA.push(...left.unknown.map(record=>({record,why:'level-not-recorded' as const})));
 onlyB.push(...right.unknown.map(record=>({record,why:'level-not-recorded' as const})));
 return {shared,onlyA,onlyB};
}

export const levelLabel=(level:string|undefined)=>{
 if(!level||level==='unknown')return 'Not recorded';
 if(level==='none')return 'No reasoning';
 if(level==='xhigh')return 'Extra high';
 return level.charAt(0).toUpperCase()+level.slice(1);
};

/** The family's highest-Index record (ties: lower cost per task, then lower effort, then id). */
export function strongestRecord(records:readonly ExplorerModel[]):ExplorerModel|null{
 const scored=records.filter(record=>finite(record.intelligence));
 if(!scored.length)return null;
 return [...scored].sort((x,y)=>y.intelligence!-x.intelligence!||
  (finite(x.aaTaskCost)?x.aaTaskCost:Infinity)-(finite(y.aaTaskCost)?y.aaTaskCost:Infinity)||
  reasoningRank(x.reasoning)-reasoningRank(y.reasoning)||x.id.localeCompare(y.id))[0];
}

/* ------------------------------------------------------------------------------------------ */
/* Differences in plain terms                                                                   */

export type Difference={
 /** Which side the sentence is about; null when the values are equal. */
 subject:'a'|'b'|null;
 /** Signed a minus b for gaps, a divided by b for ratios. */
 value:number;
 text:string;
};

const trim=(value:number,digits:number)=>Number(value.toFixed(digits)).toString();

/**
 * Gap on an additive scale (Index points, percentage points). Null unless both are numbers.
 * The sentence names the higher side so no number is negative.
 */
export function gapDifference(a:number|null|undefined,b:number|null|undefined,names:{a:string;b:string},unit='points',digits=1):Difference|null{
 if(!finite(a)||!finite(b))return null;
 const gap=a-b;
 if(Number(Math.abs(gap).toFixed(digits))===0)return {subject:null,value:gap,text:'Same, to the precision shown'};
 const subject=gap>0?'a':'b';
 const amount=trim(Math.abs(gap),digits);
 return {subject,value:gap,text:`${names[subject]} ${amount} ${amount==='1'&&unit==='points'?'point':unit} higher`};
}

/** Percent formatting that never rounds a real difference to "100%" or a nonzero to "0%". */
export function percentOf(ratio:number):string{
 const pct=ratio*100;
 if(pct>0&&pct<1)return pct<0.1?'under 0.1%':`${trim(pct,1)}%`;
 if(pct<100&&pct>=99.5)return `${trim(pct,1)}%`;
 return `${trim(pct,pct<10?1:0)}%`;
}

export type RatioKind='price'|'cost'|'speed'|'latency'|'context';
const RATIO_NOUNS:Record<RatioKind,string>={
 price:'the price',cost:'the cost per task',speed:'the output speed',latency:'the time to first token',context:'the context window',
};

/**
 * Ratio on a multiplicative scale (prices, costs, speed, latency, context). Null unless both
 * sides are numbers and the comparison is defined. The sentence names the smaller side as a
 * percentage of the larger ("62% of the price"); this states a measurement, not a preference.
 */
export function ratioDifference(a:number|null|undefined,b:number|null|undefined,names:{a:string;b:string},kind:RatioKind):Difference|null{
 if(!finite(a)||!finite(b)||a<0||b<0)return null;
 if(a===b)return {subject:null,value:1,text:'Same'};
 if(a===0||b===0){
  const subject=a===0?'a':'b';
  return {subject,value:b===0?Infinity:0,text:`${names[subject]} is recorded at zero`};
 }
 const subject=a<b?'a':'b';
 const ratio=Math.min(a,b)/Math.max(a,b);
 return {subject,value:a/b,text:`${names[subject]}: ${percentOf(ratio)} of ${RATIO_NOUNS[kind]}`};
}

/* ------------------------------------------------------------------------------------------ */
/* Chart                                                                                         */

export type H2HAxis='task-cost'|'blended-price';
export type H2HChartPoint={id:string;side:'a'|'b';family:string;level:string;name:string;x:number;y:number};
export type H2HChart={
 axis:H2HAxis;xLabel:string;yLabel:string;
 points:H2HChartPoint[];
 /** Records with an Index that cannot sit on the log x-axis, with the reason. */
 unplotted:Array<{side:'a'|'b';name:string;reason:string}>;
};

const hasTaskPoint=(records:readonly ExplorerModel[])=>records.some(record=>finite(record.intelligence)&&finite(record.aaTaskCost)&&record.aaTaskCost>0);

/**
 * Index against cost per task when BOTH families have at least one record with both values,
 * otherwise against blended token price, so the two lines always share one x-axis.
 */
export function buildH2HChart(a:Pick<H2HFamily,'name'|'records'>,b:Pick<H2HFamily,'name'|'records'>):H2HChart{
 const axis:H2HAxis=hasTaskPoint(a.records)&&hasTaskPoint(b.records)?'task-cost':'blended-price';
 const xOf=(record:ExplorerModel)=>axis==='task-cost'?record.aaTaskCost:record.priceBlended;
 const points:H2HChartPoint[]=[];const unplotted:H2HChart['unplotted']=[];
 for(const [sideKey,family] of [['a',a],['b',b]] as const){
  for(const record of family.records){
   if(!finite(record.intelligence))continue;
   const x=xOf(record);
   if(!finite(x)){unplotted.push({side:sideKey,name:record.name,reason:axis==='task-cost'?'no cost per task recorded':'no blended price recorded'});continue;}
   if(x<=0){unplotted.push({side:sideKey,name:record.name,reason:`${axis==='task-cost'?'cost per task':'blended price'} recorded as $0, which a log axis cannot show`});continue;}
   points.push({id:record.id,side:sideKey,family:family.name,level:record.reasoning??'unknown',name:record.name,x,y:record.intelligence!});
  }
 }
 return {axis,points,unplotted,
  xLabel:axis==='task-cost'?'Cost per AA Index task (USD, log scale)':'Blended price per 1M tokens, 3:1 input to output (USD, log scale)',
  yLabel:'AA Intelligence Index (points)'};
}

/* ------------------------------------------------------------------------------------------ */
/* Benchmarks and links                                                                          */

export type BenchmarkRow={key:string;label:string;scale:'points'|'percent';a:number;b:number;difference:Difference};
const INDEX_KEYS=new Set(['aa_intelligence_index','aa_coding_index','aa_agentic_index','aa_math_index']);

/** Benchmarks (other than the Intelligence Index itself) where both records have a score. */
export function sharedBenchmarks(a:ExplorerModel,b:ExplorerModel,names:{a:string;b:string}):BenchmarkRow[]{
 const rows:BenchmarkRow[]=[];
 for(const [key,label] of Object.entries(AA_METRIC_LABELS)){
  if(key==='aa_intelligence_index')continue;
  const x=a.metrics?.[key],y=b.metrics?.[key];
  if(!finite(x)||!finite(y))continue;
  const scale=INDEX_KEYS.has(key)?'points':'percent';
  const difference=scale==='points'?gapDifference(x,y,names):gapDifference(x*100,y*100,names,'percentage points');
  rows.push({key,label,scale,a:x,b:y,difference:difference!});
 }
 return rows;
}

/** The /compare link with every record of both families selected. */
export function compareHrefFor(ids:readonly string[],chart:CompareChart='task-cost'):string{
 const params=serializeCompareState({chart,modelIds:[...ids],missingModelIds:[],reasoningEfforts:[],metricId:'aa_intelligence_index',
  scoreMetricKey:null,conditionKey:null,scale:'log',labels:true,frontier:true,includeHistory:false});
 return `/compare?${params.toString()}`;
}

/** Latest observation date (YYYY-MM-DD) across records, or null. */
export function latestObservation(records:readonly ExplorerModel[]):string|null{
 const dates=records.map(record=>record.observedAt).filter((value):value is string=>Boolean(value)).map(value=>new Date(value))
  .filter(date=>!Number.isNaN(date.getTime())).sort((x,y)=>x.getTime()-y.getTime());
 return dates.at(-1)?.toISOString().slice(0,10)??null;
}

/** Specific, length-bounded <title> in the style of modelPageTitle. */
export function matchupTitle(a:string,b:string):string{
 const detailed=`${a} vs ${b}: price, speed and AA Index | AI Stats`;
 if(detailed.length<=70)return detailed;
 const branded=`${a} vs ${b} | AI Stats`;
 return branded.length<=70?branded:`${a} vs ${b}`;
}
