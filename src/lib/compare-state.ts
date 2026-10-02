export const COMPARE_CHARTS = ['cost-intelligence','speed-intelligence','price','benchmark',
  'task-cost','total-cost','tokens-task','tokens-total'] as const;
export type CompareChart = typeof COMPARE_CHARTS[number];
export type CompareCatalogEntry = {id:string; name?:string; slug?:string; family?:string; reasoning?:string; current?:boolean|null};
export type CompareState = {
  chart:CompareChart; modelIds:string[]; missingModelIds:string[]; reasoningEfforts:string[];
  metricId:string; conditionKey:string|null; scale:'linear'|'log'; labels:boolean; frontier:boolean; includeHistory:boolean;
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
export function parseCompareState(params:URLSearchParams,catalog:CompareCatalogEntry[],defaults:string[]=[]):CompareState {
  const metric=params.get('metric')??'aa_intelligence_index';
  const metricId=/^(?:aa_[a-z0-9_]+|epoch_[a-z0-9_-]+)$/.test(metric)?metric:'aa_intelligence_index';
  const chart=params.get('chart')??(metricId.startsWith('epoch_')?'benchmark':'cost-intelligence');
  let requested=params.has('m')?params.getAll('m'):params.has('models')?(params.get('models')??'').split(','):defaults;
  const legacy=params.get('model');
  if(!params.has('m')&&!params.has('models')&&legacy){
    const matches=catalog.filter(model=>model.id===legacy||model.name?.toLowerCase()===legacy.toLowerCase()||model.slug===legacy);
    requested=matches.length===1?[matches[0].id]:[legacy];
  }
  const ids=new Set(catalog.map(model=>model.id));
  const selected=unique(requested.filter(safeIdentity));
  return {
    chart:COMPARE_CHARTS.includes(chart as CompareChart)?chart as CompareChart:'cost-intelligence',
    modelIds:selected.filter(id=>ids.has(id)), missingModelIds:selected.filter(id=>!ids.has(id)),
    reasoningEfforts:unique(params.getAll('reason').filter(value=>REASONING.has(value))).sort(),
    metricId,conditionKey:condition(params.get('condition')),
    scale:params.has('scale')?(params.get('scale')==='log'?'log':'linear'):(chart==='cost-intelligence'?'log':'linear'),labels:params.get('labels')==='1',
    frontier:params.get('frontier')!=='0',includeHistory:params.get('history')==='1',
  };
}
export function serializeCompareState(state:CompareState):URLSearchParams {
  const params=new URLSearchParams();
  params.set('chart',state.chart);
  const ids=unique([...state.modelIds,...state.missingModelIds]);
  for(const id of ids.length?ids:['']) params.append('m',id);
  params.set('metric',state.metricId);
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
