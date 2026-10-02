import {SOURCE_RECORD_TYPES} from './model-identity';
export const AA_METRIC_LABELS:Record<string,string> = {
 aa_intelligence_index:'Intelligence Index',aa_coding_index:'Coding Index',aa_agentic_index:'Agentic Index',aa_math_index:'Math Index',
 mmlu_pro:'MMLU-Pro',gpqa:'GPQA Diamond',hle:"Humanity's Last Exam",livecodebench:'LiveCodeBench',scicode:'SciCode',math_500:'MATH-500',aime:'AIME',
};
export const COMPARE_CHARTS = ['cost-intelligence','speed-intelligence','price','benchmark'] as const;
export type CompareChart = typeof COMPARE_CHARTS[number];
export type CompareCatalogEntry = {id:string; name?:string; slug?:string; source?:string; sourceModelId?:string; family?:string; reasoning?:string; current?:boolean|null};
export type CompareState = {
  chart:CompareChart; modelIds:string[]; missingModelIds:string[]; reasoningEfforts:string[];
  metricId:string; scoreMetricKey:string|null; conditionKey:string|null; scale:'linear'|'log'; labels:boolean; frontier:boolean; includeHistory:boolean;
};
const REASONING = new Set(['none','low','medium','high','xhigh','max','unknown']);
const MAX_SELECTION = 100;
const unique = (values:string[]) => [...new Set(values)].slice(0,MAX_SELECTION);
const safeIdentity = (value:string) => value.length > 0 && value.length <= 512 && Array.from(value).every(character=>character.charCodeAt(0)>=32);
const condition = (value:string|null):string|null => {
  if(!value || value.length>2048) return null;
  if(value==='unknown') return value;
  try {
    const raw=JSON.parse(value);
    if(Array.isArray(raw)&&raw.some(pair=>!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'))return null;
    const parsed=Array.isArray(raw)?Object.fromEntries(raw):raw;
    if(!parsed || typeof parsed!=='object' || Array.isArray(parsed) ||
      Object.values(parsed).some(item=>!['string','number','boolean'].includes(typeof item))) return null;
    return JSON.stringify(Object.entries(parsed).sort(([a],[b])=>a.localeCompare(b)));
  } catch {return null;}
};
const scoreMetric=(value:string|null):string|null=>{
  if(!value||value.length>1024)return null;
  try{const parsed=JSON.parse(value);return Array.isArray(parsed)&&parsed.length===2&&parsed.every(item=>typeof item==='string'&&item.length<=512)?JSON.stringify(parsed):null;}catch{return null;}
};
export function parseCompareState(params:URLSearchParams,catalog:CompareCatalogEntry[],defaults:string[]=[]):CompareState {
  const metric=params.get('metric')??'aa_intelligence_index';
  const metricId=(Object.hasOwn(AA_METRIC_LABELS,metric)||/^epoch_[a-z0-9_-]+$/.test(metric))?metric:'aa_intelligence_index';
  const chart=params.get('chart')??(params.has('metric')?'benchmark':'cost-intelligence');
  let requested=params.has('m')?params.getAll('m'):params.has('models')?(params.get('models')??'').split(','):defaults;
  const source=params.get('source'),native=params.get('record');
  if(!params.has('m')&&!params.has('models')&&source&&native){
    const type=Object.hasOwn(SOURCE_RECORD_TYPES,source)?SOURCE_RECORD_TYPES[source]:null;
    const matches=type?catalog.filter(model=>model.source===type&&
      (model.sourceModelId===native||(type==='aa'&&model.slug===native))&&
      (params.get('history')==='1'||model.current!==false)):[];
    requested=matches.length?matches.map(model=>model.id):[source+':'+native];
  }
  const legacy=params.get('model');
  if(!params.has('m')&&!params.has('models')&&!source&&legacy){
    const matches=catalog.filter(model=>model.id===legacy||model.name?.toLowerCase()===legacy.toLowerCase()||model.slug===legacy);
    requested=matches.length===1?[matches[0].id]:[legacy];
  }
  const ids=new Set(catalog.map(model=>model.id));
  const selected=unique(requested.filter(safeIdentity));
  const normalizedChart=COMPARE_CHARTS.includes(chart as CompareChart)?chart as CompareChart:'cost-intelligence';
  return {
    chart:normalizedChart,
    modelIds:selected.filter(id=>ids.has(id)), missingModelIds:selected.filter(id=>!ids.has(id)),
    reasoningEfforts:unique(params.getAll('reason').filter(value=>REASONING.has(value))).sort(),
    metricId,scoreMetricKey:scoreMetric(params.get('score_metric')),conditionKey:condition(params.get('condition')),
    scale:params.has('scale')?(params.get('scale')==='log'?'log':'linear'):(normalizedChart==='cost-intelligence'?'log':'linear'),labels:params.get('labels')==='1',
    frontier:params.get('frontier')!=='0',includeHistory:params.get('history')==='1',
  };
}
export function serializeCompareState(state:CompareState):URLSearchParams {
  const params=new URLSearchParams();
  params.set('chart',state.chart);
  const ids=unique([...state.modelIds,...state.missingModelIds]);
  for(const id of ids.length?ids:['']) params.append('m',id);
  params.set('metric',state.metricId);
  if(state.scoreMetricKey) params.set('score_metric',state.scoreMetricKey);
  if(state.conditionKey) params.set('condition',state.conditionKey);
  params.set('scale',state.scale);
  if(state.labels) params.set('labels','1');
  if(!state.frontier) params.set('frontier','0');
  if(state.includeHistory) params.set('history','1');
  for(const reason of state.reasoningEfforts) params.append('reason',reason);
  return params;
}
export function selectFamily(selected:string[],catalog:CompareCatalogEntry[],family:string,checked:boolean,includeHistory=false):string[] {
  const ids=catalog.filter(model=>model.family===family&&(!checked||includeHistory||model.current!==false)).map(model=>model.id);
  return checked?unique([...selected,...ids]):selected.filter(id=>!ids.includes(id));
}

export function readBenchmarkCache<T>(cache:Record<string,T[]>,slug:string):T[]|undefined {
  return Object.prototype.hasOwnProperty.call(cache,slug)&&Array.isArray(cache[slug])?cache[slug]:undefined;
}

export function scoreMetricOptions(recorded:string[],selected:string|null) {
  return {visible:recorded.length>1||Boolean(selected),missing:Boolean(selected&&!recorded.includes(selected))};
}
export const changeScoreMetric=(value:string):Pick<CompareState,'scoreMetricKey'|'conditionKey'>=>({scoreMetricKey:value||null,conditionKey:null});

/** Group selection is scoped to the exact visible records, not a display-name join. */
export function selectVisibleRecords(selected:string[],visibleIds:string[],checked:boolean):string[]{
 const ids=new Set(visibleIds);return checked?unique([...selected,...visibleIds]):selected.filter(id=>!ids.has(id));
}
